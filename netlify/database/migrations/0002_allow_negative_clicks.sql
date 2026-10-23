-- Allow negative click scores (misses subtract).
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_clicks_check;
