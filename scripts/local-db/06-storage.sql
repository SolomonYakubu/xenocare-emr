INSERT INTO storage.buckets (id, name, public)
VALUES ('radiology-images', 'radiology-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS radiology_images_select ON storage.objects;
DROP POLICY IF EXISTS radiology_images_insert ON storage.objects;
DROP POLICY IF EXISTS radiology_images_update ON storage.objects;
DROP POLICY IF EXISTS radiology_images_delete ON storage.objects;

CREATE POLICY radiology_images_select ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'radiology-images');
CREATE POLICY radiology_images_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'radiology-images');
CREATE POLICY radiology_images_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'radiology-images')
  WITH CHECK (bucket_id = 'radiology-images');
CREATE POLICY radiology_images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'radiology-images');
