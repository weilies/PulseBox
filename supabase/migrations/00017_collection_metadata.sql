-- Add metadata JSONB column to collections for storing translations
-- (name_translations, description_translations) and future extensibility.
ALTER TABLE collections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
