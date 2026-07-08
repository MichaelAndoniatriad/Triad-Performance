import { createHmac, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

// Receives Cal.com webhooks (BOOKING_CREATED / BOOKING_CANCELLED / BOOKING_RESCHEDULED)
// and mirrors each consultation into the Neon `consultation_bookings` table.
//
// Cal.com already emails you and adds the Google Calendar event itself — this
// function only exists to keep a queryable record in your own database.
//
// Setup: Cal.com → Settings → Developer → Webhooks → New webhook
//   Subscriber URL: https://triad.fitness/.netlify/functions/cal-webhook
//   Triggers: Booking Created, Booking Cancelled, Booking Rescheduled
//   Secret: copy the value into the CAL_WEBHOOK_SECRET env var in Netlify.

const jsonHeaders = { 'Content-Type': 'application/json' };

function json(statusCode, body) {
  return { statusCode, headers: jsonHeaders, body: JSON.stringify(body) };
}

// Cal.com signs the raw request body with HMAC-SHA256 and sends it in the
// `X-Cal-Signature-256` header. Verifying it stops anyone from POSTing fake
// bookings into your database.
function signatureValid(secret, rawBody, header) {
  if (!secret) return true; // no secret configured → skip check (not recommended)
  if (!header) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(header), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const databaseUrl =
    process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('cal-webhook: no database URL configured.');
    return json(500, { error: 'Database URL is not set' });
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

  const sql = neon(databaseUrl);

  try {
    if (trigger === 'BOOKING_CANCELLED') {
      await sql`
        update consultation_bookings
           set status = 'cancelled'
         where cal_booking_uid = ${uid}
      `;
      return json(200, { ok: true });
    }

    // BOOKING_CREATED and BOOKING_RESCHEDULED both upsert the current details.
    const attendee = (Array.isArray(p.attendees) && p.attendees[0]) || {};
    const name = String(attendee.name || p.name || '').trim();
    const email = String(attendee.email || p.email || '').trim();
    const phone = String(
      (p.responses && p.responses.phone && p.responses.phone.value) ||
        attendee.phoneNumber ||
        ''
    ).trim();
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
    return json(200, { ok: true });
  } catch (err) {
    const msg = err && err.message ? String(err.message) : String(err);
    console.error('cal-webhook DB error:', msg);
    return json(500, { error: 'Could not record booking' });
  }
};
