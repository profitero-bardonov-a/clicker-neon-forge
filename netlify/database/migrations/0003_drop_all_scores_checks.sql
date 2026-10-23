-- Force-drop any CHECK on scores.clicks (CLI deploys may skip migrations).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'scores'
      AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE scores DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;
