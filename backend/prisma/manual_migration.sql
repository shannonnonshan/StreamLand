-- Manual SQL script to update teacher_profiles table
-- Run this in Supabase SQL Editor if Prisma migration fails

-- Add cvUrl column if not exists
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS "cvUrl" TEXT;

-- Drop certifications column if exists
ALTER TABLE teacher_profiles DROP COLUMN IF EXISTS certifications;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'teacher_profiles' 
ORDER BY ordinal_position;
