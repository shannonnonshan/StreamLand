-- Drop all tables in order (respecting foreign key constraints)

-- Drop tables with foreign keys first
DROP TABLE IF EXISTS "teacher_profiles" CASCADE;
DROP TABLE IF EXISTS "student_profiles" CASCADE;

-- Drop main tables
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "pending_registrations" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Drop enums
DROP TYPE IF EXISTS "Role" CASCADE;

-- Verify all tables are dropped
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
