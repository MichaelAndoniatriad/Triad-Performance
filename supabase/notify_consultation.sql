-- Send an email notification on new consultation_requests rows.
-- Replace <project-ref> before running.

create extension if not exists http;

create or replace function public.notify_consultation_request()
returns trigger as $$
begin
  perform http_post(
    'https://humehjimfdvodfgsougx.functions.supabase.co/send-consultation-notification',
    jsonb_build_object('record', row_to_json(NEW))::text,
    'application/json'
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists consultation_request_email on public.consultation_requests;

create trigger consultation_request_email
after insert on public.consultation_requests
for each row execute function public.notify_consultation_request();
