-- Adds the check-out timestamp to coach class sessions so the monthly
-- "Rekap Sesi Coach" report can total actual teaching hours.
-- Safe & additive: existing rows keep checkout_at = NULL until the next check-out.
-- Run once in the Supabase SQL editor (project: 20FIT ALL DATA).

ALTER TABLE arena_class_sessions
  ADD COLUMN IF NOT EXISTS checkout_at timestamptz;
