"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ArrowDownToLine, Upload, Trash2 } from "lucide-react";
import { getTeacherDocuments, uploadDocument, deleteDocument, Document, mapDocumentTypeToFileType } from "@/lib/api/teacher";
import { formatDate, formatDateTime } from "@/utils/dateFormat";

export default function DocumentsTypePage() {
  const params = useParams();
  const type = params?.type as string;
  const teacherId = params?.id as string;

  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  // Fetch documents from backend
  useEffect(() => {
    if (!teacherId || !type) return;
    
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const fileType = mapDocumentTypeToFileType(type);
        console.log('Fetching documents:', { teacherId, type, fileType });
        const data = await getTeacherDocuments(teacherId, fileType);
        console.log('Documents received:', data);
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

  const handleDeleteClick = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocumentToDelete(doc);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDocument(teacherId, documentToDelete.id);
      setDocuments(documents.filter(doc => doc.id !== documentToDelete.id));
      
      // Close preview if the deleted document was selected
      if (selectedDoc?.id === documentToDelete.id) {
        setSelectedDoc(null);
      }
      
      alert('Document deleted successfully!');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDocumentToDelete(null);
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
            className="bg-white shadow p-3 cursor-pointer hover:shadow-md transition rounded-lg relative group"
            onClick={() => setSelectedDoc(doc)}
          >
            {/* Delete Button */}
            <button
              onClick={(e) => handleDeleteClick(doc, e)}
              className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
              title="Delete document"
            >
              <Trash2 size={14} />
            </button>
            <div className="h-32 w-full relative rounded overflow-hidden bg-gray-100 flex items-center justify-center">
              {doc.fileType === 'image' ? (
                <Image
                  src={doc.fileUrl}
                  alt={doc.title}
                  fill
                  style={{ objectFit: "cover" }}
                  className="rounded"
                />
              ) : doc.fileType === 'pdf' ? (
                <div className="flex flex-col items-center justify-center text-red-500">
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" />
                  </svg>
                  <span className="text-xs font-semibold mt-1">PDF</span>
                </div>
              ) : doc.fileType === 'video' ? (
                <div className="flex flex-col items-center justify-center text-blue-500">
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                  <span className="text-xs font-semibold mt-1">VIDEO</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-semibold mt-1">FILE</span>
                </div>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold truncate" title={doc.title}>{doc.title}</p>
            <p className="text-xs text-gray-500">
              {formatDate(doc.uploadedAt)}
            </p>
          </div>
        ))}
      </div>

      {/* Drawer Preview */}
      {selectedDoc && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={() => setSelectedDoc(null)}
          />
          
          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto animate-slide-in">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-black mb-1">{selectedDoc.title}</h3>
                  <p className="text-sm text-gray-500">
                    Uploaded: {formatDateTime(selectedDoc.uploadedAt)}
                  </p>
                </div>
                <button
                  className="ml-4 text-gray-400 hover:text-gray-600 transition"
                  onClick={() => setSelectedDoc(null)}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Description */}
              {selectedDoc.description && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-black">{selectedDoc.description}</p>
                </div>
              )}

              {/* File Info */}
              <div className="mb-6 grid grid-cols-2 gap-4 text-black">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">File Name</p>
                  <p className="text-sm font-semibold truncate">{selectedDoc.fileName}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <p className="text-sm font-semibold uppercase">{selectedDoc.fileType}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Size</p>
                  <p className="text-sm font-semibold">{(selectedDoc.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">MIME Type</p>
                  <p className="text-sm font-semibold truncate">{selectedDoc.mimeType}</p>
                </div>
              </div>

              {/* Preview */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-black mb-3">Preview</h4>
                
                {selectedDoc.fileType === 'image' && (
                  <div className="w-full rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                    <Image
                      src={selectedDoc.fileUrl}
                      alt={selectedDoc.title}
                      width={800}
                      height={600}
                      style={{ objectFit: "contain" }}
                      className="max-h-[500px]"
                    />
                  </div>
                )}

                {selectedDoc.fileType === 'video' && (
                  <video
                    src={selectedDoc.fileUrl}
                    className="w-full rounded-lg"
                    controls
                  />
                )}

                {selectedDoc.fileType === 'pdf' && (
                  <div className="w-full h-[600px] rounded-lg overflow-hidden border">
                    <iframe
                      src={selectedDoc.fileUrl}
                      className="w-full h-full"
                      title={selectedDoc.title}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <a
                  href={selectedDoc.fileUrl}
                  download={selectedDoc.fileName}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#EC255A] text-white rounded-lg hover:bg-[#EC255A]/90 transition font-semibold"
                >
                  <ArrowDownToLine size={20} />
                  Download
                </a>
                <a
                  href={selectedDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition font-semibold"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(selectedDoc, e);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold"
                >
                  <Trash2 size={20} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && documentToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Document?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Document:</p>
              <p className="font-semibold text-gray-900">{documentToDelete.title}</p>
              <p className="text-xs text-gray-500 mt-1">{documentToDelete.fileName}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDocumentToDelete(null);
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
