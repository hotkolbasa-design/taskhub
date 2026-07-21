-- Allow all MIME types in task-attachments bucket (was previously image-only)
-- and raise file size limit to 25MB
UPDATE storage.buckets
SET
  allowed_mime_types = NULL,
  file_size_limit    = 26214400
WHERE id = 'task-attachments';
