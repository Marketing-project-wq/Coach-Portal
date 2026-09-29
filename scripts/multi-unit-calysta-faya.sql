-- Enable multi-unit access for Coach Calysta
-- Calysta teaches in Arena AND Gym, so she needs access to both units.
-- Setting unit = 'both' gives her ['arena', 'gym'] via allowedUnitCodes().
-- Coaches with unit = NULL default to arena-only (safe default).

UPDATE arena_coach_users SET unit = 'both', updated_at = now()
WHERE coach_name = 'Calysta';
