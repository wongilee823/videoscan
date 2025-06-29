-- Storage bucket policies for frames and PDFs
-- Run these after creating the buckets in Supabase Dashboard

-- Frames bucket policies
CREATE POLICY "Users can upload frames" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'frames' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own frames" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'frames' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own frames" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'frames' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- PDFs bucket policies
CREATE POLICY "Users can upload PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own PDFs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own PDFs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );