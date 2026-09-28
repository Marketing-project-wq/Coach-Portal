-- Create the external coach account for Faya (Nafra Faiza)
-- Login (username OR email): nafra.faiza@ui.ac.id
-- Password:                   faya0809
-- Role:                       coach  (external — Arena-only)
-- Unit:                       arena  (restricts access to Arena screens only)
-- coach_name:                 "Faya"  → matches the `instructor` column in arena_class_schedules
--
-- Faya is added to the EXTERNAL_COACHES set in server.js (same as brian, gilang, mae, etc.)
-- which limits her to Schedule, Monitoring, and Rotation screens only.
--
-- This script is the version-controlled record and is safe to re-run.
-- The password_hash below is a scrypt hash generated with the same algorithm as
-- server.js hashPassword() and verified to match "faya0809".

insert into arena_coach_users
  (username, password_hash, password_plain, coach_name, display_name, role, email, phone, is_active, unit)
values
  ( 'nafra.faiza@ui.ac.id',
    'scrypt$0309400fad433e24322714ad035737aa$a8c39530f1fd49083157529a4c0e4cdb47e0e554400f5b2f945162a4dbb14dca',
    'faya0809',
    'Faya',
    'Faya',
    'coach',
    'nafra.faiza@ui.ac.id',
    null,
    true,
    'arena' )
on conflict (username) do update set
  password_hash  = excluded.password_hash,
  password_plain = excluded.password_plain,
  coach_name     = excluded.coach_name,
  display_name   = excluded.display_name,
  role           = excluded.role,
  email          = excluded.email,
  is_active      = true,
  unit           = excluded.unit,
  updated_at     = now();
