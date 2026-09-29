-- Enable multi-unit access for Coach Calysta and Coach Faya
-- Both coaches teach in Arena AND Gym, so they need access to both units.
-- Setting unit = 'both' gives them ['arena', 'gym'] via allowedUnitCodes().
-- Coaches with unit = NULL default to arena-only (safe default).

-- 1. Calysta & Faya: set to 'both' (arena + gym)
UPDATE arena_coach_users SET unit = 'both', updated_at = now()
WHERE coach_name IN ('Calysta', 'Faya');
