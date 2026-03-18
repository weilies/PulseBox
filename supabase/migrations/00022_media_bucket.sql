-- Migration: 00022_media_bucket.sql
-- Creates a private general-purpose media bucket for platform files (avatars, logos, etc.)
-- Not tied to collection items. Access controlled via RLS.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'media',
  'media',
  false,        -- private: signed URL access only
  5242880       -- 5 MB per file
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Authenticated users can read media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can delete media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can update media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'media');

-- Add avatar_path to profiles (stores path in the 'media' bucket)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_path text;
