-- GRO per-participant attendance note (shown in the detailed attendance report).
-- Run once in the Supabase SQL editor.
alter table public.arena_class_attendance add column if not exists note text;
-- Allow "un-click" to clear the check-in while keeping any note on the row.
alter table public.arena_class_attendance alter column status drop not null;
