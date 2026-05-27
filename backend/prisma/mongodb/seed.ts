import { PrismaClient as MongoClient } from '../../prisma/mongodb/generated/@prisma/mongodb-client';
import { PrismaClient as PostgresClient } from '@prisma/client';

const mongo = new MongoClient();
const postgres = new PostgresClient();

async function main() {
  console.log('🌱 Seeding MongoDB database...');

  // Clear existing data first
  console.log('🗑️  Clearing existing MongoDB data...');
  await mongo.chatMessage.deleteMany({});
  await mongo.notification.deleteMany({});
  await mongo.activityLog.deleteMany({});
  await mongo.userPresence.deleteMany({});
  console.log('✅ Cleared existing data');

  // Get specific students from PostgreSQL by email to get their IDs
  const student1 = await postgres.user.findUnique({
    where: { email: 'student1@streamland.com' },
    select: { id: true, fullName: true },
  });

  const student2 = await postgres.user.findUnique({
    where: { email: 'student2@streamland.com' },
    select: { id: true, fullName: true },
  });

  const student3 = await postgres.user.findUnique({
    where: { email: 'student3@streamland.com' },
    select: { id: true, fullName: true },
  });

  const student4 = await postgres.user.findUnique({
    where: { email: 'student4@streamland.com' },
    select: { id: true, fullName: true },
  });

  if (!student1 || !student2 || !student3 || !student4) {
    console.log('⚠️  Not enough students found. Please seed PostgreSQL first.');
    return;
  }

  console.log(`Found students:`);
  console.log(`  - ${student1.fullName} (${student1.id})`);
  console.log(`  - ${student2.fullName} (${student2.id})`);
  console.log(`  - ${student3.fullName} (${student3.id})`);
  console.log(`  - ${student4.fullName} (${student4.id})`);

  // Create chat messages between Student 1 (Minh Anh) and Student 3 (Thu Trang) - they are friends
  const messagesStudent1To3 = [
    {
      senderId: student1.id,
      receiverId: student3.id,
      content: 'Chào Thu Trang! Bạn có rảnh học nhóm môn Văn không?',
      type: 'TEXT' as const,
      attachments: [],
      createdAt: new Date('2024-11-20T10:30:00'),
      updatedAt: new Date('2024-11-20T10:30:00'),
    },
    {
      senderId: student3.id,
      receiverId: student1.id,
      content: 'Chào Minh Anh! Mình rảnh nha, khi nào bạn muốn học?',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-20T10:32:00'),
      createdAt: new Date('2024-11-20T10:31:00'),
      updatedAt: new Date('2024-11-20T10:31:00'),
    },
    {
      senderId: student1.id,
      receiverId: student3.id,
      content: 'Chiều nay lúc 3 giờ được không? Mình muốn ôn bài phân tích tác phẩm.',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-20T10:33:00'),
      createdAt: new Date('2024-11-20T10:32:30'),
      updatedAt: new Date('2024-11-20T10:32:30'),
    },
    {
      senderId: student3.id,
      receiverId: student1.id,
      content: 'OK luôn! Mình cũng đang muốn ôn phần đó. Gặp nhau ở thư viện nhé!',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-20T10:35:00'),
      createdAt: new Date('2024-11-20T10:33:30'),
      updatedAt: new Date('2024-11-20T10:33:30'),
    },
    {
      senderId: student1.id,
      receiverId: student3.id,
      content: 'Perfect! Cảm ơn bạn nha 😊',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-20T10:36:00'),
      createdAt: new Date('2024-11-20T10:35:30'),
      updatedAt: new Date('2024-11-20T10:35:30'),
    },
    {
      senderId: student3.id,
      receiverId: student1.id,
      content: 'Bạn ơi, bài tập về nhà môn Văn hôm nay khó quá!',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-21T15:20:00'),
      createdAt: new Date('2024-11-21T15:15:00'),
      updatedAt: new Date('2024-11-21T15:15:00'),
    },
    {
      senderId: student1.id,
      receiverId: student3.id,
      content: 'Mình cũng thấy vậy. Bài phân tích đoạn thơ phải không?',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-21T15:22:00'),
      createdAt: new Date('2024-11-21T15:21:00'),
      updatedAt: new Date('2024-11-21T15:21:00'),
    },
    {
      senderId: student3.id,
      receiverId: student1.id,
      content: 'Đúng rồi! Mình nghĩ là nên tập trung vào nghệ thuật tu từ và hình ảnh trong đoạn thơ.',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-21T15:25:00'),
      createdAt: new Date('2024-11-21T15:23:00'),
      updatedAt: new Date('2024-11-21T15:23:00'),
    },
    {
      senderId: student1.id,
      receiverId: student3.id,
      content: 'Hay đấy! Mình sẽ thử làm theo cách đó. Cảm ơn bạn nhiều nhé!',
      type: 'TEXT' as const,
      attachments: [],
      createdAt: new Date('2024-11-21T15:26:00'),
      updatedAt: new Date('2024-11-21T15:26:00'),
    },
  ];

  // Create chat messages between Student 1 (Minh Anh) and Student 2 (Hoang Nam) - friend request pending
  const messagesStudent1To2 = [
    {
      senderId: student1.id,
      receiverId: student2.id,
      content: 'Chào Hoàng Nam! Mình thấy bạn học cùng trường. Kết bạn với mình nhé!',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-22T09:15:00'),
      createdAt: new Date('2024-11-22T09:10:00'),
      updatedAt: new Date('2024-11-22T09:10:00'),
    },
    {
      senderId: student2.id,
      receiverId: student1.id,
      content: 'Chào bạn! Mình cũng thấy bạn trên hệ thống. Bạn học lớp nào vậy?',
      type: 'TEXT' as const,
      attachments: [],
      createdAt: new Date('2024-11-22T09:16:00'),
      updatedAt: new Date('2024-11-22T09:16:00'),
    },
  ];

  // Create chat messages between Student 4 (Quoc Bao) and Student 1 (Minh Anh)
  const messagesStudent4To1 = [
    {
      senderId: student4.id,
      receiverId: student1.id,
      content: 'Hi Minh Anh! Mình là Quốc Bảo. Mình thấy bạn cũng thích toán. Kết bạn không?',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-23T11:05:00'),
      createdAt: new Date('2024-11-23T11:00:00'),
      updatedAt: new Date('2024-11-23T11:00:00'),
    },
    {
      senderId: student1.id,
      receiverId: student4.id,
      content: 'Chào Quốc Bảo! Được chứ, mình cũng đang tìm bạn học nhóm môn toán.',
      type: 'TEXT' as const,
      attachments: [],
      readAt: new Date('2024-11-23T11:08:00'),
      createdAt: new Date('2024-11-23T11:06:00'),
      updatedAt: new Date('2024-11-23T11:06:00'),
    },
    {
      senderId: student4.id,
      receiverId: student1.id,
      content: 'Tuyệt! Bạn có giải được bài toán về phương trình bậc hai trong bài tập không?',
      type: 'TEXT' as const,
      attachments: [],
      createdAt: new Date('2024-11-23T11:10:00'),
      updatedAt: new Date('2024-11-23T11:10:00'),
    },
  ];

  // Create all messages
  console.log('\n📨 Creating chat messages...');
  
  const allMessages = [
    ...messagesStudent1To3,
    ...messagesStudent1To2,
    ...messagesStudent4To1,
  ];

  for (const messageData of allMessages) {
    await mongo.chatMessage.create({
      data: messageData,
    });
  }

  console.log(`✅ Created ${allMessages.length} chat messages`);
  console.log(`   - ${messagesStudent1To3.length} messages between ${student1.fullName} and ${student3.fullName}`);
  console.log(`   - ${messagesStudent1To2.length} messages between ${student1.fullName} and ${student2.fullName}`);
  console.log(`   - ${messagesStudent4To1.length} messages between ${student4.fullName} and ${student1.fullName}`);

  // Create sample notifications
  await mongo.notification.createMany({
    data: [
      {
        userId: student1.id,
        type: 'SYSTEM',
        title: 'Welcome to StreamLand!',
        content: 'Start exploring courses and live streams.',
        read: false,
      },
      {
        userId: student1.id,
        type: 'LIVESTREAM_START',
        title: 'New Live Stream',
        content: 'Mr. David Nguyen is now live!',
        read: false,
      },
      {
        userId: student1.id,
        type: 'NEW_FOLLOWER',
        title: 'New Friend Request',
        content: `${student4.fullName} sent you a friend request`,
        read: false,
      },
    ],
  });

  console.log('✅ Created notifications');

  // Create sample user presence using upsert to avoid unique constraint errors
  await mongo.userPresence.upsert({
    where: { userId: student1.id },
    update: { status: 'ONLINE', lastSeen: new Date() },
    create: {
      userId: student1.id,
      status: 'ONLINE',
      lastSeen: new Date(),
    },
  });

  await mongo.userPresence.upsert({
    where: { userId: student3.id },
    update: { status: 'ONLINE', lastSeen: new Date() },
    create: {
      userId: student3.id,
      status: 'ONLINE',
      lastSeen: new Date(),
    },
  });

  await mongo.userPresence.upsert({
    where: { userId: student2.id },
    update: { status: 'OFFLINE', lastSeen: new Date(Date.now() - 3600000) },
    create: {
      userId: student2.id,
      status: 'OFFLINE',
      lastSeen: new Date(Date.now() - 3600000),
    },
  });

  console.log('✅ Created user presence data');

  // Create sample profile activity logs (used by the student profile journal)
  console.log('\n📝 Creating profile activity logs for each student...');

  const students = [student1, student2, student3, student4];
  let created = 0;
  let commentIdx = 1;
  const baseDate = new Date('2024-11-20T08:00:00').getTime();

  for (let i = 0; i < students.length; i++) {
    const s = students[i];

    // Latest activity: note (pinned)
    await mongo.activityLog.create({
      data: {
        userId: s.id,
        action: 'PROFILE_NOTE_POSTED',
        resource: 'profile-note',
        metadata: {
          content: `Ghi chú của ${s.fullName}: hoàn thành buổi học hôm nay và ôn lại bài tập.`,
          visibility: i % 3 === 0 ? 'followers' : 'public',
          pinned: true,
          reactions: [
            { userId: students[(i + 1) % students.length].id, type: 'like', createdAt: new Date().toISOString() },
          ],
          comments: [
            { id: `c-${commentIdx++}`, userId: students[(i + 2) % students.length].id, content: 'Cố lên nhé!', createdAt: new Date().toISOString() },
          ],
        },
        createdAt: new Date(baseDate + i * 1000 * 60 * 60 * 24),
      },
    });
    created++;

    // Check-in activity
    await mongo.activityLog.create({
      data: {
        userId: s.id,
        action: 'PROFILE_NOTE_POSTED',
        resource: 'profile-note',
        metadata: {
          content: `Check-in: Hôm nay ${s.fullName} đã học 30 phút.`,
          visibility: 'public',
          pinned: false,
          reactions: [],
          comments: [],
        },
        createdAt: new Date(baseDate + i * 1000 * 60 * 60 * 24 - 1000 * 60 * 60),
      },
    });
    created++;

    // Private note
    await mongo.activityLog.create({
      data: {
        userId: s.id,
        action: 'PROFILE_NOTE_POSTED',
        resource: 'profile-note',
        metadata: {
          content: `Private note for ${s.fullName}: công thức, mẹo giải nhanh.`,
          visibility: 'private',
          pinned: false,
          reactions: [],
          comments: [],
        },
        createdAt: new Date(baseDate + i * 1000 * 60 * 60 * 24 - 2000 * 60 * 60),
      },
    });
    created++;
  }

  console.log(`✅ Created ${created} profile activities`);
  console.log('\n🎉 MongoDB seeding completed!');
}

main()
  .catch((e) => {
    console.error('MongoDB seeding failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void mongo.$disconnect();
    void postgres.$disconnect();
  });
