import { PrismaClient as MongoClient } from '../prisma/mongodb/generated/@prisma/mongodb-client';
import { PrismaClient as PostgresClient } from '@prisma/client';

const mongo = new MongoClient();
const postgres = new PostgresClient();

async function main() {
  console.log('Checking profile activities for seeded students...');

  const students = await postgres.user.findMany({
    where: { email: { in: ['student1@streamland.com', 'student2@streamland.com', 'student3@streamland.com', 'student4@streamland.com'] } },
    select: { id: true, fullName: true, email: true },
  });

  if (!students.length) {
    console.log('No seeded students found in Postgres. Ensure Postgres seed ran.');
    return;
  }

  for (const s of students) {
    const rows = await mongo.activityLog.findMany({ where: { userId: s.id, action: 'PROFILE_NOTE_POSTED', resource: 'profile-note' }, orderBy: { createdAt: 'desc' } });
    console.log(`\n- ${s.fullName} (${s.email}) — ${rows.length} profile activities`);
    const sample = rows.slice(0, 3);
    for (const row of sample) {
      const meta = row.metadata as any;
      console.log(`  • ${row.createdAt.toISOString()} | visibility=${meta?.visibility || 'followers'} | pinned=${!!meta?.pinned}`);
      console.log(`    ${((meta && meta.content) || '').slice(0, 120)}`);
      if (Array.isArray(meta?.reactions) && meta.reactions.length) {
        console.log(`    Reactions: ${meta.reactions.map((r: any) => r.type || 'like').join(', ')}`);
      }
      if (Array.isArray(meta?.comments) && meta.comments.length) {
        console.log(`    Comments: ${meta.comments.length}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error('Check script failed:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    void mongo.$disconnect();
    void postgres.$disconnect();
  });
