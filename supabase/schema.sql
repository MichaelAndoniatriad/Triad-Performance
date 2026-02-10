-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Creates the table for questionnaire submissions

create table if not exists consultation_requests (
  id uuid primary key default gen_random_uuid(),
  fullname text not null,
  email text not null,
  reference_code text,
  occupation text not null,
  objective text not null,
  preference text not null,
  challenge text not null,
  created_at timestamptz default now()
);

-- Allow anonymous inserts (e.g. from your site) and optionally restrict who can read
alter table consultation_requests enable row level security;

create policy "Allow anonymous insert"
  on consultation_requests
  for insert
  to anon
  with check (true);

-- Only authenticated users (e.g. you via dashboard or service role) can read
create policy "Allow authenticated read"
  on consultation_requests
  for select
  to authenticated
  using (true);

-- Optional: allow service role full access (for backend/admin)
-- create policy "Service role all"
--   on consultation_requests for all to service_role using (true) with check (true);
