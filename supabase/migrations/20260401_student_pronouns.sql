-- Add pronouns column to students table
-- Stores teacher-set pronouns for a student (e.g. 'he/him', 'she/her', 'they/them')
-- NULL means unset — AI will guess based on first name
ALTER TABLE students ADD COLUMN IF NOT EXISTS pronouns text DEFAULT NULL;
