-- Create storage bucket for file thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  true,  -- Public bucket for easy access
  1048576,  -- 1MB max (thumbnails should be small)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload thumbnails
CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails');

-- Allow public read access to thumbnails
CREATE POLICY "Public read access to thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails');

-- Allow users to delete their own thumbnails
CREATE POLICY "Users can delete own thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add local_thumbnail_url column to project_files for client-generated thumbnails
ALTER TABLE project_files
ADD COLUMN IF NOT EXISTS local_thumbnail_url TEXT;

COMMENT ON COLUMN project_files.local_thumbnail_url IS 'Client-generated thumbnail stored in Supabase storage';

-- Add local_thumbnail_url column to presales_files
ALTER TABLE presales_files
ADD COLUMN IF NOT EXISTS local_thumbnail_url TEXT;

COMMENT ON COLUMN presales_files.local_thumbnail_url IS 'Client-generated thumbnail stored in Supabase storage';
