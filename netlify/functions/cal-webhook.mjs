import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

// Receives Cal.com webhooks (BOOKING_CREATED / BOOKING_CANCELLED / BOOKING_RESCHEDULED)
// and does two things:
//
//   1. Fires a server-side "Schedule" conversion to Meta's Conversions API
//      (dataset "Triad Website"). This is the authoritative booking signal —
//      unlike the browser pixel it cannot be stopped by ad blockers, Opera GX,
//      or iOS privacy. event_id = the Cal booking uid, which the browser pixel
//      also sends as eventID, so Meta deduplicates when both arrive.
//   2. Mirrors the booking into the Neon `consultation_bookings` table
//      (best-effort: a DB problem never blocks the conversion event).
//
// Cal.com already emails you and adds the Google Calendar event itself.
//
// Setup: Cal.com → Settings → Developer → Webhooks → New webhook
//   Subscriber URL: https://triad.fitness/.netlify/functions/cal-webhook
//   Triggers: Booking Created, Booking Cancelled, Booking Rescheduled
//   Secret: the value of the CAL_WEBHOOK_SECRET env var in Netlify.
//
// Env vars (Netlify):
//   META_CAPI_TOKEN     – Meta system-user token (sends events; required)
//   META_PIXEL_ID       – dataset id (defaults to the Triad Website pixel)
//   CAL_WEBHOOK_SECRET  – shared secret for signature verification
//   NETLIFY_DATABASE_URL / DATABASE_URL – Neon (optional; mirror skipped if unset)

// v2 — bumped to force a fresh function bundle: Netlify reused a cached build
// that predated META_CAPI_TOKEN / CAL_WEBHOOK_SECRET and so ran without them.
const PIXEL_ID = process.env.META_PIXEL_ID || '4237814756509579';
const PAGE_URL = 'https://triad.fitness/social.html';

const jsonHeaders = { 'Content-Type': 'application/json' };

function json(statusCode, body) {
  return { statusCode, headers: jsonHeaders, body: JSON.stringify(body) };
}

// Cal.com signs the raw request body with HMAC-SHA256 and sends it in the
// `X-Cal-Signature-256` header. Verifying it stops anyone from POSTing fake
// bookings (and fake ad conversions) at this endpoint.
function signatureValid(secret, rawBody, header) {
  if (!secret) return true; // no secret configured → skip check (not recommended)
  if (!header) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(header), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Meta requires customer fields hashed with SHA-256 after normalisation.
function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalisedEmailHash(email) {
  const e = String(email || '').trim().toLowerCase();
  return e ? sha256(e) : null;
}

// Meta wants digits only, with country code. UK 07… → 447…
function normalisedPhoneHash(phone) {
  let digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  if (digits.startsWith('07')) digits = '44' + digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  return sha256(digits);
}

function nameHash(part) {
  const p = String(part || '').trim().toLowerCase();
  return p ? sha256(p) : null;
}

async function sendMetaScheduleEvent({ uid, name, email, phone, whenIso }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    console.error('cal-webhook: META_CAPI_TOKEN not set — conversion NOT sent.');
    return { sent: false, reason: 'no token' };
  }

  const [firstName, ...rest] = String(name || '').trim().split(/\s+/);
  const userData = {};
  const em = normalisedEmailHash(email);
  const ph = normalisedPhoneHash(phone);
  const fn = nameHash(firstName);
  const ln = nameHash(rest.join(' '));
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];

  const eventTime = Math.min(
    Math.floor((whenIso ? Date.parse(whenIso) : Date.now()) / 1000) || Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000)
  );

  const body = new URLSearchParams();
  body.set('access_token', token);
  body.set(
    'data',
    JSON.stringify([
      {
        event_name: 'Schedule',
        event_time: eventTime,
        event_id: uid, // same id the browser pixel sends → Meta dedupes
        action_source: 'website',
        event_source_url: PAGE_URL,
        user_data: userData,
      },
    ])
  );
  // Synthetic end-to-end tests (uid prefixed "e2e-test") go to Events Manager's
  // Test Events tab instead of polluting real conversion data.
  if (String(uid).startsWith('e2e-test')) {
    body.set('test_event_code', 'TEST_CLAUDE_CAPI');
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.events_received) {
    console.error('cal-webhook: Meta CAPI rejected event:', JSON.stringify(out));
    return { sent: false, reason: out };
  }
  return { sent: true };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const rawBody = event.body || '';
  const secret = process.env.CAL_WEBHOOK_SECRET;
  const sig =
    event.headers['x-cal-signature-256'] ||
    event.headers['X-Cal-Signature-256'];
  if (!signatureValid(secret, rawBody, sig)) {
    console.error('cal-webhook: invalid signature.');
    return json(401, { error: 'Invalid signature' });
  }

  let body;
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const trigger = body.triggerEvent;
  const p = body.payload || {};
  const uid = p.uid || (p.booking && p.booking.uid) || null;
  if (!uid) {
    // Nothing we can key on — acknowledge so Cal.com stops retrying.
    return json(200, { ok: true, ignored: 'no booking uid' });
  }

  const attendee = (Array.isArray(p.attendees) && p.attendees[0]) || {};
  const name = String(attendee.name || p.name || '').trim();
  const email = String(attendee.email || p.email || '').trim();
  const phone = String(
    (p.responses && p.responses.phone && p.responses.phone.value) ||
      attendee.phoneNumber ||
      ''
  ).trim();

  // ---- 1. Meta conversion (only a NEW booking is a conversion) ----
  let meta = { sent: false, reason: 'not a BOOKING_CREATED event' };
  if (trigger === 'BOOKING_CREATED') {
    try {
      meta = await sendMetaScheduleEvent({
        uid,
        name,
        email,
        phone,
        whenIso: body.createdAt || p.createdAt || null,
      });
    } catch (err) {
      console.error('cal-webhook: CAPI error:', err && err.message ? err.message : err);
      meta = { sent: false, reason: 'exception' };
    }
  }

  // ---- 2. Database mirror (best-effort; never blocks the conversion) ----
  let db = { ok: false, reason: 'no database URL configured' };
  const databaseUrl =
    process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (databaseUrl) {
    const sql = neon(databaseUrl);
    try {
      if (trigger === 'BOOKING_CANCELLED') {
        await sql`
          update consultation_bookings
             set status = 'cancelled'
           where cal_booking_uid = ${uid}
        `;
        db = { ok: true };
      } else {
        const eventType = String(p.eventTitle || p.title || '').trim();
        const startsAt = p.startTime || null;
        const endsAt = p.endTime || null;
        const timezone = String(attendee.timeZone || p.organizer?.timeZone || '').trim();
        const notes = String(
          p.additionalNotes ||
            (p.responses && p.responses.notes && p.responses.notes.value) ||
            ''
        ).trim();

        await sql`
          insert into consultation_bookings (
            cal_booking_uid, status, attendee_name, attendee_email, attendee_phone,
            event_type, starts_at, ends_at, timezone, notes
          ) values (
            ${uid}, 'booked', ${name}, ${email}, ${phone || null},
            ${eventType || null}, ${startsAt}, ${endsAt}, ${timezone || null}, ${notes || null}
          )
          on conflict (cal_booking_uid) do update set
            status = 'booked',
            attendee_name = excluded.attendee_name,
            attendee_email = excluded.attendee_email,
            attendee_phone = excluded.attendee_phone,
            event_type = excluded.event_type,
            starts_at = excluded.starts_at,
            ends_at = excluded.ends_at,
            timezone = excluded.timezone,
            notes = excluded.notes
        `;
        db = { ok: true };
      }
    } catch (err) {
      const msg = err && err.message ? String(err.message) : String(err);
      console.error('cal-webhook DB error:', msg);
      db = { ok: false, reason: msg };
    }
  } else {
    console.error('cal-webhook: no database URL configured — mirror skipped.');
  }

  // Always 200 once the signature checked out: Cal.com should not retry/disable
  // the webhook because of an internal error on our side (errors are logged).
  return json(200, { ok: true, conversion_sent: meta.sent, db_mirrored: db.ok });
};
