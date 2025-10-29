-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN "cvUrl" TEXT;

-- DropColumn
ALTER TABLE "teacher_profiles" DROP COLUMN "certifications";
