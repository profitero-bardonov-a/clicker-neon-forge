-- Old score handler sliced avatar_url to 500 chars and broke long Google photo URLs.
UPDATE scores
SET avatar_url = NULL
WHERE avatar_url IS NOT NULL
  AND length(avatar_url) = 500;
