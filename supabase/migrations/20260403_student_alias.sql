-- Add alias column to students table for privacy/demo mode
ALTER TABLE students ADD COLUMN IF NOT EXISTS alias TEXT DEFAULT NULL;
