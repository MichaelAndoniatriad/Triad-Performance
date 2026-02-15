# Connect TRIAD PERFORMANCE to Supabase

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in or create an account.
2. Click **New project**, choose your org, name it (e.g. `triad-performance`), set a database password, and create the project.

## 2. Create the table

1. In the Supabase dashboard, open **SQL Editor**.
2. Click **New query**.
3. Copy the contents of `supabase/schema.sql` and paste into the editor.
4. Click **Run**. You should see “Success” and the table `consultation_requests` will exist.

## 3. Get your API keys

1. In the dashboard go to **Project Settings** (gear icon) → **API**.
2. Copy **Project URL** and the **anon public** key.

## 4. Add secrets to .env

1. Open the **.env** file in the project root (create from **.env.example** if needed).
2. Set your values (no quotes needed):

   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Save the file. **.env** is gitignored so your keys are never committed.

## 5. Build the questionnaire

The live questionnaire is generated from the template and your .env:

```bash
npm run build
```

This creates **public/questionnaire.html** with your Supabase config. That file is also gitignored so it is not committed.

- **Locally:** Run `npm run build` whenever you change .env or the template. Use the generated **public/questionnaire.html** when testing.
- **Netlify:** In Site settings → Environment variables, add **SUPABASE_URL** and **SUPABASE_ANON_KEY**. Set the build command to **npm run build** and keep the publish directory **public**. Each deploy will build the questionnaire with the env vars.

## 6. (Optional) Stop tracking the built file

If **public/questionnaire.html** was previously committed (e.g. with keys in it), remove it from Git and rely on the build:

```bash
git rm --cached public/questionnaire.html
git commit -m "Stop tracking questionnaire.html; use build from .env"
```

## 7. Test

1. Run `npm run build`, then open the questionnaire page (e.g. open **public/index.html** and click through to the form, or open **public/questionnaire.html** directly).
2. Submit the form.
3. In Supabase go to **Table Editor** → **consultation_requests** and confirm the new row.

## 8. Email notifications (Resend, free tier)

1. Create a free Resend account: https://resend.com and generate an API key.
2. Set Supabase secrets:

```bash
supabase secrets set \
  RESEND_API_KEY=your_resend_key \
  NOTIFY_EMAIL=contact@triad.fitness \
  FROM_EMAIL="noreply@resend.dev" \
  REPLY_TO_EMAIL="contact@triad.fitness"
```

3. Deploy the function:

```bash
supabase functions deploy send-consultation-notification
```

4. Make the function public (no JWT) by keeping `supabase/functions/send-consultation-notification/config.toml` with:

```
[function]
verify_jwt = false
```

Then redeploy the function if you change this file.

5. Create the database trigger (replace placeholders in `supabase/notify_consultation.sql`, then run it in the Supabase SQL Editor):

- `<project-ref>`: from your Supabase project URL
- `<anon-key>`: your anon public key

6. Submit the form and verify the email arrives.

## Security note

The **anon** key is safe in the browser. RLS allows anonymous **insert** and only authenticated **select**. Never put the **service_role** key in .env if it could be used in front-end code; use it only in server-side or secure back-office tools.
