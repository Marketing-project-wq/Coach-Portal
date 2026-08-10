-- Create the internal coach account for Kiki (Ariany Risky)
-- Login (username OR email): arianyrisky@20fit.id
-- Password:                   kiki20fit
-- Role:                       coach  (internal — "Kiki" is NOT in server.js EXTERNAL_COACHES,
--                             so she gets the full internal-coach workspace, incl. participant data)
-- coach_name:                 "Kiki"  → matches the `instructor` column in arena_class_schedules
--                             ("Kiki", "Kiki ", "Kiki & Mae"), so her classes show up.
--
-- This account was created against the live Supabase project (20FIT ALL DATA). This script is the
-- version-controlled record and is safe to re-run. The password_hash below is a scrypt hash
-- generated with the same algorithm as server.js hashPassword() and verified to match "kiki20fit".

insert into arena_coach_users
  (username, password_hash, password_plain, coach_name, display_name, role, email, phone, is_active)
values
  ( 'arianyrisky@20fit.id',
    'scrypt$a4ba18bbdb9c592a36c5906485b0c3ea$6cc29708dbaef40a81fa6b59c5d8fb7a0473f20abe1255b8aa71479848ddd413',
    'kiki20fit',
    'Kiki',
    'Kiki',
    'coach',
    'arianyrisky@20fit.id',
    null,
    true )
on conflict (username) do update set
  password_hash = excluded.password_hash,
  password_plain = excluded.password_plain,
  coach_name     = excluded.coach_name,
  display_name   = excluded.display_name,
  role           = excluded.role,
  email          = excluded.email,
  is_active      = true,
  updated_at     = now();
