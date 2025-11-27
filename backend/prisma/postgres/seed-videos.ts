import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Shared recording URLs to save R2 storage (only 5 actual video files needed)
 * Different livestream titles will reuse these URLs based on category
 */
const SHARED_RECORDING_URLS = {
  English: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/english.mp4',
  Mathematics: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/calculus.mp4',
  Chemistry: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/chemistry.mp4',
  Physics: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/physics.mp4',
  Law: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/law.mp4',
};

const SAMPLE_VIDEOS = [
  {
    title: 'Introduction to IELTS Speaking Part 1',
    duration: 220,
    category: 'English',
  },
  {
    title: 'Calculus Fundamentals - Derivatives',
    duration: 215,
    category: 'Mathematics',
  },
  {
    title: 'Organic Chemistry - Reaction Mechanisms',
    duration: 230,
    category: 'Chemistry',
  },
  {
    title: 'Physics - Newton\'s Laws of Motion',
    duration: 210,
    category: 'Physics',
  },
  {
    title: 'Introduction to Constitutional Law',
    duration: 225,
    category: 'Law',
  },
];

async function seedLivestreamsWithVideos() {
  console.log('📹 Seeding livestreams with sample recorded videos...');

  // Get all teachers
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    include: { teacherProfile: true },
  });

  if (teachers.length === 0) {
    console.log('⚠️  No teachers found. Please run main seed first.');
    return;
  }

  // Create past livestreams with recordings for each teacher
  for (const teacher of teachers) {
    for (let i = 0; i < SAMPLE_VIDEOS.length; i++) {
      const video = SAMPLE_VIDEOS[i];
      
      // Create past dates (1-7 days ago)
      const daysAgo = i + 1;
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() - daysAgo);
      scheduledAt.setHours(14, 0, 0, 0);
      
      const startedAt = new Date(scheduledAt);
      startedAt.setMinutes(startedAt.getMinutes() + 2); // Started 2 min after scheduled
      
      const endedAt = new Date(startedAt);
      endedAt.setSeconds(endedAt.getSeconds() + video.duration);

      try {
        const livestream = await prisma.liveStream.create({
          data: {
            teacherId: teacher.id,
            title: video.title,
            description: `A comprehensive ${video.category} lesson covering key concepts and practical examples.`,
            category: video.category,
            thumbnail: `https://i.pravatar.cc/400?img=${10 + i}`, // Placeholder thumbnail
            status: 'ENDED',
            recordingUrl: SHARED_RECORDING_URLS[video.category as keyof typeof SHARED_RECORDING_URLS],
            scheduledAt,
            startedAt,
            endedAt,
            duration: video.duration,
            currentViewers: 0,
            totalViews: Math.floor(Math.random() * 500) + 100, // 100-600 views
            peakViewers: Math.floor(Math.random() * 50) + 20, // 20-70 peak viewers
            isRecorded: true,
            isPublic: true,
            allowComments: true,
            allowQuestions: true,
            chatMode: 'EVERYONE',
          },
        });

        console.log(`✅ Created recorded livestream: ${livestream.title} (${teacher.fullName})`);
      } catch (error) {
        console.error(`❌ Error creating livestream for ${teacher.fullName}:`, error);
      }
    }
  }

  console.log('✨ Livestream video seeding completed!');
}

async function seedSchedules() {
  console.log('📅 Seeding upcoming scheduled livestreams and events...');

  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    include: { teacherProfile: true },
  });

  if (teachers.length === 0) {
    console.log('⚠️  No teachers found. Please run main seed first.');
    return;
  }

  const scheduleTemplates = [
    // Scheduled livestreams
    {
      title: 'IELTS Speaking Practice Session',
      description: 'Join us for an interactive speaking practice with real exam scenarios.',
      category: 'English',
      color: '#3B82F6',
      tags: ['IELTS', 'Speaking', 'English'],
      daysFromNow: 2,
      hour: 14,
      duration: 60,
      notifyBefore: 30,
      maxParticipants: 50,
      isPublic: true,
    },
    {
      title: 'Advanced Calculus Workshop',
      description: 'Deep dive into integration techniques and applications.',
      category: 'Mathematics',
      color: '#10B981',
      tags: ['Calculus', 'Math', 'Integration'],
      daysFromNow: 3,
      hour: 16,
      duration: 90,
      notifyBefore: 15,
      maxParticipants: 30,
      isPublic: false, // Subscribers only
    },
    {
      title: 'Chemistry Lab Demonstration',
      description: 'Live demonstration of key organic chemistry reactions.',
      category: 'Chemistry',
      color: '#F59E0B',
      tags: ['Chemistry', 'Lab', 'Organic'],
      daysFromNow: 4,
      hour: 10,
      duration: 75,
      notifyBefore: 20,
      maxParticipants: 40,
      isPublic: true,
    },
    {
      title: 'Physics Problem Solving',
      description: 'Work through complex physics problems together.',
      category: 'Physics',
      color: '#8B5CF6',
      tags: ['Physics', 'Problem Solving'],
      daysFromNow: 5,
      hour: 15,
      duration: 60,
      notifyBefore: 30,
      maxParticipants: 35,
      isPublic: false, // Subscribers only
    },
  ];

  for (const teacher of teachers) {
    for (const template of scheduleTemplates) {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + template.daysFromNow);
      startTime.setHours(template.hour, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + template.duration);

      try {
        // Always create livestream (Schedule is for scheduling livestreams)
        const livestream = await prisma.liveStream.create({
          data: {
            teacherId: teacher.id,
            title: template.title,
            description: template.description,
            category: template.category,
            status: 'SCHEDULED',
            scheduledAt: startTime,
            isRecorded: true,
            isPublic: template.isPublic,
            allowComments: true,
            allowQuestions: true,
            chatMode: 'EVERYONE',
          },
        });

        // Create schedule linked to livestream
        await prisma.schedule.create({
          data: {
            teacherId: teacher.id,
            title: template.title,
            startTime,
            endTime,
            livestreamId: livestream.id,
            isPublic: template.isPublic,
            status: 'SCHEDULED',
            color: template.color,
            tags: template.tags,
            notifyBefore: template.notifyBefore,
            maxParticipants: template.maxParticipants,
          },
        });

        console.log(
          `✅ Created scheduled livestream: ${template.title} (${teacher.fullName})`
        );
      } catch (error) {
        console.error(`❌ Error creating schedule for ${teacher.fullName}:`, error);
      }
    }
  }

  console.log('✨ Schedule seeding completed!');
}

async function main() {
  try {
    await seedLivestreamsWithVideos();
    await seedSchedules();
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
