"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ArrowDownToLine, Upload } from "lucide-react";
import { getTeacherDocuments, uploadDocument, Document, mapDocumentTypeToFileType } from "@/lib/api/teacher";

export default function DocumentsTypePage() {
  const params = useParams();
  const type = params?.type as string;
  const teacherId = params?.id as string;

  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents from backend
  useEffect(() => {
    if (!teacherId || !type) return;
    
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const fileType = mapDocumentTypeToFileType(type);
        const data = await getTeacherDocuments(teacherId, fileType);
        setDocuments(data);
      } catch (err) {
        console.error('Failed to fetch documents:', err);
        setError('Failed to load documents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [teacherId, type]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const uploadedDocs: Document[] = [];
      for (const file of Array.from(files)) {
        const data = await uploadDocument(teacherId, file);
        uploadedDocs.push(data);
      }
      
      // Add new documents to list
      setDocuments([...uploadedDocs, ...documents]);
      alert('Documents uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload documents. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[400px]">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[400px]">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Upload Button */}
      <div className="mb-4 flex justify-end">
        <label className="bg-[#EC255A] text-white px-4 py-2 rounded-lg hover:bg-red-600 cursor-pointer inline-flex items-center gap-2">
          <Upload size={20} />
          <span>{isUploading ? 'Uploading...' : 'Upload Documents'}</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-black">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="bg-white shadow p-3 cursor-pointer hover:shadow-md transition"
            onClick={() => setSelectedDoc(doc)}
          >
            
              <div className="h-35 w-full relative rounded overflow-hidden">
                <div className="w-full flex rounded-lg justify-center mt-2">
                <Image
                    src={doc.thumbnail || "/logo.png"}
                    alt={doc.title}
                    width={110}
                    height={100}
                    style={{ objectFit: "contain" }}
                />
                </div>
              </div>
           
            <p className="mt-2 text-sm font-semibold truncate">{doc.title}</p>
            <p className="text-xs text-gray-500">
              {new Date(doc.uploadedAt).toLocaleDateString()}
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
              Uploaded: {new Date(selectedDoc.uploadedAt).toLocaleString()}
            </p>
            
            {selectedDoc.description && (
              <p className="text-sm mb-2">{selectedDoc.description}</p>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-sm">
                File: <span className="font-semibold">{selectedDoc.fileName}</span>
              </p>
              <p className="text-sm">
                Type: <span className="font-semibold">{selectedDoc.fileType}</span>
              </p>
              <p className="text-sm">
                Size: <span className="font-semibold">{(selectedDoc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              </p>
            </div>

            {selectedDoc.fileType === 'image' && selectedDoc.thumbnail && (
              <div className="w-full mt-4 flex justify-center">
                <Image
                  src={selectedDoc.thumbnail}
                  alt={selectedDoc.title}
                  width={400}
                  height={350}
                  style={{ objectFit: "contain" }}
                />
              </div>
            )}

            {selectedDoc.fileType === 'video' && selectedDoc.fileUrl && (
              <video
                src={selectedDoc.fileUrl}
                poster={selectedDoc.thumbnail || "/logo.png"}
                className="mt-4 w-full rounded"
                controls
              />
            )}

            <a
              href={selectedDoc.fileUrl}
              download={selectedDoc.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block px-4 py-2 bg-[#EC255A] text-white rounded hover:bg-[#EC255A]/90 transition"
            >
              <ArrowDownToLine/>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
