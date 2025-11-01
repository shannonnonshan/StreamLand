// components/DocumentDetail.tsx
"use client";

import Image from "next/image";
import { DocumentItem } from "@/utils/data/teacher/documents";

type Props = {
  doc: DocumentItem;
};

export default function DocumentDetail({ doc }: Props) {
  return (
    <div className="w-full p-4 flex flex-col items-center">
      {doc.type === "FILE" && (
        <>
          <div className="h-40 w-full flex items-center justify-center bg-gray-100 rounded text-gray-500 text-sm mb-4">
            📄 {doc.title.split(".").pop()?.toUpperCase()}
          </div>
          <Image
            src={doc.thumbnail}
            alt={doc.title}
            width={800}
            height={240}
            className="h-60 w-full object-cover rounded mb-4"
          />
        </>
      )}

      <h1 className="text-2xl font-bold mb-2">{doc.title}</h1>
      <p className="text-sm text-gray-500 mb-1">
        Uploaded: {new Date(doc.uploadedDate).toLocaleString()}
      </p>
      {doc.type === "FILE" && (
        <>
          <p className="text-sm mb-2">
            Course: <span className="font-semibold">{doc.course.name}</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            {doc.tag.map((t) => (
              <span
                key={t.id}
                className="text-xs bg-gray-100 border rounded px-2 py-0.5"
              >
                #{t.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
