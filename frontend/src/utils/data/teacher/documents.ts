// utils/data.ts
export type Course = {
  id: string;
  name: string;
};

export type Tag = {
  id: string;
  name: string;
};

export enum ETypeDocument {
  FILE = "FILE",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
}

export type DocumentItem = {
  id: string;
  title: string;
  type: ETypeDocument;
  uploadedDate: string; // ISO timestamp
  course: Course;
  tag: Tag[];
  thumbnail: string; // cho IMAGE / VIDEO
};

// fake data
export const documents: DocumentItem[] = [
  // FILE (hiện tại 3 items)
  {
    id: "1",
    title: "Lecture 01 - Introduction.pdf",
    type: ETypeDocument.FILE,
    uploadedDate: "2025-09-20T10:15:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t1", name: "lecture" }, { id: "t2", name: "pdf" }],
    thumbnail: "/logo.png",
  },
  {
    id: "2",
    title: "Homework1.docx",
    type: ETypeDocument.FILE,
    uploadedDate: "2025-09-21T12:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t3", name: "homework" }],
    thumbnail: "/logo.png",
  },
  {
    id: "3",
    title: "Project Proposal.pptx",
    type: ETypeDocument.FILE,
    uploadedDate: "2025-09-22T09:00:00Z",
    course: { id: "c2", name: "Software Design" },
    tag: [{ id: "t4", name: "project" }, { id: "t5", name: "slides" }],
    thumbnail: "/logo.png",
  },
  // FILE thêm 5 items
  {
    id: "6",
    title: "Syllabus.pdf",
    type: ETypeDocument.FILE,
    uploadedDate: "2025-09-23T11:00:00Z",
    course: { id: "c2", name: "Software Design" },
    tag: [{ id: "t8", name: "syllabus" }],
    thumbnail: "/logo.png",
  },
  {
    id: "7",
    title: "Homework2.docx",
    type: ETypeDocument.FILE,
    uploadedDate: "2025-09-24T13:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t9", name: "homework" }],
    thumbnail: "/logo.png",
  },
  {
    id: "8",
    title: "Final Report.docx",
    type: ETypeDocument.FILE,
    uploadedDate: "2025-09-25T15:00:00Z",
    course: { id: "c2", name: "Software Design" },
    tag: [{ id: "t10", name: "report" }],
    thumbnail: "/logo.png",
  },
  {
    id: "9",
    title: "Lecture 02 - Advanced.pdf",
    type: ETypeDocument.FILE,
    uploadedDate: "2025-09-26T10:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t11", name: "lecture" }],
    thumbnail: "/logo.png",
  },
  {
    id: "10",
    title: "Project Guidelines.docx",
    type: ETypeDocument.FILE,
    uploadedDate: "2025-09-27T09:30:00Z",
    course: { id: "c2", name: "Software Design" },
    tag: [{ id: "t12", name: "guidelines" }],
    thumbnail: "/logo.png",
  },

  // IMAGE (hiện tại 1 item)
  {
    id: "4",
    title: "AI Diagram.png",
    type: ETypeDocument.IMAGE,
    uploadedDate: "2025-09-23T08:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t6", name: "diagram" }],
    thumbnail: "/logo.png",
  },
  // IMAGE thêm 5 items
  {
    id: "11",
    title: "Flowchart.png",
    type: ETypeDocument.IMAGE,
    uploadedDate: "2025-09-24T08:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t13", name: "diagram" }],
    thumbnail: "/logo.png",
  },
  {
    id: "12",
    title: "Classroom.png",
    type: ETypeDocument.IMAGE,
    uploadedDate: "2025-09-25T08:00:00Z",
    course: { id: "c2", name: "Software Design" },
    tag: [{ id: "t14", name: "photo" }],
    thumbnail: "/logo.png",
  },
  {
    id: "13",
    title: "Architecture.png",
    type: ETypeDocument.IMAGE,
    uploadedDate: "2025-09-26T08:00:00Z",
    course: { id: "c2", name: "Software Design" },
    tag: [{ id: "t15", name: "diagram" }],
    thumbnail: "/logo.png",
  },
  {
    id: "14",
    title: "AI Concept.png",
    type: ETypeDocument.IMAGE,
    uploadedDate: "2025-09-27T08:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t16", name: "diagram" }],
    thumbnail: "/logo.png",
  },
  {
    id: "15",
    title: "System Flow.png",
    type: ETypeDocument.IMAGE,
    uploadedDate: "2025-09-28T08:00:00Z",
    course: { id: "c2", name: "Software Design" },
    tag: [{ id: "t17", name: "diagram" }],
    thumbnail: "/logo.png",
  },

  // VIDEO (hiện tại 1 item)
  {
    id: "5",
    title: "Lecture Video.mp4",
    type: ETypeDocument.VIDEO,
    uploadedDate: "2025-09-24T10:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t7", name: "lecture" }],
    thumbnail: "/logo.png",
  },
  // VIDEO thêm 5 items
  {
    id: "16",
    title: "Demo Video.mp4",
    type: ETypeDocument.VIDEO,
    uploadedDate: "2025-09-25T10:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t18", name: "demo" }],
    thumbnail: "/logo.png",
  },
  {
    id: "17",
    title: "Tutorial Video.mp4",
    type: ETypeDocument.VIDEO,
    uploadedDate: "2025-09-26T10:00:00Z",
    course: { id: "c2", name: "Software Design" },
    tag: [{ id: "t19", name: "tutorial" }],
    thumbnail: "/logo.png",
  },
  {
    id: "18",
    title: "Lecture 03.mp4",
    type: ETypeDocument.VIDEO,
    uploadedDate: "2025-09-27T10:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t20", name: "lecture" }],
    thumbnail: "/logo.png",
  },
  {
    id: "19",
    title: "Project Video.mp4",
    type: ETypeDocument.VIDEO,
    uploadedDate: "2025-09-28T10:00:00Z",
    course: { id: "c2", name: "Software Design" },
    tag: [{ id: "t21", name: "project" }],
    thumbnail: "/logo.png",
  },
  {
    id: "20",
    title: "Animation.mp4",
    type: ETypeDocument.VIDEO,
    uploadedDate: "2025-09-29T10:00:00Z",
    course: { id: "c1", name: "AI Basics" },
    tag: [{ id: "t22", name: "animation" }],
    thumbnail: "/logo.png",
  },
];
