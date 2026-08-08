create or replace function private.prevent_future_dose_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.scheduled_for > now() then
    raise exception using
      errcode = '22023',
      message = 'future_dose_event_not_allowed',
      hint = 'A dose can only be recorded at or after its scheduled time.';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_future_dose_event() from public, anon, authenticated;

drop trigger if exists dose_events_prevent_future_record on public.dose_events;
create trigger dose_events_prevent_future_record
before insert or update of scheduled_for, status on public.dose_events
for each row
execute function private.prevent_future_dose_event();

-- Remove states created by the former client bug before enforcing the invariant.
delete from public.dose_events
where scheduled_for > now();
