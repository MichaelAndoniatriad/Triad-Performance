-- Run this once in the Neon SQL Editor (Dashboard → SQL Editor → New query).
-- https://neon.tech — create a project, then paste and run.

create extension if not exists "pgcrypto";

create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  fullname text not null,
  email text not null,
  reference_code text,
  occupation text,
  objective text,
  preference text,
  challenge text
);

-- Consultations booked through Cal.com. Populated by the cal-webhook
-- Netlify function on each BOOKING_CREATED / BOOKING_CANCELLED event.
create table if not exists public.consultation_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cal_booking_uid text unique,
  status text not null default 'booked',
  attendee_name text,
  attendee_email text,
  attendee_phone text,
  event_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  notes text
);

create table if not exists public.training_enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  fullname text not null,
  mobile text,
  email text not null,
  age integer,
  coaching_preference text,
  pt_gender text,
  goal text
);
