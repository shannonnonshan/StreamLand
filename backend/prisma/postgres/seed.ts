import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PostgreSQL database...');

  // Hash password for all users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create multiple teachers
  const teachers = [
    {
      email: 'david.nguyen@streamland.com',
      fullName: 'Mr. David Nguyen',
      bio: 'Passionate IELTS instructor with 10+ years of experience. Specialized in Speaking and Writing preparation.',
      avatar: 'https://i.pravatar.cc/150?img=12',
      subjects: ['English', 'IELTS', 'TOEFL'],
      experience: 10,
      education: 'Master in English Literature',
      rating: 4.8,
      totalStudents: 1250,
      totalCourses: 15,
    },
    {
      email: 'lan.anh@streamland.com',
      fullName: 'Ms. Lan Anh',
      bio: 'Mathematics teacher specializing in Calculus and Statistics. Making complex topics simple and fun!',
      avatar: 'https://i.pravatar.cc/150?img=47',
      subjects: ['Mathematics', 'Calculus', 'Statistics'],
      experience: 8,
      education: 'PhD in Mathematics',
      rating: 4.9,
      totalStudents: 980,
      totalCourses: 12,
    },
    {
      email: 'thao.nguyen@streamland.com',
      fullName: 'Ms. Thao',
      bio: 'Chemistry enthusiast dedicated to helping students understand organic and inorganic chemistry.',
      avatar: 'https://i.pravatar.cc/150?img=45',
      subjects: ['Chemistry', 'Organic Chemistry', 'Lab Techniques'],
      experience: 7,
      education: 'Master in Chemistry',
      rating: 4.7,
      totalStudents: 850,
      totalCourses: 10,
    },
    {
      email: 'minh.tuan@streamland.com',
      fullName: 'Mr. Minh Tuan',
      bio: 'Physics teacher with a passion for experimental learning. Expert in mechanics and electromagnetism.',
      avatar: 'https://i.pravatar.cc/150?img=33',
      subjects: ['Physics', 'Mechanics', 'Electromagnetism'],
      experience: 9,
      education: 'Master in Physics',
      rating: 4.6,
      totalStudents: 720,
      totalCourses: 11,
    },
    {
      email: 'phuong.linh@streamland.com',
      fullName: 'Ms. Phuong Linh',
      bio: 'Literature teacher passionate about Vietnamese and world literature. Creative writing specialist.',
      avatar: 'https://i.pravatar.cc/150?img=44',
      subjects: ['Literature', 'Vietnamese', 'Creative Writing'],
      experience: 6,
      education: 'Master in Literature',
      rating: 4.9,
      totalStudents: 650,
      totalCourses: 9,
    },
    {
      email: 'john.smith@streamland.com',
      fullName: 'Dr. John Smith',
      bio: 'Computer Science professor with industry experience. Specialized in algorithms and data structures.',
      avatar: 'https://i.pravatar.cc/150?img=15',
      subjects: ['Computer Science', 'Programming', 'Algorithms'],
      experience: 12,
      education: 'PhD in Computer Science',
      rating: 5.0,
      totalStudents: 1500,
      totalCourses: 20,
    },
  ];

  const createdTeachers = [];
  
  for (const teacherData of teachers) {
    const teacher = await prisma.user.upsert({
      where: { email: teacherData.email },
      update: {},
      create: {
        email: teacherData.email,
        password: hashedPassword,
        fullName: teacherData.fullName,
        bio: teacherData.bio,
        avatar: teacherData.avatar,
        role: 'TEACHER',
        isVerified: true,
        teacherProfile: {
          create: {
            subjects: teacherData.subjects,
            experience: teacherData.experience,
            education: teacherData.education,
            rating: teacherData.rating,
            totalStudents: teacherData.totalStudents,
          },
        },
      },
      include: {
        teacherProfile: true,
      },
    });
    createdTeachers.push(teacher);
    console.log(`✅ Created teacher: ${teacher.fullName}`);
  }

  // Create sample students
  const students = [
    {
      email: 'student1@streamland.com',
      fullName: 'Minh Anh',
      avatar: 'https://i.pravatar.cc/150?img=1',
      bio: 'Passionate learner interested in technology and languages',
      school: 'Nguyen Hue High School',
      grade: '12A1',
      interests: ['English', 'Programming', 'Mathematics'],
    },
    {
      email: 'student2@streamland.com',
      fullName: 'Hoang Nam',
      avatar: 'https://i.pravatar.cc/150?img=8',
      bio: 'Science enthusiast with a love for physics experiments',
      school: 'Le Hong Phong High School',
      grade: '11B2',
      interests: ['Physics', 'Chemistry', 'Mathematics'],
    },
    {
      email: 'student3@streamland.com',
      fullName: 'Thu Trang',
      avatar: 'https://i.pravatar.cc/150?img=5',
      bio: 'Literature lover and creative writer',
      school: 'Tran Phu High School',
      grade: '12C3',
      interests: ['Literature', 'English', 'History'],
    },
    {
      email: 'student4@streamland.com',
      fullName: 'Quoc Bao',
      avatar: 'https://i.pravatar.cc/150?img=13',
      bio: 'Math wizard and problem solver',
      school: 'Nguyen Du High School',
      grade: '11A3',
      interests: ['Mathematics', 'Computer Science', 'Chess'],
    },
    {
      email: 'student5@streamland.com',
      fullName: 'Khanh Linh',
      avatar: 'https://i.pravatar.cc/150?img=20',
      bio: 'Aspiring chemist with a passion for research',
      school: 'Le Quy Don High School',
      grade: '12B1',
      interests: ['Chemistry', 'Biology', 'Research'],
    },
    {
      email: 'student6@streamland.com',
      fullName: 'Duc Huy',
      avatar: 'https://i.pravatar.cc/150?img=11',
      bio: 'Future engineer interested in robotics',
      school: 'Tran Dai Nghia High School',
      grade: '11C2',
      interests: ['Physics', 'Mathematics', 'Robotics'],
    },
    {
      email: 'student7@streamland.com',
      fullName: 'Bich Ngoc',
      avatar: 'https://i.pravatar.cc/150?img=25',
      bio: 'Language learner fluent in English and French',
      school: 'Nguyen Thi Minh Khai High School',
      grade: '12A2',
      interests: ['English', 'French', 'Literature'],
    },
    {
      email: 'student8@streamland.com',
      fullName: 'Tan Phat',
      avatar: 'https://i.pravatar.cc/150?img=52',
      bio: 'Computer science student and coding enthusiast',
      school: 'Tran Hung Dao High School',
      grade: '11B3',
      interests: ['Programming', 'AI', 'Mathematics'],
    },
  ];

  const createdStudents = [];

  for (const studentData of students) {
    const student = await prisma.user.upsert({
      where: { email: studentData.email },
      update: {},
      create: {
        email: studentData.email,
        password: hashedPassword,
        fullName: studentData.fullName,
        avatar: studentData.avatar,
        bio: studentData.bio,
        role: 'STUDENT',
        isVerified: true,
        studentProfile: {
          create: {
            school: studentData.school,
            grade: studentData.grade,
            interests: studentData.interests,
          },
        },
      },
      include: {
        studentProfile: true,
      },
    });
    createdStudents.push(student);
    console.log(`✅ Created student: ${student.fullName}`);
  }

  // Create some follow relationships
  if (createdStudents.length > 0 && createdTeachers.length > 0) {
    const student1 = createdStudents[0];
    
    // Student 1 follows first 3 teachers
    for (let i = 0; i < Math.min(3, createdTeachers.length); i++) {
      await prisma.followedTeacher.upsert({
        where: {
          studentId_teacherId: {
            studentId: student1.studentProfile!.id,
            teacherId: createdTeachers[i].teacherProfile!.id,
          },
        },
        update: {},
        create: {
          studentId: student1.studentProfile!.id,
          teacherId: createdTeachers[i].teacherProfile!.id,
        },
      });
      console.log(`✅ ${student1.fullName} now follows ${createdTeachers[i].fullName}`);
    }
  }

  // Create some friend relationships
  if (createdStudents.length >= 4) {
    // Student 1 (Minh Anh) sends friend request to Student 2 (Hoang Nam) - PENDING
    await prisma.friendList.upsert({
      where: {
        requestId_receiverId: {
          requestId: createdStudents[0].studentProfile!.id,
          receiverId: createdStudents[1].studentProfile!.id,
        },
      },
      update: {},
      create: {
        requestId: createdStudents[0].studentProfile!.id,
        receiverId: createdStudents[1].studentProfile!.id,
        status: 'PENDING',
      },
    });
    console.log(`✅ ${createdStudents[0].fullName} sent friend request to ${createdStudents[1].fullName} (PENDING)`);

    // Student 1 (Minh Anh) and Student 3 (Thu Trang) are friends - ACCEPTED
    await prisma.friendList.upsert({
      where: {
        requestId_receiverId: {
          requestId: createdStudents[0].studentProfile!.id,
          receiverId: createdStudents[2].studentProfile!.id,
        },
      },
      update: {},
      create: {
        requestId: createdStudents[0].studentProfile!.id,
        receiverId: createdStudents[2].studentProfile!.id,
        status: 'ACCEPTED',
      },
    });
    console.log(`✅ ${createdStudents[0].fullName} and ${createdStudents[2].fullName} are now friends (ACCEPTED)`);

    // Student 4 (Quoc Bao) sent request to Student 1 (Minh Anh) - PENDING
    await prisma.friendList.upsert({
      where: {
        requestId_receiverId: {
          requestId: createdStudents[3].studentProfile!.id,
          receiverId: createdStudents[0].studentProfile!.id,
        },
      },
      update: {},
      create: {
        requestId: createdStudents[3].studentProfile!.id,
        receiverId: createdStudents[0].studentProfile!.id,
        status: 'PENDING',
      },
    });
    console.log(`✅ ${createdStudents[3].fullName} sent friend request to ${createdStudents[0].fullName} (PENDING)`);

    // Student 2 (Hoang Nam) and Student 4 (Quoc Bao) are friends - ACCEPTED
    if (createdStudents.length >= 5) {
      await prisma.friendList.upsert({
        where: {
          requestId_receiverId: {
            requestId: createdStudents[1].studentProfile!.id,
            receiverId: createdStudents[3].studentProfile!.id,
          },
        },
        update: {},
        create: {
          requestId: createdStudents[1].studentProfile!.id,
          receiverId: createdStudents[3].studentProfile!.id,
          status: 'ACCEPTED',
        },
      });
      console.log(`✅ ${createdStudents[1].fullName} and ${createdStudents[3].fullName} are now friends (ACCEPTED)`);

      // Student 5 (Khanh Linh) and Student 1 (Minh Anh) are friends - ACCEPTED
      await prisma.friendList.upsert({
        where: {
          requestId_receiverId: {
            requestId: createdStudents[4].studentProfile!.id,
            receiverId: createdStudents[0].studentProfile!.id,
          },
        },
        update: {},
        create: {
          requestId: createdStudents[4].studentProfile!.id,
          receiverId: createdStudents[0].studentProfile!.id,
          status: 'ACCEPTED',
        },
      });
      console.log(`✅ ${createdStudents[4].fullName} and ${createdStudents[0].fullName} are now friends (ACCEPTED)`);
    }
  }

  console.log('\n✅ PostgreSQL seeding completed!');
  console.log(`📊 Created ${createdTeachers.length} teachers`);
  console.log(`📊 Created ${createdStudents.length} students`);
  console.log('\n🔑 Login credentials:');
  console.log('Email: any of the above emails');
  console.log('Password: password123');
}

main()
  .catch((e) => {
    console.error('PostgreSQL seeding failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
