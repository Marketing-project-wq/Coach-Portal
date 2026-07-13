-- Create the GRO Arena account (Guest Relations Officer)
-- Username (login): "GRO Arena"  → stored lowercased as "gro arena" (login lowercases input)
-- Password:         20fitarena
-- Role:             gro  (sees ALL participants, checks them in, sees full schedule with pax + running status)
--
-- Run this once in the Supabase SQL editor. The password_hash below is a scrypt hash
-- generated with the same algorithm as server.js hashPassword() and verified to match "20fitarena".

insert into arena_coach_users
  (username, password_hash, password_plain, coach_name, display_name, role, email, phone, is_active)
values
  ( 'gro arena',
    'scrypt$881d46214176298493e50d18f26ca97b$66425ae9b679ee5c4b4d26333cf599f78246c7f0190360e1e1e6ef749e0154fa',
    '20fitarena',
    'GRO Arena',
    'GRO Arena',
    'gro',
    'gro@20fit.id',
    null,
    true )
on conflict (username) do update set
  password_hash = excluded.password_hash,
  password_plain = excluded.password_plain,
  role           = excluded.role,
  display_name   = excluded.display_name,
  is_active      = true;
