import { PrismaClient as MongoClient } from '../../prisma/mongodb/generated/@prisma/mongodb-client';

const mongo = new MongoClient();

async function main() {
  console.log('🌱 Seeding MongoDB database...');

  // Create sample notifications
  await mongo.notification.createMany({
    data: [
      {
        userId: 'user-id-1',
        type: 'SYSTEM',
        title: 'Welcome to StreamLand!',
        content: 'Start exploring courses and live streams.',
        read: false,
      },
      {
        userId: 'user-id-1',
        type: 'LIVESTREAM_START',
        title: 'New Live Stream',
        content: 'David Nguyen is now live!',
        read: false,
      },
    ],
  });

  // Create sample user presence
  await mongo.userPresence.create({
    data: {
      userId: 'user-id-1',
      status: 'ONLINE',
      lastSeen: new Date(),
    },
  });

  console.log('✅ MongoDB seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ MongoDB seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await mongo.$disconnect();
  });
