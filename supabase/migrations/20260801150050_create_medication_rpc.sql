create or replace function public.create_medication_with_schedules(
  p_name text,
  p_dosage text,
  p_instructions text,
  p_interval_hours smallint,
  p_start_date date,
  p_end_date date,
  p_color_token text,
  p_dose_times time[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_medication_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(cardinality(p_dose_times), 0) = 0 then
    raise exception 'At least one dose time is required';
  end if;

  insert into public.medications (
    user_id,
    name,
    dosage,
    instructions,
    interval_hours,
    start_date,
    end_date,
    color_token
  )
  values (
    v_user_id,
    p_name,
    p_dosage,
    nullif(btrim(p_instructions), ''),
    p_interval_hours,
    p_start_date,
    p_end_date,
    p_color_token
  )
  returning id into v_medication_id;

  insert into public.medication_schedules (user_id, medication_id, dose_time)
  select v_user_id, v_medication_id, dose_time
  from (
    select distinct unnest(p_dose_times) as dose_time
  ) as unique_times;

  return v_medication_id;
end;
$$;

revoke all on function public.create_medication_with_schedules(
  text, text, text, smallint, date, date, text, time[]
) from public, anon;

grant execute on function public.create_medication_with_schedules(
  text, text, text, smallint, date, date, text, time[]
) to authenticated;
