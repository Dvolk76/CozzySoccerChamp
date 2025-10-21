-- Idempotent migration for SQLite (Cloudflare D1)
-- Adds tournament picks to User and bonusPoints to Score

-- Add championPick column if not exists
ALTER TABLE User ADD COLUMN championPick TEXT;

-- Add topScorerPick column if not exists
ALTER TABLE User ADD COLUMN topScorerPick TEXT;

-- Add bonusPoints column if not exists
ALTER TABLE Score ADD COLUMN bonusPoints INTEGER NOT NULL DEFAULT 0;


