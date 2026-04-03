# Forms: Neon + Netlify (simplest migration from Supabase)

Your questionnaire and enquiry forms POST to **one Netlify function**, which inserts rows into **Neon Postgres**. The database password never touches the browser.

## Even easier (if you had not migrated yet)

Supabase free tier is **per project**. Creating a **new Supabase project** only for Triad would give you a fresh database without code changes. This repo is now wired for Neon instead; use the steps below for the current setup.

## One-time setup (about 10 minutes)

1. **Neon** — [neon.tech](https://neon.tech): create a project and open **SQL Editor**.
2. Copy everything from **`database/schema.sql`** in this repo, paste into the editor, and **Run** (creates `consultation_requests` and `training_enquiries`).
3. Copy the **connection string** from Neon (use the **pooled / serverless** URI if Neon shows more than one).
4. **Netlify** — either:
   - **Integrations → Neon** (recommended): Netlify sets **`NETLIFY_DATABASE_URL`** automatically; you do not need **`DATABASE_URL`**, or  
   - **Environment variables** → add **`DATABASE_URL`** manually with your Neon connection string.  
   Our function reads **`NETLIFY_DATABASE_URL` first**, then **`DATABASE_URL`**.
5. **Deploy** the site (push to Git or trigger a deploy). The build runs `npm run build` and publishes `public`.

## Check it works

Submit the consultation form and the enquiry form on the live site, then open **Neon** → **Tables** (or SQL) and confirm new rows.

## Local preview

- `npm run dev` — static files only; **form submit will fail** (no function).
- Install [Netlify CLI](https://docs.netlify.com/cli/get-started/), link the site, add `DATABASE_URL` to a root `.env`, then run:

  ```bash
  netlify dev
  ```

  Forms will POST to the local function and write to Neon.

## Email notifications

The old Supabase triggers + Edge Functions are **not** used anymore. To get emails on new leads, add a step inside `netlify/functions/submit-lead.mjs` (e.g. Resend) or use a Neon / Zapier integration.
