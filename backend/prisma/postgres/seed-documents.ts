import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Shared document files to save R2 storage
 * Different teachers will reuse these files based on their subject
 */
const SHARED_DOCUMENT_FILES = {
  pdf: {
    English: {
      fileUrl: 'https://pub-c9b3003981b04829beec1b5ba14425c2.r2.dev/sample-docs/english-guide.pdf',
      fileName: 'english-guide.pdf',
      fileType: 'pdf',
      fileSize: 2500000,
      mimeType: 'application/pdf',
    },
    Mathematics: {
      fileUrl: 'https://pub-c9b3003981b04829beec1b5ba14425c2.r2.dev/sample-docs/math-formulas.pdf',
      fileName: 'math-formulas.pdf',
      fileType: 'pdf',
      fileSize: 3000000,
      mimeType: 'application/pdf',
    },
    Chemistry: {
      fileUrl: 'https://pub-c9b3003981b04829beec1b5ba14425c2.r2.dev/sample-docs/chemistry-notes.pdf',
      fileName: 'chemistry-notes.pdf',
      fileType: 'pdf',
      fileSize: 3500000,
      mimeType: 'application/pdf',
    },
    Physics: {
      fileUrl: 'https://pub-c9b3003981b04829beec1b5ba14425c2.r2.dev/sample-docs/physics-reference.pdf',
      fileName: 'physics-reference.pdf',
      fileType: 'pdf',
      fileSize: 2800000,
      mimeType: 'application/pdf',
    },
    Literature: {
      fileUrl: 'https://pub-c9b3003981b04829beec1b5ba14425c2.r2.dev/sample-docs/literature-analysis.pdf',
      fileName: 'literature-analysis.pdf',
      fileType: 'pdf',
      fileSize: 4000000,
      mimeType: 'application/pdf',
    },
    'Computer Science': {
      fileUrl: 'https://pub-c9b3003981b04829beec1b5ba14425c2.r2.dev/sample-docs/programming-guide.pdf',
      fileName: 'programming-guide.pdf',
      fileType: 'pdf',
      fileSize: 5000000,
      mimeType: 'application/pdf',
    },
  },
  image: {
    fileUrl: 'https://pub-c9b3003981b04829beec1b5ba14425c2.r2.dev/sample-docs/diagram.png',
    fileName: 'diagram.png',
    fileType: 'image',
    fileSize: 1200000,
    mimeType: 'image/png',
  },
  video: {
    fileUrl: 'https://pub-c9b3003981b04829beec1b5ba14425c2.r2.dev/sample-docs/tutorial.mp4',
    fileName: 'tutorial.mp4',
    fileType: 'video',
    fileSize: 8000000,
    mimeType: 'video/mp4',
  },
};

// Diverse document titles for each subject
const DOCUMENT_TEMPLATES = {
  English: [
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
      title: 'Grammar Structure Diagrams',
      description: 'Visual diagrams of English grammar structures',
      type: 'image',
    },
    {
      title: 'English Pronunciation Tutorial',
      description: 'Video guide to English pronunciation',
      type: 'video',
    },
  ],
  Mathematics: [
    {
      title: 'Calculus Fundamentals',
      description: 'Essential calculus concepts and formulas',
      type: 'pdf',
    },
    {
      title: 'Statistics Problem Sets',
      description: 'Practice problems with detailed solutions',
      type: 'pdf',
    },
    {
      title: 'Linear Algebra Notes',
      description: 'Complete notes on linear algebra topics',
      type: 'pdf',
    },
    {
      title: 'Mathematical Graphs and Charts',
      description: 'Visual representation of mathematical concepts',
      type: 'image',
    },
    {
      title: 'Calculus Problem Solving Video',
      description: 'Step-by-step video tutorial for calculus',
      type: 'video',
    },
  ],
  Chemistry: [
    {
      title: 'Organic Chemistry Reactions',
      description: 'Complete guide to organic chemistry reactions',
      type: 'pdf',
    },
    {
      title: 'Lab Safety Guidelines',
      description: 'Essential safety procedures for chemistry labs',
      type: 'pdf',
    },
    {
      title: 'Periodic Table Guide',
      description: 'Detailed periodic table with element properties',
      type: 'pdf',
    },
    {
      title: 'Chemical Bonding Diagrams',
      description: 'Visual guide to chemical bonds and structures',
      type: 'image',
    },
    {
      title: 'Lab Experiment Demonstration',
      description: 'Video demonstration of chemistry experiments',
      type: 'video',
    },
  ],
  Physics: [
    {
      title: 'Mechanics Problem Solving',
      description: 'Step-by-step solutions to mechanics problems',
      type: 'pdf',
    },
    {
      title: 'Electromagnetism Notes',
      description: 'Comprehensive notes on electromagnetic theory',
      type: 'pdf',
    },
    {
      title: 'Physics Formula Sheet',
      description: 'All essential physics formulas in one place',
      type: 'pdf',
    },
    {
      title: 'Physics Concept Illustrations',
      description: 'Diagrams explaining physics principles',
      type: 'image',
    },
    {
      title: 'Physics Experiment Video',
      description: 'Real-world physics experiments and demonstrations',
      type: 'video',
    },
  ],
  Literature: [
    {
      title: 'Vietnamese Literature Classics',
      description: 'Analysis of classic Vietnamese literary works',
      type: 'pdf',
    },
    {
      title: 'Creative Writing Techniques',
      description: 'Methods and exercises for creative writing',
      type: 'pdf',
    },
    {
      title: 'Literary Analysis Guide',
      description: 'How to analyze and interpret literature',
      type: 'pdf',
    },
    {
      title: 'Literary Timeline Infographic',
      description: 'Visual timeline of literary movements',
      type: 'image',
    },
    {
      title: 'Poetry Reading Session',
      description: 'Video recordings of classic poetry readings',
      type: 'video',
    },
  ],
  'Computer Science': [
    {
      title: 'Data Structures and Algorithms',
      description: 'Complete guide to DSA with code examples',
      type: 'pdf',
    },
    {
      title: 'Python Programming Basics',
      description: 'Introduction to Python programming',
      type: 'pdf',
    },
    {
      title: 'Algorithm Complexity Analysis',
      description: 'Understanding Big O notation and complexity',
      type: 'pdf',
    },
    {
      title: 'Algorithm Flowcharts',
      description: 'Visual flowcharts of common algorithms',
      type: 'image',
    },
    {
      title: 'Coding Tutorial Series',
      description: 'Video tutorials on programming concepts',
      type: 'video',
    },
  ],
};

async function seedDocuments() {
  console.log('📄 Seeding documents for teachers...');

  // Get all teachers
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    include: { teacherProfile: true },
  });

  if (teachers.length === 0) {
    console.log('⚠️  No teachers found. Please run main seed first.');
    return;
  }

  let totalDocuments = 0;

  for (const teacher of teachers) {
    // Get teacher's main subject
    const mainSubject = teacher.teacherProfile?.subjects[0] || 'English';
    const subjectKey = mainSubject.includes('English')
      ? 'English'
      : mainSubject.includes('Math') || mainSubject.includes('Calculus') || mainSubject.includes('Statistics')
      ? 'Mathematics'
      : mainSubject.includes('Chemistry')
      ? 'Chemistry'
      : mainSubject.includes('Physics')
      ? 'Physics'
      : mainSubject.includes('Literature')
      ? 'Literature'
      : mainSubject.includes('Computer') || mainSubject.includes('Programming')
      ? 'Computer Science'
      : 'English';

    const templates =
      (DOCUMENT_TEMPLATES as any)[subjectKey] || DOCUMENT_TEMPLATES.English;

    for (const template of templates) {
      try {
        let sharedFile;
        if (template.type === 'image') {
          sharedFile = SHARED_DOCUMENT_FILES.image;
        } else if (template.type === 'video') {
          sharedFile = SHARED_DOCUMENT_FILES.video;
        } else {
          sharedFile = (SHARED_DOCUMENT_FILES.pdf as any)[subjectKey] || SHARED_DOCUMENT_FILES.pdf.English;
        }

        await prisma.document.create({
          data: {
            teacherId: teacher.id,
            title: template.title,
            description: template.description,
            fileUrl: sharedFile.fileUrl, // Reuse shared file URL
            fileName: sharedFile.fileName,
            fileType: sharedFile.fileType,
            fileSize: sharedFile.fileSize,
            mimeType: sharedFile.mimeType,
          },
        });
        totalDocuments++;
      } catch (error) {
        console.error(`❌ Error creating document for ${teacher.fullName}:`, error);
      }
    }
    console.log(
      `  ✅ Created ${templates.length} documents for ${teacher.fullName} (${subjectKey})`
    );
  }

  console.log(`\n✨ Document seeding completed! Created ${totalDocuments} documents.`);
  const totalUniqueFiles = Object.keys(SHARED_DOCUMENT_FILES.pdf).length + 2; // PDFs + 1 image + 1 video
  console.log(`💾 Only ${totalUniqueFiles} unique files needed on R2 (${Object.keys(SHARED_DOCUMENT_FILES.pdf).length} PDFs + 1 image + 1 video)!`);
}

async function main() {
  try {
    await seedDocuments();
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
