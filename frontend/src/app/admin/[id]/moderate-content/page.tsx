"use client"
import React, { useState, useMemo, useEffect } from 'react'
import { Check, X, Search, ChevronUp, ChevronDown, Filter, XCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutList, Loader2, RefreshCw } from 'lucide-react'
import ProcessingTracker from '@/component/shared/ProcessingTracker'

interface ReportedContent {
  id: string
  title: string
  author: string
  type: 'recording' | 'document'
  reportReason: string
  rejectReason?: string | null
  processingStatus?: string | null
  processingProgress?: number | null
  processingStage?: string | null
  processingError?: string | null
  reportedBy: string
  reportedAt: string
  dateReported: string
  status: 'pending' | 'approved' | 'rejected'
  isApproved: boolean
  videoUrl?: string
}

export default function ContentModerationPage() {
  const [reportedContent, setReportedContent] = useState<ReportedContent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContent, setSelectedContent] = useState<ReportedContent | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [retryingContentId, setRetryingContentId] = useState<string | null>(null)
  const [moderation, setModeration] = useState<{
    raw: Record<string, unknown> | null
    status: string
    score: number
    toxicWords: string[]
    categories?: string[]
  } | null>(null)
  const [moderationLoading, setModerationLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<'all' | 'recording' | 'document'>('all')
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all')
  const [processFilter, setProcessFilter] = useState<'all' | 'processing' | 'done' | 'failed' | 'pending'>('all')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ReportedContent
    direction: 'asc' | 'desc'
  }>({ key: 'dateReported', direction: 'desc' })

  const normalizeApprovalStatus = (value: unknown): ReportedContent['status'] => {
    const status = typeof value === 'string' ? value.trim().toLowerCase() : '';

    if (status === 'approved') return 'approved';
    if (status === 'rejected' || status === 'removed') return 'rejected';
    return 'pending';
  }

  const normalizeProcessingStatus = (value: unknown) => {
    const status = typeof value === 'string' ? value.trim().toUpperCase() : '';

    if (status === 'PROCESSING') return 'PROCESSING';
    if (status === 'DONE') return 'DONE';
    if (status === 'FAILED') return 'FAILED';
    return 'PENDING';
  }

  const getProcessingStatusClasses = (value: ReportedContent['processingStatus']) => {
    const status = normalizeProcessingStatus(value);

    if (status === 'DONE') return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
    if (status === 'PROCESSING') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
    if (status === 'FAILED') return 'bg-red-100 text-red-700 ring-1 ring-red-200';
    return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  }

  const normalizeProcessingProgress = (value: unknown) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  const getProcessingStageLabel = (value: unknown) => {
    const stage = typeof value === 'string' ? value.trim().toLowerCase() : '';

    if (stage === 'queued') return '';
    if (stage === 'preparing') return 'Preparing';
    if (stage === 'transcribing') return 'Transcribing';
    if (stage === 'summarizing') return 'Summarizing';
    if (stage === 'moderating') return 'Moderating';
    if (stage === 'done') return 'Complete';
    if (stage === 'error') return 'Failed';
    return '';
  }

  const getApprovalStatusClasses = (value: ReportedContent['status']) => {
    if (value === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (value === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  }

  const getProcessFilterValue = (content: ReportedContent): 'processing' | 'done' | 'failed' | 'pending' => {
    const processingStatus = normalizeProcessingStatus(content.processingStatus);
    if (processingStatus === 'PROCESSING') return 'processing';
    if (processingStatus === 'DONE') return 'done';
    if (processingStatus === 'FAILED') return 'failed';
    return 'pending';
  }

  useEffect(() => {
    if (!selectedContent) {
      setRejectReason('')
      return
    }

    if (selectedContent.status === 'rejected') {
      setRejectReason(selectedContent.rejectReason ?? '')
      return
    }

    setRejectReason('')
  }, [selectedContent?.id, selectedContent?.status, selectedContent?.rejectReason])

  // Fetch livestreams and documents from backend
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

        // Fetch livestreams (recordings)
        const livestreamsResponse = await fetch(`${API_URL}/admin/livestreams?limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const mappedContent: ReportedContent[] = [];

        if (livestreamsResponse.ok) {
          const data = await livestreamsResponse.json();
          const livestreamsMapped = data.livestreams.map((ls: any) => {
            const approvalStatus = normalizeApprovalStatus(
              ls.approvalStatus ?? ls.isApprove ?? ls.status
            );

            return {
              id: ls.id,
              title: ls.title,
              author: ls.uploadedBy || 'Unknown',
              type: 'recording' as const,
              reportReason: 'Pending review',
              rejectReason: ls.rejectReason ?? null,
              processingStatus: ls.processingStatus ?? null,
              processingProgress: ls.processingProgress ?? null,
              processingStage: ls.processingStage ?? null,
              processingError: ls.processingError ?? null,
              reportedBy: 'System',
              reportedAt: ls.uploadedAt,
              dateReported: new Date(ls.uploadedAt).toLocaleDateString(),
              status: approvalStatus,
              isApproved: approvalStatus === 'approved',
              videoUrl: ls.recordingUrl,
            };
          });
          mappedContent.push(...livestreamsMapped);
        }

        // Fetch documents
        const documentsResponse = await fetch(`${API_URL}/admin/documents?limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (documentsResponse.ok) {
          const data = await documentsResponse.json();
          const documentsMapped = (data.documents || data || []).map((doc: any) => {
            const approvalStatus = normalizeApprovalStatus(doc.status ?? doc.isApprove ?? doc.approvalStatus);

            return {
              id: doc.id,
              title: doc.title,
              author: doc.uploadedBy || 'Unknown',
              type: 'document' as const,
              reportReason: 'Pending review',
              rejectReason: doc.rejectReason ?? null,
              processingStatus: doc.processingStatus ?? null,
              processingProgress: doc.processingProgress ?? null,
              processingStage: doc.processingStage ?? null,
              processingError: doc.processingError ?? null,
              reportedBy: 'System',
              reportedAt: doc.uploadedAt,
              dateReported: new Date(doc.uploadedAt).toLocaleDateString(),
              status: approvalStatus,
              isApproved: approvalStatus === 'approved',
              videoUrl: doc.videoUrl,
            };
          });
          mappedContent.push(...documentsMapped);
        }

        setReportedContent(mappedContent);
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  // Filter and sort content
  const filteredAndSortedContent = useMemo(() => {
    const filtered = reportedContent.filter(content => {
      const matchesSearch = 
        content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        content.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        content.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        content.reportReason.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = typeFilter === 'all' || content.type === typeFilter
      const matchesApproval = approvalFilter === 'all' || content.status === approvalFilter
      const matchesProcess = processFilter === 'all' || getProcessFilterValue(content) === processFilter

      const reportedAt = new Date(content.reportedAt)
      const fromDate = dateFromFilter ? new Date(dateFromFilter) : null
      const toDate = dateToFilter ? new Date(dateToFilter) : null
      const matchesDateFrom = !fromDate || Number.isNaN(fromDate.getTime()) || reportedAt >= fromDate
      const matchesDateTo = !toDate || Number.isNaN(toDate.getTime()) || reportedAt <= toDate
      
      return matchesSearch && matchesType && matchesApproval && matchesProcess && matchesDateFrom && matchesDateTo
    })

    return filtered.sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]

      if (aVal === null || aVal === undefined || bVal === null || bVal === undefined) {
        if (aVal == null && bVal == null) return 0
        return aVal == null ? 1 : -1
      }

      const aComparable = typeof aVal === 'boolean' ? Number(aVal) : aVal
      const bComparable = typeof bVal === 'boolean' ? Number(bVal) : bVal

      if (aComparable < bComparable) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aComparable > bComparable) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [reportedContent, searchQuery, typeFilter, approvalFilter, processFilter, dateFromFilter, dateToFilter, sortConfig])

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedContent.length / pageSize))

  const paginatedContent = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages)
    const startIndex = (safePage - 1) * pageSize
    return filteredAndSortedContent.slice(startIndex, startIndex + pageSize)
  }, [filteredAndSortedContent, currentPage, pageSize, totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, typeFilter, approvalFilter, processFilter, dateFromFilter, dateToFilter, pageSize])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const handleSort = (key: keyof ReportedContent) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const autoApproveContent = async (content: ReportedContent) => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const approveUrl = content.type === 'recording'
      ? `${API_URL}/admin/livestreams/${content.id}/approve`
      : `${API_URL}/admin/documents/${content.id}/approve`;

    const response = await fetch(approveUrl, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      console.warn('Auto-approve failed', { contentId: content.id, type: content.type, status: response.status });
      return;
    }

    setReportedContent(prev =>
      prev.map(item =>
        item.id === content.id ? { ...item, status: 'approved', isApproved: true } : item,
      )
    );

    setSelectedContent(prev => (prev && prev.id === content.id ? { ...prev, status: 'approved', isApproved: true } : prev));
  }

  const persistApproval = async (content: ReportedContent, action: 'approve' | 'reject') => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const endpoint = content.type === 'recording'
      ? `${API_URL}/admin/livestreams/${content.id}/${action}`
      : `${API_URL}/admin/documents/${content.id}/${action}`;

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: action === 'reject' ? JSON.stringify({ reason: rejectReason }) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Failed to ${action} content`);
    }
  }

  const parseModerationPayload = (data: unknown) => {
    const source = data as Record<string, unknown>;
    const rawModeration = (source.moderationResult || source.moderation || source) as Record<string, unknown>;
    const score = typeof rawModeration.score === 'number' ? rawModeration.score : 0;
    const status = typeof rawModeration.status === 'string' ? rawModeration.status : 'N/A';
    const toxicWords = Array.isArray(rawModeration.toxicWords)
      ? rawModeration.toxicWords.filter((word): word is string => typeof word === 'string')
      : Array.isArray(rawModeration.toxic_word)
        ? rawModeration.toxic_word.filter((word): word is string => typeof word === 'string')
        : [];
    const categories = Array.isArray(rawModeration.moderationCategories)
      ? rawModeration.moderationCategories.filter((category): category is string => typeof category === 'string')
      : Array.isArray(rawModeration.categories)
        ? rawModeration.categories.filter((category): category is string => typeof category === 'string')
        : [];

    return {
      raw: rawModeration,
      status,
      score,
      toxicWords,
      categories,
    };
  }

  const markSelectedContentApproved = () => {
    if (!selectedContent) return;

    setReportedContent((prev) =>
      prev.map((item) =>
        item.id === selectedContent.id
          ? { ...item, status: 'approved', isApproved: true }
          : item,
      ),
    );

    setSelectedContent((prev) => (
      prev && prev.id === selectedContent.id
        ? { ...prev, status: 'approved', isApproved: true }
        : prev
    ));
  }

  const fetchLiveModerationForSelected = async () => {
    if (!selectedContent) return;
    setModerationLoading(true);
    setModeration(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const url = selectedContent.type === 'recording'
        ? `${API_URL}/livestream/${selectedContent.id}/moderation`
        : `${API_URL}/documents/${selectedContent.id}/moderation`;

      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) {
        console.warn('Moderation rerun failed', { url, status: res.status });
        return;
      }

      const data = await res.json();
      console.log('Moderation rerun response', { url, data });

      const parsedModeration = parseModerationPayload(data);
      setModeration(parsedModeration);

      if (parsedModeration.status === 'SAFE') {
        markSelectedContentApproved();
      }
    } catch (err) {
      console.error('Failed to rerun moderation', err);
      setModeration(null);
    } finally {
      setModerationLoading(false);
    }
  }

  const fetchCachedModerationForSelected = async () => {
    if (!selectedContent) return;
    setModerationLoading(true);
    setModeration(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      let url = '';
      if (selectedContent.type === 'recording') {
        url = `${API_URL}/livestream/${selectedContent.id}/ai-analysis`;
      } else {
        url = `${API_URL}/documents/${selectedContent.id}/ai-analysis?autoTranscribe=false`;
      }

      const readModeration = async () => {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
          console.warn('Moderation fetch failed', { url, status: res.status });
          return null;
        }

        const data = await res.json();
        console.log('Moderation raw response', { url, data });

        return parseModerationPayload(data);
      }

      const moderationResult = await readModeration()
      console.log('Moderation parsed result', {
        contentId: selectedContent.id,
        type: selectedContent.type,
        moderationResult,
      })
      setModeration(moderationResult ? {
        raw: moderationResult.raw,
        status: moderationResult.status,
        score: moderationResult.score,
        toxicWords: moderationResult.toxicWords,
        categories: moderationResult.categories,
      } : null)
    } catch (err) {
      console.error('Failed to fetch moderation', err);
      setModeration(null);
    } finally {
      setModerationLoading(false);
    }
  }

  useEffect(() => {
    if (!showModal) {
      setModeration(null);
    }
  }, [showModal]);

  useEffect(() => {
    if (showModal && selectedContent) {
      void fetchCachedModerationForSelected();
    }
  }, [showModal, selectedContent?.id, selectedContent?.type]);

  const handleApprove = async (content: ReportedContent) => {
    try {
      await persistApproval(content, 'approve');
      setReportedContent(prev => 
        prev.map(item => 
          item.id === content.id ? { ...item, status: 'approved', isApproved: true, processingStatus: 'DONE' } : item
        )
      )
      setSelectedContent(prev => (prev && prev.id === content.id ? { ...prev, status: 'approved', isApproved: true, processingStatus: 'DONE' } : prev));
      setShowModal(false)
    } catch (error) {
      console.error('Failed to approve content', error)
    }
  }

  const handleReject = async (content: ReportedContent) => {
    if (!rejectReason) return

    try {
      await persistApproval(content, 'reject');
      setReportedContent(prev => 
        prev.map(item => 
          item.id === content.id ? { ...item, status: 'rejected', processingStatus: 'DONE' } : item
        )
      )
      setSelectedContent(prev => (prev && prev.id === content.id ? { ...prev, status: 'rejected', processingStatus: 'DONE' } : prev));
      setRejectReason("")
      setShowModal(false)
    } catch (error) {
      console.error('Failed to reject content', error)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading content...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <div>

            <h1 className="text-2xl font-bold mb-2">Content Moderation</h1>
            <p className="text-gray-600">Review and moderate content from the platform</p>
          </div>
          <div className="relative w-96">
            <input
              type="text"
              placeholder="Search by title, author, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 pr-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter('all')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                typeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({reportedContent.length})
            </button>
            <button
              onClick={() => setTypeFilter('recording')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                typeFilter === 'recording'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Recording ({reportedContent.filter(c => c.type === 'recording').length})
            </button>
            <button
              onClick={() => setTypeFilter('document')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                typeFilter === 'document'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                  : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
              }`}
            >
              Document ({reportedContent.filter(c => c.type === 'document').length})
            </button>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <div className="min-w-56 self-end">
            <label className="mb-1 block h-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Process filter
            </label>
            <select
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value as typeof processFilter)}
              className="h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All process states</option>
              <option value="processing">Processing ({reportedContent.filter(c => getProcessFilterValue(c) === 'processing').length})</option>
              <option value="done">Done ({reportedContent.filter(c => getProcessFilterValue(c) === 'done').length})</option>
              <option value="failed">Failed ({reportedContent.filter(c => getProcessFilterValue(c) === 'failed').length})</option>
              <option value="pending">Pending ({reportedContent.filter(c => getProcessFilterValue(c) === 'pending').length})</option>
            </select>
          </div>

          <div className="min-w-56 self-end">
            <label className="mb-1 block h-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Approval filter
            </label>
            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value as typeof approvalFilter)}
              className="h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All approvals</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <input
            type="date"
            value={dateFromFilter}
            onChange={(e) => setDateFromFilter(e.target.value)}
            className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />

          <input
            type="date"
            value={dateToFilter}
            onChange={(e) => setDateToFilter(e.target.value)}
            className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />

          <button
            onClick={() => {
              setApprovalFilter('all')
              setProcessFilter('all')
              setDateFromFilter('')
              setDateToFilter('')
            }}
            title="Clear filters"
            aria-label="Clear filters"
            className="inline-flex h-10 items-center justify-center rounded-full bg-linear-to-r from-slate-900 to-slate-700 px-3 text-white shadow-md shadow-slate-900/20 transition hover:scale-[1.02] hover:from-slate-800 hover:to-slate-600"
          >
            <XCircle size={18} />
          </button>
        </div>

      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="sticky top-0 z-10 border-b border-white/20 bg-white/50 px-4 py-2.5 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-slate-700 ring-1 ring-white/60 shadow-sm"
                title="Rows per page"
              >
                <LayoutList size={16} />
              </div>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
                title="Rows per page"
                className="h-8 rounded-full border border-white/60 bg-white/70 px-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold tracking-wide text-slate-600 ring-1 ring-white/60 shadow-sm">
                {filteredAndSortedContent.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                <span className="px-1 text-slate-400">-</span>
                {Math.min(currentPage * pageSize, filteredAndSortedContent.length)}
                <span className="px-1 text-slate-400">/</span>
                {filteredAndSortedContent.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                aria-label="First page"
                title="First page"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                  currentPage === 1
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                    : 'bg-slate-900 text-white hover:bg-slate-700'
                }`}
              >
                <ChevronsLeft size={16} />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                title="Previous page"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                  currentPage === 1
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                    : 'bg-slate-900 text-white hover:bg-slate-700'
                }`}
              >
                <ChevronLeft size={16} />
              </button>

              <div className="inline-flex h-8 items-center rounded-full bg-white/60 px-3 text-xs font-semibold text-slate-700 ring-1 ring-white/60 shadow-sm">
                {currentPage} / {totalPages}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                title="Next page"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                  currentPage === totalPages
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                    : 'bg-slate-900 text-white hover:bg-slate-700'
                }`}
              >
                <ChevronRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Last page"
                title="Last page"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                  currentPage === totalPages
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                    : 'bg-slate-900 text-white hover:bg-slate-700'
                }`}
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-2">
                    Title
                    {sortConfig.key === 'title' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-2">
                    Type
                    {sortConfig.key === 'type' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('author')}
                >
                  <div className="flex items-center gap-2">
                    Author
                    {sortConfig.key === 'author' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('dateReported')}
                >
                  <div className="flex items-center gap-2">
                    Date
                    {sortConfig.key === 'dateReported' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('isApproved')}
                >
                  <div className="flex items-center gap-2">
                    Approval
                    {sortConfig.key === 'isApproved' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Process Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedContent.map((content) => (
                <tr
                  key={content.id}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{content.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      content.type === 'recording' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {content.type === 'recording' ? '🎥 Recording' : '📄 Document'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{content.author}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{content.dateReported}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      content.status === 'approved' ? 'bg-green-100 text-green-800' : ''}
                      ${content.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                      ${content.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                    `}>
                      {content.status === 'approved' ? 'Approved' : content.status === 'rejected' ? 'Rejected' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="space-y-1">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getProcessingStatusClasses(content.processingStatus)}`}>
                        {normalizeProcessingStatus(content.processingStatus)}
                      </span>
                      {getProcessingStageLabel(content.processingStage) && (
                        <div className="text-[11px] font-medium text-gray-500">
                          {getProcessingStageLabel(content.processingStage)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => {
                        setSelectedContent(content)
                        setModeration(null)
                        setShowModal(true)
                      }}
                      className="text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for content review */}
      {showModal && selectedContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
            <div className="flex shrink-0 items-start justify-between gap-4 bg-[#292C6D] px-6 py-5 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Content Moderation</p>
                <h2 className="mt-1 text-2xl font-bold">Review Content</h2>
                <p className="mt-1 text-sm text-white/75">{selectedContent.title} · {selectedContent.type === 'recording' ? 'Recording' : 'Document'}</p>
              </div>
              <button
                onClick={() => { setShowModal(false); setSelectedContent(null); setRejectReason(""); }}
                title="Close modal"
                aria-label="Close modal"
                className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                  <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#292C6D]/50">Content Details</p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{selectedContent.title}</h3>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedContent.type === 'recording' ? 'bg-[#292C6D]/10 text-[#292C6D]' : 'bg-[#EC255A]/10 text-[#EC255A]'}`}>
                        {selectedContent.type === 'recording' ? 'Recording' : 'Document'}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Author</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{selectedContent.author}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Report Date</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{selectedContent.dateReported}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Approval</p>
                        <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getApprovalStatusClasses(selectedContent.status)}`}>
                          {selectedContent.status === 'approved' ? 'Approved' : selectedContent.status === 'rejected' ? 'Rejected' : 'Pending'}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Process Status</p>
                        <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getProcessingStatusClasses(selectedContent.processingStatus)}`}>
                          {normalizeProcessingStatus(selectedContent.processingStatus)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Process Detail</p>
                      <ProcessingTracker
                        entityId={selectedContent.id}
                        entityType={selectedContent.type === 'recording' ? 'LIVESTREAM' : 'DOCUMENT'}
                        showRetry={false}
                        showInlineProgress
                      />
                    </div>

                    {(selectedContent.processingError || normalizeProcessingStatus(selectedContent.processingStatus) === 'FAILED') && (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-800">Processing failed</p>
                        <p className="mt-1 text-sm text-red-700">
                          {selectedContent.processingError || 'The processing pipeline stopped with an error.'}
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setRetryingContentId(selectedContent.id);
                              const { retryProcessing } = await import('@/lib/api/processing');
                              const result = await retryProcessing(
                                selectedContent.type === 'recording' ? 'LIVESTREAM' : 'DOCUMENT',
                                selectedContent.id,
                              );
                              setReportedContent(prev => prev.map(item =>
                                item.id === selectedContent.id
                                  ? { ...item, processingStatus: result.processingStatus, processingError: null }
                                  : item
                              ));
                              setSelectedContent(prev => prev && prev.id === selectedContent.id
                                ? { ...prev, processingStatus: result.processingStatus, processingError: null }
                                : prev
                              );
                            } catch (error) {
                              console.error('Failed to retry processing:', error);
                            } finally {
                              setRetryingContentId(null);
                            }
                          }}
                          disabled={retryingContentId === selectedContent.id}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {retryingContentId === selectedContent.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                          Retry processing
                        </button>
                      </div>
                    )}
                  </section>

                  <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#292C6D]/50">Content Preview</p>
                    <div className="rounded-2xl bg-slate-100 p-4">
                      {selectedContent.videoUrl ? (
                        <div className="space-y-4">
                          <video controls className="w-full rounded-2xl bg-black shadow-lg" src={selectedContent.videoUrl}>
                            Your browser does not support the video tag.
                          </video>
                          <div className="break-all rounded-2xl bg-white p-4">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {selectedContent.type === 'recording' ? 'Recording URL' : 'Video URL'}
                            </p>
                            <a href={selectedContent.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#292C6D] underline decoration-[#EC255A]/40 underline-offset-4 break-all">
                              {selectedContent.videoUrl}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-slate-500">
                          No video URL available
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Rejection Reason <span className="ml-1 text-[#EC255A]">*</span>
                    </label>
                    <textarea
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#292C6D] focus:bg-white focus:ring-4 focus:ring-[#292C6D]/10"
                      rows={3}
                      placeholder={selectedContent.status === 'rejected' ? 'Edit the existing rejection reason here' : 'Enter detailed reason for rejection (required for rejecting content)'}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </section>

                  <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#292C6D]/50">Moderation Result</p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">AI Review</h3>
                      </div>
                      <button
                        onClick={() => void fetchLiveModerationForSelected()}
                        disabled={moderationLoading}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${moderationLoading ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-[#292C6D] text-white hover:bg-[#1f2350]'}`}
                      >
                        {moderationLoading ? 'Running...' : 'Re-run Moderation'}
                      </button>
                    </div>

                    <div className="mb-4 rounded-2xl border border-dashed border-[#292C6D]/15 bg-[#F8FAFF] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Content ID</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                        {selectedContent.type === 'recording' ? 'recordingId' : 'documentId'}: {selectedContent.id}
                      </p>
                    </div>

                    {moderationLoading ? (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Loading moderation...</div>
                    ) : moderation ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-[#F8FAFF] p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
                            <p className="mt-1 text-base font-bold text-slate-900">{moderation.status || 'N/A'}</p>
                          </div>
                          <div className="rounded-2xl bg-[#F8FAFF] p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Score</p>
                            <p className="mt-1 text-base font-bold text-slate-900">{(moderation.score ?? 0).toFixed(4)}</p>
                          </div>
                          <div className="rounded-2xl bg-[#F8FAFF] p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Toxic words</p>
                            <p className="mt-1 text-base font-bold text-slate-900">{moderation.toxicWords.length > 0 ? moderation.toxicWords.length : 'N/A'}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-dashed border-[#292C6D]/20 bg-[#F8FAFF] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#292C6D]/60">Toxic Words</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {moderation.toxicWords.length > 0 ? (
                              moderation.toxicWords.map((word) => (
                                <span key={word} className="rounded-full bg-[#EC255A]/10 px-3 py-1 text-xs font-semibold text-[#EC255A]">{word}</span>
                              ))
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">N/A</span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#292C6D]/10 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Categories</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {moderation.categories && moderation.categories.length > 0 ? (
                              moderation.categories.map((category) => (
                                <span key={category} className="rounded-full bg-[#292C6D]/10 px-3 py-1 text-xs font-semibold text-[#292C6D]">{category}</span>
                              ))
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">N/A</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No moderation data available</div>
                    )}
                  </section>

                  <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        onClick={() => void handleApprove(selectedContent)}
                        className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                      >
                        <Check size={18} className="mr-2" /> Approve Content
                      </button>
                      <button
                        onClick={() => void handleReject(selectedContent)}
                        disabled={!rejectReason}
                        className={`inline-flex items-center rounded-full px-4 py-2.5 text-sm font-semibold transition focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${rejectReason ? 'bg-[#EC255A] text-white hover:bg-[#d31f4c]' : 'cursor-not-allowed bg-slate-100 text-slate-400'}`}
                      >
                        <X size={18} className="mr-2" /> Reject Content
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
