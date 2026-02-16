-- Send an email notification on new training_enquiries rows.
-- Replace <project-ref> before running if needed.

create extension if not exists http;

create or replace function public.notify_training_enquiry()
returns trigger as $$
begin
  perform http_post(
    'https://humehjimfdvodfgsougx.functions.supabase.co/send-training-enquiry-notification',
    jsonb_build_object('record', row_to_json(NEW))::text,
    'application/json'
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists training_enquiry_email on public.training_enquiries;

create trigger training_enquiry_email
after insert on public.training_enquiries
for each row execute function public.notify_training_enquiry();
