"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { mockRecordings, Recording } from "@/utils/data/teacher/mockRecordings";
import { trackWatchActivity } from "@/utils/trackActivity";
import { ArrowLeft, Calendar, Clock, Download, Share2 } from "lucide-react";

export default function RecordingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params?.id as string;
  const recordingID = params?.recordingID as string;

  const recording: Recording | undefined = mockRecordings.find(r => r.id === recordingID);

  // Track watch activity when video loads
  useEffect(() => {
    if (recordingID && recording) {
      trackWatchActivity('video', recordingID);
    }
  }, [recordingID, recording]);

  if (!recording) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎥</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Recording not found</h2>
          <p className="text-gray-600 mb-6">The recording you are looking for does not exist or has been removed.</p>
          <button
            onClick={() => router.back()}
            className="bg-[#292C6D] text-white px-6 py-2 rounded-lg hover:bg-[#1f2350] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-[#292C6D] mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Recordings</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video Section */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Player */}
            <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
              <video
                src={recording.videopath || "/logo.png"}
                controls
                className="w-full aspect-video object-cover"
                poster={recording.thumbnail}
              />
            </div>

            {/* Video Info Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{recording.title}</h1>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[#292C6D]" />
                  <span>{recording.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[#292C6D]" />
                  <span>Recording from {recording.month}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-[#292C6D] text-white rounded-lg hover:bg-[#1f2350] transition-colors">
                  <Download size={18} />
                  Download
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  <Share2 size={18} />
                  Share
                </button>
              </div>
            </div>

            {/* Description Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
              <p className="text-gray-600 leading-relaxed">
                This recording contains valuable content from the livestream session. 
                Students can review the material at their own pace and revisit important concepts covered during the live session.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Recording Info Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Recording Information</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Date</span>
                  <span className="font-semibold text-gray-900">{recording.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Month</span>
                  <span className="font-semibold text-gray-900">{recording.month}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Recording ID</span>
                  <span className="font-semibold text-gray-900 text-xs">{recording.id}</span>
                </div>
              </div>
            </div>

            {/* Related Recordings */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Related Recordings</h3>
              <div className="space-y-3">
                {mockRecordings.slice(0, 4).filter(r => r.id !== recordingID).map((rec) => (
                  <div
                    key={rec.id}
                    className="flex gap-3 cursor-pointer group"
                    onClick={() => router.push(`/teacher/${teacherId}/recordings/detail/${rec.id}`)}
                  >
                    <div className="relative w-32 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                      <Image
                        src={rec.thumbnail}
                        alt={rec.title}
                        width={128}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-[#292C6D] transition-colors">
                        {rec.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">{rec.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
