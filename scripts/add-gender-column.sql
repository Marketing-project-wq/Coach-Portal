-- Add gender column to arena_class_bookings and gym_class_bookings
-- Values: 'Male', 'Female', or NULL (unknown)
-- Safe to re-run (IF NOT EXISTS).

ALTER TABLE arena_class_bookings ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE gym_class_bookings ADD COLUMN IF NOT EXISTS gender text;
