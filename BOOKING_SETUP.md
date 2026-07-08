# Consultation booking (Cal.com + Google Calendar)

Consultations are booked through **Cal.com** — a free, calendar-synced scheduler
embedded in `public/social.html`. It works like Motion did: the open slots on the
page come straight from your real calendar, so when your working hours change (or
you add an event), the available times update on their own.

Every booking:
- **emails you** (Cal.com does this automatically), ✓
- **creates a Google Calendar event** (automatic once Google Calendar is connected), ✓
- **saves a row in your Neon database** via the `cal-webhook` function. ✓

## One-time setup (~10 minutes)

### 1. Create the Cal.com account
1. Sign up free at [cal.com](https://cal.com).
2. Pick a username — e.g. **`coachmichael`**. This becomes part of your
   booking link (`cal.com/coachmichael/...`).

### 2. Connect your Google Calendar (this is what makes slots sync)
1. Cal.com → **Settings → Apps / Calendars → Google Calendar → Connect**.
2. Set it as the calendar Cal.com **checks for conflicts** and **writes events to**.
   Now anything on your Google Calendar blocks that slot, and every booking lands
   on your calendar automatically.

### 3. Set your working hours (availability)
1. Cal.com → **Availability** → create/edit a schedule (e.g. Mon–Fri 9–5).
2. Whenever you change these hours, the bookable slots on the site change to match.
   Busy times pulled from Google Calendar are removed on top of this.

### 4. Create the event type
1. Cal.com → **Event Types → New**.
2. Title it **Consultation**, set the length (e.g. 30 min), free/£0.
3. Note its link slug — the full link looks like `coachmichael/consultation`.

### 5. Point the site at your link
- In [`public/social.html`](public/social.html), find `calLink: "coachmichael/consultation"`
  in the Cal.com embed and replace it with **your** `username/event-slug`.
- If you kept the username `coachmichael` and event slug `consultation`, no
  change is needed.

### 6. (Optional) Save bookings to your database
Cal.com already emails you and adds the calendar event, so this step is only for
keeping a queryable record in Neon.

1. In Neon → SQL Editor, run `database/schema.sql` (it now includes the
   `consultation_bookings` table). Re-running is safe — it uses `create table if not exists`.
2. Cal.com → **Settings → Developer → Webhooks → New**:
   - **Subscriber URL:** `https://triad.fitness/.netlify/functions/cal-webhook`
   - **Triggers:** Booking Created, Booking Cancelled, Booking Rescheduled
   - **Secret:** generate one, then add it in Netlify → **Environment variables**
     as **`CAL_WEBHOOK_SECRET`** (same value). This stops fake bookings being
     POSTed to your database.
3. Redeploy the site so the `cal-webhook` function picks up the env var.

## Check it works
Open the live site, book a test slot, and confirm you get the email, the event
appears on Google Calendar, and (if you did step 6) a row appears in Neon under
`consultation_bookings`.

## Switching back / trying another tool
The embed is a self-contained block between `<!-- Cal.com embed begin -->` and
`<!-- Cal.com embed end -->` in `public/social.html`. Swapping schedulers is just
replacing that block.
