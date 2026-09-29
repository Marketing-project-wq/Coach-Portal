-- Enable multi-unit access for Coach Calysta and Coach Faya
-- Both coaches teach in Arena AND Gym, so they need access to both units.
-- Setting unit = null gives them ['arena', 'gym'] via allowedUnitCodes().
--
-- Also explicitly lock other external coaches to 'arena' so that the removal
-- of the external-coach early return in allowedUnitCodes() does not give them
-- unintended Gym access (they previously relied on the hardcoded Arena-only check).

-- 1. Calysta: gym → null (both units)
-- 2. Faya: arena → null (both units)
UPDATE arena_coach_users SET unit = null, updated_at = now()
WHERE coach_name IN ('Calysta', 'Faya');

-- 3. Lock other external coaches to arena explicitly
-- (brian, gilang, mae, sakha, ista, asa, andrew)
UPDATE arena_coach_users SET unit = 'arena', updated_at = now()
WHERE LOWER(coach_name) IN ('brian', 'gilang', 'mae', 'sakha', 'ista', 'asa', 'andrew')
  AND (unit IS NULL OR unit != 'arena');
