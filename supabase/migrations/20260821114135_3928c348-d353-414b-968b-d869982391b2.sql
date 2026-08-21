CREATE POLICY "meal images select own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meal-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "meal images insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'meal-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "meal images update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'meal-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'meal-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "meal images delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'meal-images' AND (storage.foldername(name))[1] = auth.uid()::text);