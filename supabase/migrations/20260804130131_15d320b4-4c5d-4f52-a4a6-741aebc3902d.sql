CREATE POLICY "Users can upload own schedule images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'schedule-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own schedule images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'schedule-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own schedule images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'schedule-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'schedule-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own schedule images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'schedule-images' AND (storage.foldername(name))[1] = auth.uid()::text);