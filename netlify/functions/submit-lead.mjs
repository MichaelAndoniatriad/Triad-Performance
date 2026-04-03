import { neon } from '@neondatabase/serverless';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    return json(500, { error: 'Server configuration error' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const form = body.form;
  const sql = neon(databaseUrl);

  try {
    if (form === 'consultation') {
      const d = body.data || {};
      const fullname = String(d.fullname || '').trim();
      const email = String(d.email || '').trim();
      if (!fullname || !email) {
        return json(400, { error: 'Name and email are required' });
      }
      await sql`
        insert into consultation_requests (
          fullname, email, reference_code, occupation, objective, preference, challenge
        ) values (
          ${fullname},
          ${email},
          ${String(d.reference_code || '').trim()},
          ${String(d.occupation || '').trim()},
          ${String(d.objective || '').trim()},
          ${String(d.preference || '').trim()},
          ${String(d.challenge || '').trim()}
        )
      `;
      return json(200, { ok: true });
    }

    if (form === 'enquiry') {
      const d = body.data || {};
      const fullname = String(d.fullname || '').trim();
      const email = String(d.email || '').trim();
      if (!fullname || !email) {
        return json(400, { error: 'Name and email are required' });
      }
      const ageRaw = d.age;
      const age =
        ageRaw === '' || ageRaw === null || ageRaw === undefined
          ? null
          : Number(ageRaw);
      if (age !== null && (!Number.isFinite(age) || age < 1 || age > 120)) {
        return json(400, { error: 'Invalid age' });
      }

      await sql`
        insert into training_enquiries (
          fullname, mobile, email, age, coaching_preference, pt_gender, goal
        ) values (
          ${fullname},
          ${String(d.mobile || '').trim()},
          ${email},
          ${age},
          ${String(d.coaching_preference || '').trim()},
          ${String(d.pt_gender || '').trim()},
          ${String(d.goal || '').trim()}
        )
      `;
      return json(200, { ok: true });
    }

    return json(400, { error: 'Unknown form type' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Could not save your submission. Please try again.' });
  }
};
