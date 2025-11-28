import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '&connection_limit=20&pool_timeout=30',
    },
  },
});

const TEACHER_USER_ID = 'e511e51a-546f-47c2-af97-5055a1e1e8dd';

/**
 * Seed additional data to make teacher dashboard look better
 * - Add followers
 * - Add views to livestreams
 * - Add watch time data
 */

async function seedDashboardData() {
  console.log('📊 Seeding dashboard data for teacher dashboard...\n');

  // Get teacher profile ID
  const teacherProfile = await prisma.teacherProfile.findFirst({
    where: { userId: TEACHER_USER_ID }
  });
  
  if (!teacherProfile) {
    console.error('❌ Teacher profile not found');
    return;
  }
  
  const TEACHER_ID = teacherProfile.id;
  console.log(`Found teacher profile ID: ${TEACHER_ID}\n`);

  // 1. Get all student profiles
  const studentProfiles = await prisma.studentProfile.findMany({
    take: 50, // Get up to 50 students
  });

  console.log(`Found ${studentProfiles.length} students to become followers\n`);

  // 2. Create followers (40% of students will follow)
  console.log('👥 Creating followers...');
  const followersToCreate = Math.floor(studentProfiles.length * 0.4);
  let followersCreated = 0;

  for (let i = 0; i < followersToCreate && i < studentProfiles.length; i++) {
    try {
      // Check if already following
      const existing = await prisma.followedTeacher.findUnique({
        where: {
          studentId_teacherId: {
            studentId: studentProfiles[i].id,
            teacherId: TEACHER_ID,
          },
        },
      });

      if (!existing) {
        const createdAt = new Date();
        createdAt.setMonth(createdAt.getMonth() - Math.floor(Math.random() * 12)); // Random date within last 12 months
        
        await prisma.followedTeacher.create({
          data: {
            studentId: studentProfiles[i].id,
            teacherId: TEACHER_ID,
            createdAt,
          },
        });
        followersCreated++;
      }
    } catch (error) {
      console.error(`  ❌ Error creating follower:`, error);
    }
  }
  console.log(`  ✅ Created ${followersCreated} new followers\n`);

  // 3. Update livestream views and peak viewers
  console.log('👀 Updating livestream views...');
  const livestreams = await prisma.liveStream.findMany({
    where: {
      teacherId: TEACHER_ID,
      status: 'ENDED',
    },
  });

  for (const livestream of livestreams) {
    try {
      const totalViews = Math.floor(Math.random() * 1500) + 500; // 500-2000 views
      const peakViewers = Math.floor(totalViews * 0.15) + 50; // Peak ~15% of total + base
      
      await prisma.liveStream.update({
        where: { id: livestream.id },
        data: {
          totalViews,
          peakViewers,
        },
      });
    } catch (error) {
      console.error(`  ❌ Error updating views:`, error);
    }
  }
  console.log(`  ✅ Updated views for ${livestreams.length} livestreams\n`);

  // 4. Add rating to teacher profile
  console.log('⭐ Setting teacher rating...');
  try {
    await prisma.teacherProfile.update({
      where: { id: TEACHER_ID },
      data: {
        rating: 4.7, // Good rating
        totalStudents: followersCreated,
      },
    });
    console.log('  ✅ Updated teacher rating and total students\n');
  } catch (error) {
    console.error('  ❌ Error updating teacher profile:', error);
  }

  // 5. Display current stats
  console.log('📈 Current Dashboard Stats:');
  const stats = await calculateStats(TEACHER_ID, TEACHER_USER_ID);
  console.log('  Total Followers:', stats.totalStudents);
  console.log('  Total Livestreams:', stats.totalLivestreams);
  console.log('  Total Recordings:', stats.totalRecordings);
  console.log('  Total Views:', stats.totalViews);
  console.log('  Total Watch Time (hours):', stats.totalWatchTimeHours);
  console.log('  Rating:', stats.rating);

  console.log('\n✨ Dashboard data seeding completed!');
}

async function calculateStats(teacherProfileId: string, teacherUserId: string) {
  // Get all livestreams
  const livestreams = await prisma.liveStream.findMany({
    where: { teacherId: teacherUserId },
  });

  const recordings = livestreams.filter(ls => ls.status === 'ENDED' && ls.recordingUrl);
  const totalViews = livestreams.reduce((sum, ls) => sum + ls.totalViews, 0);
  const totalWatchTimeSeconds = livestreams.reduce((sum, ls) => sum + ls.duration, 0);
  const totalWatchTimeHours = Math.round(totalWatchTimeSeconds / 3600);

  // Get followers
  const followers = await prisma.followedTeacher.count({
    where: { teacherId: teacherProfileId },
  });

  // Get teacher profile
  const profile = await prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
  });

  // Get documents
  const documents = await prisma.document.count({
    where: { teacherId: teacherUserId },
  });

  return {
    totalStudents: followers,
    totalLivestreams: livestreams.length,
    totalRecordings: recordings.length,
    totalViews,
    totalDocuments: documents,
    totalWatchTimeHours,
    rating: profile?.rating || 0,
  };
}

// Run the seed
seedDashboardData()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
