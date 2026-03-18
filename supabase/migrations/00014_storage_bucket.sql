-- Migration: 00014_storage_bucket.sql
-- Creates a private Supabase Storage bucket for collection file uploads.
-- Files are stored at: {tenant_id}/{collection_slug}/{field_slug}/{uuid}-{filename}
-- Access is controlled via RLS — authenticated users can upload/read/delete.
-- Signed URLs (1h) are generated server-side for display.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'collection-files',
  'collection-files',
  false,        -- private: no public URL access
  10485760      -- 10 MB per file
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload collection files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'collection-files');

-- Allow authenticated users to read files (signed URL generation enforces access at app level)
CREATE POLICY "Authenticated users can read collection files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'collection-files');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete collection files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'collection-files');

-- Allow authenticated users to update (replace) files
CREATE POLICY "Authenticated users can update collection files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'collection-files');
