"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { mockRecordings, Recording } from "@/utils/data/teacher/mockRecordings";
import { raleway } from "@/utils/front";

export default function RecordingDetailPage() {
  const params = useParams();
  const teacherId = params?.id as string;
  const recordingID = params?.recordingID as string;

  const recording: Recording | undefined = mockRecordings.find(r => r.id === recordingID);

  if (!recording) {
    return (
      <div className={`p-5 text-black ${raleway.className}`}>
        <h2 className="text-2xl font-semibold">Recording not found</h2>
        <p>Teacher ID: {teacherId}</p>
        <p>Recording ID: {recordingID}</p>
      </div>
    );
  }

  return (
    <div className={`p-5 text-black ${raleway.className}`}>
      <h2 className="text-2xl font-semibold mb-4">{recording.title}</h2>
      <p className="text-sm text-gray-500 mb-2">Teacher ID: {teacherId}</p>
      <p className="text-sm text-gray-500 mb-4">Date: {recording.date}</p>

      {/* Video player */}
      <div className="w-full max-w-3xl aspect-video bg-black mb-4">
        <video
          src={recording.videopath || "/logo.png"}
          controls
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
