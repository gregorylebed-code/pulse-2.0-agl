-- Add photo_url column to students table for Google Classroom profile photos
alter table students add column if not exists photo_url text;
