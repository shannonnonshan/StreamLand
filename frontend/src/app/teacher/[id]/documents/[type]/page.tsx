"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { documents, DocumentItem, ETypeDocument } from "@/utils/data/teacher/documents";
import Image from "next/image";

export default function DocumentsTypePage() {
  // Lấy params từ hook useParams() thay vì props
  const params = useParams();
  const type = params?.type;
  const teacherId = params?.id;

  const docTypeMap: Record<string, ETypeDocument> = {
    file: ETypeDocument.FILE,
    image: ETypeDocument.IMAGE,
    video: ETypeDocument.VIDEO,
  };

  const docType =
    typeof type === "string" ? docTypeMap[type.toLowerCase()] : undefined;
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  if (!docType) return <div>Invalid document type</div>;

  const filteredDocs = documents.filter((d) => d.type === docType);

  return (
    <div className="p-4">
      {/* Grid */}
      <div className="grid grid-cols-3 gap-4 text-black">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="border rounded-lg p-3 cursor-pointer hover:shadow-md transition"
            onClick={() => setSelectedDoc(doc)}
          >
            
              <div className="h-20 w-full relative rounded overflow-hidden">
                <div className="w-full flex justify-center mt-2">
                <Image
                    src={doc.thumbnail || "/logo.png"}
                    alt={doc.title}
                    width={110}    // hoặc tuỳ bạn
                    height={100}
                    style={{ objectFit: "contain" }}
                />
                </div>
              </div>
           
            <p className="mt-2 text-sm font-semibold truncate">{doc.title}</p>
            <p className="text-xs text-gray-500">
              {new Date(doc.uploadedDate).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedDoc && (
        <div
          className="fixed inset-0 text-black bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-white p-4 rounded-lg w-2/3 max-w-lg relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
              onClick={() => setSelectedDoc(null)}
            >
              ✕
            </button>

            <h3 className="font-bold text-lg mb-2">{selectedDoc.title}</h3>
            <p className="text-sm text-gray-500 mb-2">
              Uploaded: {new Date(selectedDoc.uploadedDate).toLocaleString()}
            </p>

            {selectedDoc.type === ETypeDocument.FILE && (
              <div className="flex flex-col gap-2">
                <p className="text-sm">
                  Course: <span className="font-semibold">{selectedDoc.course.name}</span>
                </p>
                <div className="flex gap-1 flex-wrap">
                  {selectedDoc.tag.map((t) => (
                    <span
                      key={t.id}
                      className="text-xs bg-gray-100 border rounded px-2 py-0.5"
                    >
                      #{t.name}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Preview only. To download, click below.
                </p>
              </div>
            )}

            {selectedDoc.type === ETypeDocument.IMAGE && (
              <div className="w-full h-[400px] relative mt-2">
                <div className="w-full flex justify-center mt-2">
                <Image
                    src={selectedDoc.thumbnail || "/logo.png"}
                    alt={selectedDoc.title}
                    width={400}    // hoặc tuỳ bạn
                    height={350}
                    style={{ objectFit: "contain" }}
                />
                </div>
              </div>
            )}

            {selectedDoc.type === ETypeDocument.VIDEO && (
              <video
                src={selectedDoc.thumbnail || ""} // chỉ dùng video thật
                poster="/logo.png"
                className="mt-2 w-full rounded"
                controls
              />
            )}

            <a
              href={
                selectedDoc.type === ETypeDocument.FILE
                  ? "/files/" + selectedDoc.title
                  : selectedDoc.thumbnail || "/logo.png"
              }
              download
              className="mt-4 inline-block px-4 py-2 bg-[#EC255A] text-white rounded hover:bg-[#EC255A]/90 transition"
            >
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
