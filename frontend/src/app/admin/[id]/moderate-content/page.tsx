"use client"
import React, { useState, useMemo, useEffect } from 'react'
import { Check, X, Trash2, Search, ChevronUp, ChevronDown, Filter } from 'lucide-react'

interface ReportedContent {
  id: string
  title: string
  author: string
  type: 'recording' | 'document'
  reportReason: string
  reportedBy: string
  dateReported: string
  status: 'pending' | 'approved' | 'rejected' | 'removed'
  isApproved: boolean
  videoUrl?: string
}

export default function ContentModerationPage() {
  const [reportedContent, setReportedContent] = useState<ReportedContent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContent, setSelectedContent] = useState<ReportedContent | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [moderation, setModeration] = useState<{
    score: number
    toxicWords: string[]
    label?: string | null
    categories?: string[]
    text?: string
  } | null>(null)
  const [moderationLoading, setModerationLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<'all' | 'recording' | 'document'>('all')
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ReportedContent
    direction: 'asc' | 'desc'
  }>({ key: 'dateReported', direction: 'desc' })

  const parseTranscriptText = (transcript: unknown): string | undefined => {
    if (typeof transcript === 'string') {
      return transcript
    }

    if (!transcript || typeof transcript !== 'object') {
      return undefined
    }

    const data = transcript as Record<string, unknown>
    const candidate = data.text ?? data.transcript ?? data.result

    if (typeof candidate === 'string') {
      return candidate
    }

    try {
      return JSON.stringify(transcript)
    } catch {
      return undefined
    }
  }

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
            const approvalStatus = ls.approvalStatus
              ?? (ls.isApprove === 'TRUE' ? 'approved' : ls.isApprove === 'REJECTED' ? 'removed' : 'pending');

            return {
              id: ls.id,
              title: ls.title,
              author: ls.uploadedBy || 'Unknown',
              type: 'recording' as const,
              reportReason: 'Pending review',
              reportedBy: 'System',
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
            const approvalStatus = doc.status === 'approved' || doc.status === 'removed' || doc.status === 'rejected'
              ? doc.status
              : 'pending';

            return {
              id: doc.id,
              title: doc.title,
              author: doc.uploadedBy || 'Unknown',
              type: 'document' as const,
              reportReason: 'Pending review',
              reportedBy: 'System',
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
      
      return matchesSearch && matchesType
    })

    return filtered.sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      
      if (aVal === undefined || bVal === undefined) return 0
      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [reportedContent, searchQuery, typeFilter, sortConfig])

  const handleSort = (key: keyof ReportedContent) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const fetchModerationForSelected = async () => {
    if (!selectedContent) return;
    setModerationLoading(true);
    setModeration(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      let url = '';
      if (selectedContent.type === 'recording') {
        url = `${API_URL}/livestream/${selectedContent.id}/moderation`;
      } else {
        url = `${API_URL}/documents/${selectedContent.id}/moderation`;
      }

      const readModeration = async () => {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
          console.warn('Moderation fetch failed', { url, status: res.status });
          return null;
        }

        const data = await res.json();
        console.log('Moderation raw response', { url, data });

        return {
          score: data.validationRate ?? data.score ?? 0,
          toxicWords: data.toxicWords || data.toxic_word || [],
          label: data.moderationLabel || data.label || null,
          categories: data.moderationCategories || data.categories || [],
          text: parseTranscriptText(data.text ?? data.transcript),
        }
      }

      const moderationResult = await readModeration()
      console.log('Moderation parsed result', {
        contentId: selectedContent.id,
        type: selectedContent.type,
        moderationResult,
      })
      setModeration(moderationResult ? {
        score: moderationResult.score,
        toxicWords: moderationResult.toxicWords,
        label: moderationResult.label,
        categories: moderationResult.categories,
        text: moderationResult.text,
      } : null)
    } catch (err) {
      console.error('Failed to fetch moderation', err);
      setModeration(null);
    } finally {
      setModerationLoading(false);
    }
  }

  useEffect(() => {
    if (showModal && selectedContent) {
      fetchModerationForSelected();
    } else {
      setModeration(null);
    }
  }, [showModal, selectedContent]);

  const handleApprove = (content: ReportedContent) => {
    setReportedContent(prev => 
      prev.map(item => 
        item.id === content.id ? { ...item, status: 'approved' } : item
      )
    )
    setShowModal(false)
  }

  const handleReject = (content: ReportedContent) => {
    if (!rejectReason) return
    setReportedContent(prev => 
      prev.map(item => 
        item.id === content.id ? { ...item, status: 'rejected' } : item
      )
    )
    setRejectReason("")
    setShowModal(false)
  }

  const handleRemove = (content: ReportedContent) => {
    setReportedContent(prev => 
      prev.map(item => 
        item.id === content.id ? { ...item, status: 'removed' } : item
      )
    )
    setShowModal(false)
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

        {/* Type Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              typeFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({reportedContent.length})
          </button>
          <button
            onClick={() => setTypeFilter('recording')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              typeFilter === 'recording'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Recording ({reportedContent.filter(c => c.type === 'recording').length})
          </button>
          <button
            onClick={() => setTypeFilter('document')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              typeFilter === 'document'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Document ({reportedContent.filter(c => c.type === 'document').length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedContent.map((content) => (
                <tr key={content.id}>
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
                      ${content.status === 'removed' ? 'bg-gray-100 text-gray-800' : ''}
                      ${content.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                    `}>
                      {content.status === 'approved' ? 'Approved' : content.status === 'rejected' ? 'Rejected' : content.status === 'removed' ? 'Removed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => {
                        setSelectedContent(content)
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] shadow-2xl relative flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 px-6 pt-6 shrink-0 rounded-t-xl" style={{background: 'linear-gradient(90deg,#4f46e5,#7c3aed)'}}>
              <div>
                <h2 className="text-2xl font-bold text-white">Review Content</h2>
                <p className="text-sm text-indigo-200 mt-1">ID: {selectedContent.id}</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  setSelectedContent(null)
                  setRejectReason("")
                }}
                className="text-indigo-100 hover:text-white transition-colors p-2 hover:bg-indigo-600/20 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-6 space-y-6">
              {/* Content Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Content Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Title</p>
                    <p className="text-sm font-medium">{selectedContent.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Author</p>
                    <p className="text-sm font-medium">{selectedContent.author}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Type</p>
                    <p className="text-sm font-medium">
                      {selectedContent.type === 'recording' ? '🎥 Recording' : '📄 Document'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Report Date</p>
                    <p className="text-sm font-medium">{selectedContent.dateReported}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Approved</p>
                    <p className="text-sm font-medium">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        selectedContent.isApproved
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedContent.isApproved ? '✓ Yes' : '⏳ Not Yet'}
                      </span>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Report Reason</p>
                    <p className="text-sm font-medium">{selectedContent.reportReason}</p>
                  </div>
                </div>
              </div>

              {/* Content Preview */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Content Preview</h3>
                <div className="bg-gray-50 rounded-lg p-4 min-h-56">
                  {selectedContent.type === 'recording' ? (
                    selectedContent.videoUrl ? (
                      <div className="space-y-4">
                        <video
                          controls
                          className="w-full h-auto rounded-lg bg-black"
                          src={selectedContent.videoUrl}
                        >
                          Your browser does not support the video tag.
                        </video>
                        <div className="break-all">
                          <p className="text-xs text-gray-500 mb-1">Recording URL:</p>
                          <a
                            href={selectedContent.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-900 text-sm underline break-all"
                          >
                            {selectedContent.videoUrl}
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <p>No recording URL available</p>
                      </div>
                    )
                  ) : selectedContent.videoUrl ? (
                    <div className="space-y-4">
                      <video
                        controls
                        className="w-full h-auto rounded-lg bg-black"
                        src={selectedContent.videoUrl}
                      >
                        Your browser does not support the video tag.
                      </video>
                      <div className="break-all">
                        <p className="text-xs text-gray-500 mb-1">Video URL:</p>
                        <a
                          href={selectedContent.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900 text-sm underline break-all"
                        >
                          {selectedContent.videoUrl}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No video URL available
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection Reason */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Rejection Reason
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter detailed reason for rejection (required for rejecting content)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              {/* Moderation Result */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Moderation</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {moderationLoading ? (
                    <p className="text-sm text-gray-500">Loading moderation...</p>
                  ) : moderation ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Label</p>
                          <p className="text-sm font-medium">{moderation.label || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Score</p>
                          <p className="text-sm font-medium">{(moderation.score ?? 0).toFixed(2)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Toxic Words</p>
                        {moderation.toxicWords && moderation.toxicWords.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {moderation.toxicWords.map((w) => (
                              <span key={w} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">{w}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No toxic words detected</p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Categories</p>
                        {moderation.categories && moderation.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {moderation.categories.map((c) => (
                              <span key={c} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">{c}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No categories</p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Original Text / Explanation</p>
                        <pre className="text-xs text-gray-700 bg-white border rounded p-2 max-h-40 overflow-auto">{moderation.text || 'N/A'}</pre>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No moderation data available</p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={async () => {
                        console.log('Re-run Moderation clicked', {
                          contentId: selectedContent.id,
                          contentType: selectedContent.type,
                        })
                        await fetchModerationForSelected();
                      }}
                      disabled={moderationLoading}
                      className={`px-3 py-1 rounded text-sm text-white ${
                        moderationLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {moderationLoading ? 'Running...' : 'Re-run Moderation'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer - Fixed */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl shrink-0 flex gap-3 justify-end">
              <button
                onClick={() => handleApprove(selectedContent)}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Check size={18} className="mr-2" /> Approve Content
              </button>
              <button
                onClick={() => handleReject(selectedContent)}
                disabled={!rejectReason}
                className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-red-500
                  ${rejectReason ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                <X size={18} className="mr-2" /> Reject Content
              </button>
              <button
                onClick={() => handleRemove(selectedContent)}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <Trash2 size={18} className="mr-2" /> Remove Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
