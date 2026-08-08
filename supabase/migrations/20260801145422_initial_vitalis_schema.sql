begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  preferred_name text,
  timezone text not null default 'America/Sao_Paulo',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 120),
  constraint profiles_preferred_name_length check (
    preferred_name is null or char_length(btrim(preferred_name)) between 1 and 60
  )
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  dosage text not null,
  instructions text,
  interval_hours smallint not null,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  color_token text not null default 'blue',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medications_id_user_unique unique (id, user_id),
  constraint medications_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint medications_dosage_length check (char_length(btrim(dosage)) between 1 and 80),
  constraint medications_instructions_length check (
    instructions is null or char_length(instructions) <= 500
  ),
  constraint medications_interval_hours_range check (interval_hours between 1 and 24),
  constraint medications_date_range check (end_date is null or end_date >= start_date),
  constraint medications_color_token check (color_token in ('blue', 'mint', 'amber', 'coral', 'violet'))
);

create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  medication_id uuid not null,
  dose_time time not null,
  created_at timestamptz not null default now(),
  constraint medication_schedules_medication_user_fkey
    foreign key (medication_id, user_id)
    references public.medications (id, user_id)
    on delete cascade,
  constraint medication_schedules_unique_time unique (medication_id, dose_time)
);

create table public.dose_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  medication_id uuid not null,
  scheduled_for timestamptz not null,
  status text not null,
  taken_at timestamptz,
  snoozed_until timestamptz,
  source text not null default 'app',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dose_events_medication_user_fkey
    foreign key (medication_id, user_id)
    references public.medications (id, user_id)
    on delete cascade,
  constraint dose_events_unique_schedule unique (medication_id, scheduled_for),
  constraint dose_events_status check (status in ('taken', 'skipped', 'missed', 'snoozed')),
  constraint dose_events_source check (source in ('app', 'hub', 'system')),
  constraint dose_events_taken_at check (status <> 'taken' or taken_at is not null),
  constraint dose_events_snoozed_until check (status <> 'snoozed' or snoozed_until is not null),
  constraint dose_events_notes_length check (notes is null or char_length(notes) <= 500)
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Conversa com a Vitalis',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_sessions_id_user_unique unique (id, user_id),
  constraint chat_sessions_title_length check (char_length(btrim(title)) between 1 and 120)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null,
  role text not null,
  content text not null,
  intent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chat_messages_session_user_fkey
    foreign key (session_id, user_id)
    references public.chat_sessions (id, user_id)
    on delete cascade,
  constraint chat_messages_role check (role in ('user', 'assistant', 'system')),
  constraint chat_messages_content_length check (char_length(btrim(content)) between 1 and 4000),
  constraint chat_messages_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index medications_user_active_idx
  on public.medications (user_id, is_active);

create index medication_schedules_user_time_idx
  on public.medication_schedules (user_id, dose_time);

create index dose_events_user_scheduled_idx
  on public.dose_events (user_id, scheduled_for desc);

create index dose_events_medication_scheduled_idx
  on public.dose_events (medication_id, scheduled_for desc);

create index chat_sessions_user_updated_idx
  on public.chat_sessions (user_id, updated_at desc);

create index chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, preferred_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuário Vitalis'
    ),
    nullif(btrim(new.raw_user_meta_data ->> 'preferred_name'), '')
  );
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger medications_set_updated_at
before update on public.medications
for each row execute function private.set_updated_at();

create trigger dose_events_set_updated_at
before update on public.dose_events
for each row execute function private.set_updated_at();

create trigger chat_sessions_set_updated_at
before update on public.chat_sessions
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.dose_events enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy medications_select_own
on public.medications for select
to authenticated
using ((select auth.uid()) = user_id);

create policy medications_insert_own
on public.medications for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy medications_update_own
on public.medications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy medications_delete_own
on public.medications for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy medication_schedules_select_own
on public.medication_schedules for select
to authenticated
using ((select auth.uid()) = user_id);

create policy medication_schedules_insert_own
on public.medication_schedules for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy medication_schedules_update_own
on public.medication_schedules for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy medication_schedules_delete_own
on public.medication_schedules for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy dose_events_select_own
on public.dose_events for select
to authenticated
using ((select auth.uid()) = user_id);

create policy dose_events_insert_own
on public.dose_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy dose_events_update_own
on public.dose_events for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy dose_events_delete_own
on public.dose_events for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy chat_sessions_select_own
on public.chat_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy chat_sessions_insert_own
on public.chat_sessions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy chat_sessions_update_own
on public.chat_sessions for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy chat_sessions_delete_own
on public.chat_sessions for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy chat_messages_select_own
on public.chat_messages for select
to authenticated
using ((select auth.uid()) = user_id);

create policy chat_messages_insert_own
on public.chat_messages for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy chat_messages_delete_own
on public.chat_messages for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.profiles from anon;
revoke all on public.medications from anon;
revoke all on public.medication_schedules from anon;
revoke all on public.dose_events from anon;
revoke all on public.chat_sessions from anon;
revoke all on public.chat_messages from anon;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.medications to authenticated;
grant select, insert, update, delete on public.medication_schedules to authenticated;
grant select, insert, update, delete on public.dose_events to authenticated;
grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert, delete on public.chat_messages to authenticated;

commit;
