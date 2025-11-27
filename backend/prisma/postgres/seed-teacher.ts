import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEACHER_ID = 'e511e51a-546f-47c2-af97-5055a1e1e8dd';

/**
 * Seed data specifically for teacher e511e51a-546f-47c2-af97-5055a1e1e8dd
 */

// Shared recording URLs to save R2 storage (only 5 actual video files needed)
const SHARED_RECORDING_URLS = {
  English: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/english.mp4',
  Mathematics: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/calculus.mp4',
  Chemistry: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/chemistry.mp4',
  Physics: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/physics.mp4',
  Law: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/sample-videos/law.mp4',
};

// Diverse video titles for past livestreams
const SAMPLE_VIDEOS = [
  {
    title: 'Introduction to Advanced English Grammar',
    duration: 220,
    category: 'English',
  },
  {
    title: 'IELTS Speaking Strategies - Part 2',
    duration: 215,
    category: 'English',
  },
  {
    title: 'Business English - Email Writing',
    duration: 230,
    category: 'English',
  },
  {
    title: 'English Pronunciation Masterclass',
    duration: 210,
    category: 'English',
  },
  {
    title: 'TOEFL Reading Comprehension Tips',
    duration: 225,
    category: 'English',
  },
];

// Shared document files (reused to save R2 storage)
const SHARED_DOCUMENT_FILES = {
  pdf: {
    fileUrl: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/documents/english-guide.pdf',
    fileName: 'english-guide.pdf',
    fileType: 'pdf',
    fileSize: 2500000,
    mimeType: 'application/pdf',
  },
  image: {
    fileUrl: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/documents/diagram.png',
    fileName: 'diagram.png',
    fileType: 'image',
    fileSize: 1200000,
    mimeType: 'image/png',
  },
  video: {
    fileUrl: 'https://pub-6ec835ecee45466fa5552dedffaee2e4.r2.dev/documents/tutorial.mp4',
    fileName: 'tutorial.mp4',
    fileType: 'video',
    fileSize: 8000000,
    mimeType: 'video/mp4',
  },
};

// Diverse document titles (use shared files based on type)
const SAMPLE_DOCUMENTS = [
  {
    title: 'English Grammar Reference Guide',
    description: 'Comprehensive grammar reference for all levels',
    type: 'pdf',
  },
  {
    title: 'IELTS Speaking Topics 2025',
    description: 'Latest IELTS speaking topics and sample answers',
    type: 'pdf',
  },
  {
    title: 'Business English Vocabulary List',
    description: 'Essential vocabulary for business communication',
    type: 'pdf',
  },
  {
    title: 'English Idioms and Phrases',
    description: 'Common idioms with examples and explanations',
    type: 'pdf',
  },
  {
    title: 'Grammar Structure Diagrams',
    description: 'Visual diagrams of English grammar structures',
    type: 'image',
  },
  {
    title: 'Pronunciation Practice Exercises',
    description: 'Audio exercises for improving pronunciation',
    type: 'pdf',
  },
  {
    title: 'TOEFL Writing Templates',
    description: 'Essay templates and writing strategies',
    type: 'pdf',
  },
  {
    title: 'English Presentation Skills Guide',
    description: 'How to deliver effective presentations in English',
    type: 'pdf',
  },
  {
    title: 'English Pronunciation Tutorial',
    description: 'Video guide to English pronunciation',
    type: 'video',
  },
  {
    title: 'Academic Writing Handbook',
    description: 'Complete guide to academic writing in English',
    type: 'pdf',
  },
];

// Upcoming scheduled livestreams
const UPCOMING_SCHEDULES = [
  {
    title: 'IELTS Speaking Mock Test - Part 1 & 2',
    description: 'Practice speaking with real exam format and get instant feedback',
    category: 'English',
    color: '#3B82F6',
    tags: ['IELTS', 'Speaking', 'Mock Test'],
    daysFromNow: 1,
    hour: 14,
    duration: 90,
    notifyBefore: 30,
    isPublic: true,
  },
  {
    title: 'Business English - Negotiation Skills',
    description: 'Learn key phrases and strategies for successful business negotiations',
    category: 'English',
    color: '#10B981',
    tags: ['Business English', 'Negotiation'],
    daysFromNow: 2,
    hour: 16,
    duration: 60,
    notifyBefore: 15,
    isPublic: false,
  },
  {
    title: 'English Pronunciation Workshop',
    description: 'Focus on challenging sounds and intonation patterns',
    category: 'English',
    color: '#F59E0B',
    tags: ['Pronunciation', 'Speaking'],
    daysFromNow: 3,
    hour: 10,
    duration: 75,
    notifyBefore: 20,
    isPublic: true,
  },
  {
    title: 'TOEFL Integrated Writing Task',
    description: 'Master the integrated writing task with practice and feedback',
    category: 'English',
    color: '#8B5CF6',
    tags: ['TOEFL', 'Writing'],
    daysFromNow: 4,
    hour: 15,
    duration: 90,
    notifyBefore: 30,
    isPublic: false,
  },
  {
    title: 'Advanced Grammar - Conditionals',
    description: 'Deep dive into conditional sentences and their usage',
    category: 'English',
    color: '#EC4899',
    tags: ['Grammar', 'Advanced'],
    daysFromNow: 5,
    hour: 11,
    duration: 60,
    notifyBefore: 15,
    isPublic: true,
  },
  {
    title: 'English Conversation Club',
    description: 'Free-flowing conversation practice on various topics',
    category: 'English',
    color: '#06B6D4',
    tags: ['Conversation', 'Speaking Practice'],
    daysFromNow: 6,
    hour: 18,
    duration: 90,
    notifyBefore: 30,
    isPublic: true,
  },
  {
    title: 'Academic Writing Workshop',
    description: 'Learn to write academic essays with proper structure and citations',
    category: 'English',
    color: '#EF4444',
    tags: ['Academic Writing', 'Essay'],
    daysFromNow: 7,
    hour: 13,
    duration: 120,
    notifyBefore: 60,
    isPublic: false,
  },
  {
    title: 'Office Hours - Student Q&A',
    description: 'Open session for students to ask any English-related questions',
    category: 'English',
    color: '#6366F1',
    tags: ['Q&A', 'Office Hours'],
    daysFromNow: 8,
    hour: 17,
    duration: 60,
    notifyBefore: 15,
    isPublic: false,
  },
  {
    title: 'IELTS Writing Task 2 - Opinion Essays',
    description: 'Learn to write effective opinion essays for IELTS',
    category: 'English',
    color: '#F97316',
    tags: ['IELTS', 'Writing', 'Essay'],
    daysFromNow: 9,
    hour: 14,
    duration: 90,
    notifyBefore: 30,
    isPublic: true,
  },
  {
    title: 'English Presentation Skills Practice',
    description: 'Practice and improve your presentation skills with feedback',
    category: 'English',
    color: '#14B8A6',
    tags: ['Presentation', 'Public Speaking'],
    daysFromNow: 10,
    hour: 16,
    duration: 75,
    notifyBefore: 20,
    isPublic: false,
  },
];

async function cleanupOldData() {
  console.log('🧹 Cleaning up old data...');

  // Delete old documents
  const deletedDocs = await prisma.document.deleteMany({
    where: { teacherId: TEACHER_ID },
  });
  console.log(`  🗑️  Deleted ${deletedDocs.count} old documents`);

  // Delete old schedules (this will set livestreamId to null due to onDelete: SetNull)
  const deletedSchedules = await prisma.schedule.deleteMany({
    where: { teacherId: TEACHER_ID },
  });
  console.log(`  🗑️  Deleted ${deletedSchedules.count} old schedules`);

  // Delete livestreams that don't have .webm recordings
  const livestreamsToDelete = await prisma.liveStream.findMany({
    where: {
      teacherId: TEACHER_ID,
      OR: [
        { recordingUrl: null },
        { recordingUrl: { not: { endsWith: '.webm' } } },
      ],
    },
    select: { id: true, title: true, recordingUrl: true },
  });

  if (livestreamsToDelete.length > 0) {
    // Delete tags associated with these livestreams
    await prisma.tag.deleteMany({
      where: {
        livestreamId: { in: livestreamsToDelete.map((ls) => ls.id) },
      },
    });

    // Delete the livestreams
    const deletedLivestreams = await prisma.liveStream.deleteMany({
      where: {
        id: { in: livestreamsToDelete.map((ls) => ls.id) },
      },
    });
    console.log(`  🗑️  Deleted ${deletedLivestreams.count} old livestreams (kept .webm recordings)`);
  }

  const keptLivestreams = await prisma.liveStream.count({
    where: {
      teacherId: TEACHER_ID,
      recordingUrl: { endsWith: '.webm' },
    },
  });
  console.log(`  ✅ Kept ${keptLivestreams} livestreams with .webm recordings\n`);
}

async function seedTeacherData() {
  console.log(`🎓 Seeding data for teacher ${TEACHER_ID}...`);

  // Verify teacher exists
  const teacher = await prisma.user.findUnique({
    where: { id: TEACHER_ID },
  });

  if (!teacher) {
    console.error(`❌ Teacher ${TEACHER_ID} not found!`);
    return;
  }

  console.log(`✅ Found teacher: ${teacher.fullName}\n`);

  // Cleanup old data (except .webm recordings)
  await cleanupOldData();

  // 1. Create Documents
  console.log('📄 Creating documents...');
  for (const doc of SAMPLE_DOCUMENTS) {
    try {
      const sharedFile = doc.type === 'image' 
        ? SHARED_DOCUMENT_FILES.image 
        : doc.type === 'video'
        ? SHARED_DOCUMENT_FILES.video
        : SHARED_DOCUMENT_FILES.pdf;

      const document = await prisma.document.create({
        data: {
          teacherId: TEACHER_ID,
          title: doc.title,
          description: doc.description,
          fileUrl: sharedFile.fileUrl, // Reuse shared file based on type
          fileName: sharedFile.fileName,
          fileType: sharedFile.fileType,
          fileSize: sharedFile.fileSize,
          mimeType: sharedFile.mimeType,
        },
      });
      console.log(`  ✅ Created document: ${document.title} (${doc.type})`);
    } catch (error) {
      console.error(`  ❌ Error creating document ${doc.title}:`, error);
    }
  }

  // 2. Create Past Livestreams with Recordings
  console.log('\n📹 Creating past livestreams with recordings...');
  for (let i = 0; i < SAMPLE_VIDEOS.length; i++) {
    const video = SAMPLE_VIDEOS[i];
    const daysAgo = i + 1;
    
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() - daysAgo);
    scheduledAt.setHours(14 + (i % 3), 0, 0, 0);
    
    const startedAt = new Date(scheduledAt);
    startedAt.setMinutes(startedAt.getMinutes() + 2);
    
    const endedAt = new Date(startedAt);
    endedAt.setSeconds(endedAt.getSeconds() + video.duration);

    try {
      const livestream = await prisma.liveStream.create({
        data: {
          teacherId: TEACHER_ID,
          title: video.title,
          description: `Comprehensive ${video.category} lesson with practical examples and exercises.`,
          category: video.category,
          thumbnail: `https://i.pravatar.cc/400?img=${20 + i}`,
          status: 'ENDED',
          recordingUrl: SHARED_RECORDING_URLS[video.category as keyof typeof SHARED_RECORDING_URLS],
          scheduledAt,
          startedAt,
          endedAt,
          duration: video.duration,
          currentViewers: 0,
          totalViews: Math.floor(Math.random() * 800) + 200,
          peakViewers: Math.floor(Math.random() * 80) + 30,
          isRecorded: true,
          isPublic: true,
          allowComments: true,
          allowQuestions: true,
          chatMode: 'EVERYONE',
        },
      });
      console.log(`  ✅ Created livestream: ${livestream.title}`);
    } catch (error) {
      console.error(`  ❌ Error creating livestream ${video.title}:`, error);
    }
  }

  // 3. Create Upcoming Scheduled Livestreams
  console.log('\n📅 Creating upcoming scheduled livestreams...');
  for (const template of UPCOMING_SCHEDULES) {
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + template.daysFromNow);
    startTime.setHours(template.hour, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + template.duration);

    try {
      // Always create livestream (Schedule is for scheduling livestreams)
      const livestream = await prisma.liveStream.create({
        data: {
          teacherId: TEACHER_ID,
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
          teacherId: TEACHER_ID,
          title: template.title,
          startTime,
          endTime,
          livestreamId: livestream.id,
          isPublic: template.isPublic,
          status: 'SCHEDULED',
          color: template.color,
          tags: template.tags,
          notifyBefore: template.notifyBefore,
        },
      });

      console.log(`  ✅ Created scheduled livestream: ${template.title}`);
    } catch (error) {
      console.error(`  ❌ Error creating schedule ${template.title}:`, error);
    }
  }

  console.log('\n✨ Seeding completed successfully!');
}

async function main() {
  try {
    await seedTeacherData();
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
