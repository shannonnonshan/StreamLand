import { PrismaClient, ReportStatus, ReportType, Role } from '@prisma/client';

const prisma = new PrismaClient();

type ReportSeedInput = {
  reporterId: string;
  reportedId: string;
  type: ReportType;
  category: string;
  reason: string;
  description?: string;
  screenshots?: string[];
  status?: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  resolution?: string;
  createdAt?: Date;
};

async function ensureReport(input: ReportSeedInput) {
  const existing = await prisma.report.findFirst({
    where: {
      reporterId: input.reporterId,
      reportedId: input.reportedId,
      category: input.category,
      reason: input.reason,
    },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await prisma.report.create({
    data: {
      reporterId: input.reporterId,
      reportedId: input.reportedId,
      type: input.type,
      category: input.category,
      reason: input.reason,
      description: input.description,
      screenshots: input.screenshots ?? [],
      status: input.status ?? ReportStatus.PENDING,
      reviewedBy: input.reviewedBy,
      reviewedAt: input.reviewedAt,
      resolution: input.resolution,
      createdAt: input.createdAt,
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

async function main() {
  console.log('🌱 Seeding reports test data (non-destructive)...');

  const students = await prisma.user.findMany({
    where: { role: Role.STUDENT },
    select: { id: true, fullName: true },
    take: 20,
    orderBy: { createdAt: 'asc' },
  });

  const teachers = await prisma.user.findMany({
    where: { role: Role.TEACHER },
    select: { id: true, fullName: true },
    take: 20,
    orderBy: { createdAt: 'asc' },
  });

  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { id: true, fullName: true },
    take: 5,
    orderBy: { createdAt: 'asc' },
  });

  if (students.length < 2 || teachers.length < 2) {
    console.log('⚠️ Not enough users to seed reports. Need at least 2 students and 2 teachers.');
    return;
  }

  const reviewerId = admins[0]?.id;

  const reportSeeds: ReportSeedInput[] = [
    {
      reporterId: students[0].id,
      reportedId: teachers[0].id,
      type: ReportType.USER,
      category: 'Unprofessional behavior',
      reason: '[SEED] Teacher ended session too early',
      description: 'Session ended 20 minutes early without explanation.',
      screenshots: ['https://picsum.photos/seed/report-1/800/450'],
      status: ReportStatus.PENDING,
    },
    {
      reporterId: students[1].id,
      reportedId: teachers[1].id,
      type: ReportType.USER,
      category: 'Inappropriate language',
      reason: '[SEED] Teacher used disrespectful words',
      description: 'Comments during Q&A were offensive.',
      screenshots: ['https://picsum.photos/seed/report-2/800/450'],
      status: ReportStatus.REVIEWING,
    },
    {
      reporterId: teachers[0].id,
      reportedId: students[0].id,
      type: ReportType.USER,
      category: 'Class disruption',
      reason: '[SEED] Student spammed chat repeatedly',
      description: 'Student posted repeated unrelated messages in class chat.',
      screenshots: ['https://picsum.photos/seed/report-3/800/450'],
      status: ReportStatus.RESOLVED,
      reviewedBy: reviewerId,
      reviewedAt: reviewerId ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : undefined,
      resolution: 'Warning sent to student account.',
    },
    {
      reporterId: teachers[1].id,
      reportedId: students[1].id,
      type: ReportType.USER,
      category: 'Harassment',
      reason: '[SEED] Student posted personal attacks',
      description: 'Multiple insulting comments directed at teacher.',
      screenshots: ['https://picsum.photos/seed/report-4/800/450'],
      status: ReportStatus.DISMISSED,
      reviewedBy: reviewerId,
      reviewedAt: reviewerId ? new Date(Date.now() - 24 * 60 * 60 * 1000) : undefined,
      resolution: 'Insufficient evidence after review.',
    },
    {
      reporterId: students[0].id,
      reportedId: teachers[1].id,
      type: ReportType.USER,
      category: 'No-show',
      reason: '[SEED] Teacher missed scheduled livestream',
      description: 'Teacher did not attend livestream and gave no notice.',
      status: ReportStatus.PENDING,
    },
    {
      reporterId: students[1].id,
      reportedId: teachers[0].id,
      type: ReportType.USER,
      category: 'Content quality',
      reason: '[SEED] Outdated material in class handout',
      description: 'Document references old exam format.',
      status: ReportStatus.PENDING,
    },
    {
      reporterId: teachers[0].id,
      reportedId: students[1].id,
      type: ReportType.USER,
      category: 'Abusive language',
      reason: '[SEED] Student used profanity during stream',
      description: 'Inappropriate words in voice chat.',
      status: ReportStatus.REVIEWING,
    },
    {
      reporterId: teachers[1].id,
      reportedId: students[0].id,
      type: ReportType.USER,
      category: 'Impersonation',
      reason: '[SEED] Student used fake profile identity',
      description: 'Profile appears to impersonate another learner.',
      status: ReportStatus.PENDING,
    },
  ];

  let createdCount = 0;
  let reusedCount = 0;

  for (const item of reportSeeds) {
    const result = await ensureReport(item);
    if (result.created) {
      createdCount += 1;
      console.log(`✅ Added report ${result.id} - ${item.reason}`);
    } else {
      reusedCount += 1;
      console.log(`↪️ Skipped existing report ${result.id} - ${item.reason}`);
    }
  }

  console.log(`\nDone. Created: ${createdCount}, Existing kept: ${reusedCount}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed reports failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
