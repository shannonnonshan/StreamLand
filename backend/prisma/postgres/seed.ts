import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PostgreSQL database...');

  // Create sample teacher
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@streamland.com' },
    update: {},
    create: {
      email: 'teacher@streamland.com',
      password: '$2b$10$YourHashedPasswordHere', // Remember to hash properly
      fullName: 'David Nguyen',
      role: 'TEACHER',
      isVerified: true,
      teacherProfile: {
        create: {
          subjects: ['English', 'IELTS'],
          experience: 5,
          education: 'Master in English Literature',
        },
      },
    },
  });

  // Create sample student
  const student = await prisma.user.upsert({
    where: { email: 'student@streamland.com' },
    update: {},
    create: {
      email: 'student@streamland.com',
      password: '$2b$10$YourHashedPasswordHere',
      fullName: 'Minh Anh',
      role: 'STUDENT',
      isVerified: true,
      studentProfile: {
        create: {
          school: 'Nguyen Hue High School',
          grade: '12A1',
          interests: ['English', 'Programming', 'Mathematics'],
        },
      },
    },
  });

  console.log('✅ PostgreSQL seeding completed!');
  console.log({ teacher, student });
}

main()
  .catch((e) => {
    console.error('❌ PostgreSQL seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
