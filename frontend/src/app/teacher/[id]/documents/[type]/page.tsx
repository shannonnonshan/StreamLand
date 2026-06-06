"use client";

import { useMemo, useState, useEffect } from "react";
import { useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ArrowDownToLine, Upload, Trash2, Search, Filter, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getTeacherDocuments, uploadDocument, deleteDocument, Document, mapDocumentTypeToFileType } from "@/lib/api/teacher";
import { formatDate, formatDateTime } from "@/utils/dateFormat";
import { useConfirmDialog } from "@/component/teacher/useConfirmDialog";
import ProcessingTracker from "@/component/shared/ProcessingTracker";
import TranscriptSummaryStudio from "@/component/shared/TranscriptSummaryStudio";
import { useDocumentsContext } from "../DocumentsContext";

export default function DocumentsTypePage() {
  const params = useParams();
  const type = params?.type as string;
  const teacherId = params?.id as string;
  const { showDialog, DialogComponent } = useConfirmDialog();
  const { documents, setDocuments, isLoading, setIsLoading, error, setError } = useDocumentsContext();

  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [quickFilter, setQuickFilter] = useState<"all" | "withDescription" | "large" | "recent">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingTitle, setPendingTitle] = useState("");
  const [pendingDescription, setPendingDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState("");
  const [editDescriptionLoading, setEditDescriptionLoading] = useState(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [editTitleLoading, setEditTitleLoading] = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Record<string, true>>({});
  const selectedVideoRef = useRef<HTMLVideoElement | null>(null);

  const fileTypeLabel = useMemo(() => {
    if (type === "all") return "All documents";
    if (type === "file") return "Files";
    if (type === "image") return "Images";
    if (type === "video") return "Videos";
    return "Documents";
  }, [type]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();

    return [...documents]
      .filter((doc) => {
        const matchesQuery =
          !query ||
          doc.title.toLowerCase().includes(query) ||
          doc.fileName.toLowerCase().includes(query) ||
          (doc.description || "").toLowerCase().includes(query);

        const uploadedAt = new Date(doc.uploadedAt).getTime();
        const isRecent = Number.isFinite(uploadedAt) && now - uploadedAt < 7 * 24 * 60 * 60 * 1000;
        const isLarge = doc.fileSize >= 10 * 1024 * 1024;

        const matchesQuickFilter =
          quickFilter === "all" ||
          (quickFilter === "withDescription" && Boolean(doc.description?.trim())) ||
          (quickFilter === "large" && isLarge) ||
          (quickFilter === "recent" && isRecent);

        return matchesQuery && matchesQuickFilter;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return a.title.localeCompare(b.title);
        }

        const left = new Date(a.uploadedAt).getTime();
        const right = new Date(b.uploadedAt).getTime();

        return sortBy === "oldest" ? left - right : right - left;
      });
  }, [documents, searchQuery, quickFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / itemsPerPage));

  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDocuments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDocuments, currentPage]);

  const visibleStart = filteredDocuments.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const visibleEnd = Math.min(currentPage * itemsPerPage, filteredDocuments.length);

  const stats = useMemo(() => {
    const total = documents.length;
    const withDescription = documents.filter((doc) => Boolean(doc.description?.trim())).length;
    const largeFiles = documents.filter((doc) => doc.fileSize >= 10 * 1024 * 1024).length;

    return { total, withDescription, largeFiles };
  }, [documents]);

  useEffect(() => {
    setCurrentPage(1);
  }, [type, searchQuery, quickFilter, sortBy, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const handleTranscriptSeek = (e: Event) => {
      if (!selectedDoc || selectedDoc.fileType !== 'video') return;

      const detail = (e as CustomEvent)?.detail as { start?: number } | undefined;
      if (!detail || typeof detail.start !== 'number') return;

      const video = selectedVideoRef.current;
      if (!video) return;

      try {
        video.currentTime = detail.start;
        void video.play().catch(() => {});
      } catch (err) {
        console.error('Failed to seek document video from transcript cue:', err);
      }
    };

    window.addEventListener('streamland:transcript-seek', handleTranscriptSeek as EventListener);
    return () => window.removeEventListener('streamland:transcript-seek', handleTranscriptSeek as EventListener);
  }, [selectedDoc]);

  // Fetch documents from backend
  useEffect(() => {
    if (!teacherId || !type) return;
    
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const fileType = type === "all" ? undefined : mapDocumentTypeToFileType(type);
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
  }, [teacherId, type, setDocuments, setError, setIsLoading]);

  const openUploadModal = () => {
    setPendingFiles([]);
    setPendingTitle("");
    setPendingDescription("");
    setShowUploadModal(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);
    setPendingFiles(selectedFiles);
    setPendingDescription("");
    setPendingTitle((currentTitle) => currentTitle.trim() || selectedFiles[0]?.name.replace(/\.[^.]+$/, "") || "");
    setShowUploadModal(true);
    event.target.value = '';
  };

  const handleConfirmUpload = async () => {
    setIsUploading(true);
    try {
      const uploadedDocs: Document[] = [];
      for (const file of pendingFiles) {
        const data = await uploadDocument(teacherId, file, pendingDescription, pendingTitle);
        uploadedDocs.push(data);
      }
      setDocuments((prev) => [...uploadedDocs, ...prev]);
      showDialog({
        title: 'Upload Successful',
        message: `${uploadedDocs.length} document(s) uploaded successfully!`,
        type: 'success',
        confirmText: 'OK',
        cancelText: 'Close'
      });
      setShowUploadModal(false);
      setPendingFiles([]);
      setPendingTitle("");
      setPendingDescription("");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to upload documents';
      showDialog({
        title: 'Upload Failed',
        message: `${errorMsg}. Please try again.`,
        type: 'danger',
        confirmText: 'OK',
        cancelText: 'Close'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocumentToDelete(doc);
    setShowDeleteConfirm(true);
  };

  const handlePreviewError = (documentId: string) => {
    setFailedPreviewIds((prev) => {
      if (prev[documentId]) return prev;
      return { ...prev, [documentId]: true };
    });
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDocument(teacherId, documentToDelete.id);
      setDocuments((prev) => prev.filter(doc => doc.id !== documentToDelete.id));
      
      // Close preview if the deleted document was selected
      if (selectedDoc?.id === documentToDelete.id) {
        setSelectedDoc(null);
      }
      
      showDialog({
        title: 'Delete Successful',
        message: 'Document deleted successfully!',
        type: 'success',
        confirmText: 'OK',
        cancelText: 'Close'
      });
    } catch (error) {
      console.error('Delete failed:', error);
      showDialog({
        title: 'Delete Failed',
        message: 'Failed to delete document. Please try again.',
        type: 'danger',
        confirmText: 'OK',
        cancelText: 'Close'
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDocumentToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-100">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex justify-center items-center min-h-100">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-8 pt-2 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, file name, or description"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <button
                type="button"
                className="inline-flex min-w-45 items-center justify-center gap-2.5 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={openUploadModal}
                disabled={isUploading}
              >
                <Upload size={17} />
                <span>{isUploading ? 'Uploading...' : 'Upload Documents'}</span>
              </button>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                <Filter size={16} />
                <span>Sort</span>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-emerald-300"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'recent', label: 'Recent' },
              { value: 'withDescription', label: 'With description' },
              { value: 'large', label: 'Large files' },
            ].map((item) => {
              const active = quickFilter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setQuickFilter(item.value as typeof quickFilter)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            {(searchQuery || quickFilter !== 'all' || sortBy !== 'newest') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setQuickFilter('all');
                  setSortBy('newest');
                }}
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Clear filters
              </button>
            )}
          </div>
        </section>

        {/* Grid */}
        {filteredDocuments.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 text-slate-900 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedDocuments.map((doc) => (
              (() => {
                const hasPreviewError = Boolean(failedPreviewIds[doc.id]);
                return (
              <div
                key={doc.id}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setSelectedDoc(doc)}
              >
                <button
                  onClick={(e) => handleDeleteClick(doc, e)}
                  className="absolute right-3 top-3 z-10 rounded-full bg-rose-600 p-2 text-white opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-rose-700"
                  title="Delete document"
                >
                  <Trash2 size={14} />
                </button>

                <div className="relative h-40 overflow-hidden border-b border-slate-100 bg-slate-50">
                  {!hasPreviewError && doc.fileType === 'image' ? (
                    <img
                      src={doc.fileUrl}
                      alt={doc.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() => handlePreviewError(doc.id)}
                    />
                  ) : !hasPreviewError && doc.fileType === 'video' ? (
                    <>
                      <video
                        src={doc.fileUrl}
                        className="h-full w-full object-cover pointer-events-none"
                        muted
                        playsInline
                        preload="metadata"
                        onError={() => handlePreviewError(doc.id)}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent" />
                    </>
                  ) : !hasPreviewError && doc.fileType === 'pdf' ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-600">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                        <FileText size={30} />
                      </div>
                      <span className="mt-3 text-xs font-semibold uppercase tracking-[0.2em]">
                        PDF
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-slate-500">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="mt-3 text-xs font-semibold uppercase tracking-[0.2em]">
                        {hasPreviewError ? 'Preview unavailable' : 'File'}
                      </span>
                    </div>
                  )}

                  {doc.fileType !== 'file' && (
                    <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700 shadow-sm">
                      {doc.fileType}
                    </span>
                  )}
                </div>

                <div className="space-y-2 p-3.5">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-base font-semibold text-slate-900" title={doc.title}>{doc.title}</p>
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {doc.fileType}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(doc.uploadedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {doc.description ? (
                      <p className="line-clamp-1 text-sm leading-5 text-slate-600 flex-1">{doc.description}</p>
                    ) : (
                      <p className="text-sm text-slate-400 flex-1">No description added.</p>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDoc(doc);
                        setEditDescriptionValue(doc.description || "");
                        setEditTitleValue(doc.title || "");
                        setTimeout(() => descriptionInputRef.current?.focus(), 100);
                        setEditingDescription(true);
                        setEditingTitle(true);
                      }}
                      className="p-2 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white shadow-sm transition"
                      title="Edit title & description"
                      aria-label="Edit title and description"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="pointer-events-none"><path d="M15.232 5.232l3.536 3.536M9 11l6.586-6.586a2 2 0 112.828 2.828L11.828 13.828a2 2 0 01-.707.464l-4 1a1 1 0 01-1.213-1.213l1-4a2 2 0 01.464-.707z"/></svg>
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <span>{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                    <span className="truncate">{doc.fileName}</span>
                  </div>
                </div>
              </div>
                );
              })()
            ))}
            </div>

            <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <p>
                  Showing <span className="font-semibold text-slate-900">{visibleStart}</span>
                  {' '}to <span className="font-semibold text-slate-900">{visibleEnd}</span>
                  {' '}of <span className="font-semibold text-slate-900">{filteredDocuments.length}</span> documents
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">Per page</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-400"
                  >
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={16}>16</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 lg:justify-end lg:ml-auto">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronsLeft size={16} />
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-10 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        page === currentPage
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:text-emerald-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Last
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Search size={22} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No documents found</h3>
            <p className="mt-2 text-sm text-slate-500">
              Try a different keyword or clear the filters to see all {fileTypeLabel.toLowerCase()}.
            </p>
          </div>
        )}
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
          <div
            className={`fixed right-0 top-0 z-50 h-full w-full animate-slide-in overflow-y-auto bg-white shadow-2xl ${
              selectedDoc.fileType === 'video'
                ? 'max-w-[96vw] lg:max-w-6xl xl:max-w-7xl'
                : 'max-w-2xl'
            }`}
          >
            <div className="p-6">
              {/* Header */}
              <div className="mb-6 flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Document Detail</p>
                  {editingTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="text-xl font-black tracking-tight text-slate-900 border-b border-slate-200 pb-1 focus:outline-none"
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        disabled={editTitleLoading}
                      />
                      <button
                        className="px-3 py-1 rounded bg-emerald-600 text-white text-sm font-semibold"
                        disabled={editTitleLoading}
                        onClick={async () => {
                          setEditTitleLoading(true);
                          try {
                            const updated = await import("@/lib/api/teacher").then(m => m.updateDocument(teacherId, selectedDoc.id, { title: editTitleValue, description: editingDescription ? editDescriptionValue : selectedDoc.description }));
                            setDocuments(prev => prev.map(doc => doc.id === updated.id ? updated : doc));
                            setSelectedDoc(updated);
                            setEditingTitle(false);
                          } catch (err) {
                            showDialog({ title: 'Update Failed', message: 'Could not update title.', type: 'danger', confirmText: 'OK', cancelText: 'Close' });
                          } finally {
                            setEditTitleLoading(false);
                          }
                        }}
                      >Save</button>
                      <button
                        className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-sm font-semibold"
                        disabled={editTitleLoading}
                        onClick={() => { setEditingTitle(false); setEditTitleValue(''); }}
                      >Cancel</button>
                    </div>
                  ) : (
                    <h3 className="mb-1 mt-1 text-xl font-black tracking-tight text-slate-900">{selectedDoc.title}</h3>
                  )}
                  <p className="text-sm font-medium text-slate-500">
                    Uploaded: {formatDateTime(selectedDoc.uploadedAt)}
                  </p>
                </div>
                <button
                  className="ml-4 text-slate-400 transition hover:text-slate-700"
                  onClick={() => setSelectedDoc(null)}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Description */}
              <div className="mb-4 flex items-center gap-2">
                {editingDescription ? (
                  <>
                    <div className="flex flex-col gap-3 w-full">
                      <label className="text-xs font-semibold text-slate-600">Edit title</label>
                      <input
                        className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-lg font-extrabold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 shadow-sm"
                        value={editTitleValue}
                        onChange={e => setEditTitleValue(e.target.value)}
                        disabled={editTitleLoading}
                        placeholder="Enter title..."
                      />

                      <label className="text-xs font-semibold text-slate-600">Edit description</label>
                      <textarea
                        ref={descriptionInputRef}
                        className="w-full min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 shadow-sm resize-vertical"
                        value={editDescriptionValue}
                        onChange={e => setEditDescriptionValue(e.target.value)}
                        disabled={editDescriptionLoading}
                        placeholder="Enter description..."
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-60 relative z-60 pointer-events-auto"
                        disabled={editDescriptionLoading || editTitleLoading}
                        onClick={async () => {
                          setEditDescriptionLoading(true);
                          setEditTitleLoading(true);
                          try {
                            const updated = await import("@/lib/api/teacher").then(m => m.updateDocument(teacherId, selectedDoc.id, { title: editTitleValue, description: editDescriptionValue }));
                            setDocuments(prev => prev.map(doc => doc.id === updated.id ? updated : doc));
                            setSelectedDoc(updated);
                            setEditingDescription(false);
                            setEditingTitle(false);
                          } catch (err) {
                            showDialog({
                              title: 'Update Failed',
                              message: 'Could not update document.',
                              type: 'danger',
                              confirmText: 'OK',
                              cancelText: 'Close'
                            });
                          } finally {
                            setEditDescriptionLoading(false);
                            setEditTitleLoading(false);
                          }
                        }}
                      >Save</button>
                      <button
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 relative z-60 pointer-events-auto"
                        disabled={editDescriptionLoading || editTitleLoading}
                        onClick={() => { setEditingDescription(false); setEditingTitle(false); }}
                      >Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="flex-1 text-sm text-slate-700">{selectedDoc.description || <span className="text-slate-400">No description.</span>}</p>
                    <button
                      className="ml-2 text-emerald-600 hover:text-emerald-800"
                      title="Edit description"
                      onClick={() => {
                        setEditDescriptionValue(selectedDoc.description || "");
                        setEditingDescription(true);
                        setTimeout(() => descriptionInputRef.current?.focus(), 100);
                      }}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536M9 11l6.586-6.586a2 2 0 112.828 2.828L11.828 13.828a2 2 0 01-.707.464l-4 1a1 1 0 01-1.213-1.213l1-4a2 2 0 01.464-.707z"/></svg>
                    </button>
                  </>
                )}
              </div>

              {/* File Info */}
              <div className="mb-6 grid grid-cols-2 gap-4 text-slate-900">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">File Name</p>
                  <p className="truncate text-sm font-bold">{selectedDoc.fileName}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</p>
                  <p className="text-sm font-bold uppercase">{selectedDoc.fileType}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Size</p>
                  <p className="text-sm font-bold">{(selectedDoc.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">MIME Type</p>
                  <p className="truncate text-sm font-bold">{selectedDoc.mimeType}</p>
                </div>
              </div>

              {/* Preview */}
              {selectedDoc.fileType === 'video' ? (
                <div className="mb-6 space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Preview</h4>
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                    <div className="space-y-4 lg:col-span-3">
                      <video
                        ref={selectedVideoRef}
                        src={selectedDoc.fileUrl}
                        className="aspect-video w-full rounded-lg bg-black object-cover"
                        controls
                      />
                      <ProcessingTracker
                        entityId={selectedDoc.id}
                        entityType="DOCUMENT"
                        showRetry
                        showInlineProgress
                        triggerClassName="bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700"
                      />
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                      <TranscriptSummaryStudio
                        documentId={selectedDoc.id}
                        transcriptSeedMessage="[Transcript preview] AI document transcription endpoint is pending backend integration. Extracted text will appear here."
                        transcriptHint={'Click "Generate Transcript" to extract document content as text. The "Summarize" button activates when transcript is ready.'}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <h4 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">Preview</h4>

                  {selectedDoc.fileType === 'image' && (
                    <div className="w-full rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                      <Image
                        src={selectedDoc.fileUrl}
                        alt={selectedDoc.title}
                        width={800}
                        height={600}
                        style={{ objectFit: "contain" }}
                        className="max-h-125"
                      />
                    </div>
                  )}

                  {selectedDoc.fileType === 'pdf' && (
                    <div className="w-full h-150 rounded-lg overflow-hidden border">
                      <iframe
                        src={selectedDoc.fileUrl}
                        className="w-full h-full"
                        title={selectedDoc.title}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <a
                  href={selectedDoc.fileUrl}
                  download={selectedDoc.fileName}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                >
                  <ArrowDownToLine size={18} />
                  Download
                </a>
                <a
                  href={selectedDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(selectedDoc, e);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && documentToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
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

      {/* Modal: Upload document */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-slate-900">Upload document</h3>
            <p className="mb-4 text-sm text-gray-500">Choose a file, add a title, and optionally add a description.</p>

            <input
              ref={uploadFileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />

            <button
              type="button"
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => uploadFileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload size={16} />
              {pendingFiles.length > 0 ? `Selected ${pendingFiles.length} file(s)` : 'Choose file'}
            </button>

            {pendingFiles.length > 0 && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p className="mb-2 font-semibold text-slate-700">Selected file(s)</p>
                <ul className="space-y-1">
                  {pendingFiles.map((file) => (
                    <li key={`${file.name}-${file.size}`} className="truncate">
                      {file.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <input
              className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-300"
              placeholder="Enter document title..."
              value={pendingTitle}
              onChange={e => setPendingTitle(e.target.value)}
              disabled={isUploading}
            />
            <input
              className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-300"
              placeholder="Enter document description..."
              value={pendingDescription}
              onChange={e => setPendingDescription(e.target.value)}
              disabled={isUploading}
            />
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleConfirmUpload}
                disabled={isUploading || pendingFiles.length === 0}
              >{isUploading ? 'Uploading...' : 'Confirm & Upload'}</button>
              <button
                className="flex-1 rounded-xl bg-gray-200 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => { setShowUploadModal(false); setPendingFiles([]); setPendingTitle(""); setPendingDescription(""); }}
                disabled={isUploading}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {DialogComponent}
    </div>
  );
}
