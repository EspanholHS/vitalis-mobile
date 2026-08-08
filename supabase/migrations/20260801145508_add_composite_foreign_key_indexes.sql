create index chat_messages_session_user_fk_idx
  on public.chat_messages (session_id, user_id);

create index dose_events_medication_user_fk_idx
  on public.dose_events (medication_id, user_id);

create index medication_schedules_medication_user_fk_idx
  on public.medication_schedules (medication_id, user_id);
