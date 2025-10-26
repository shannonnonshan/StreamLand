"use client"
import React, { useState, useMemo } from 'react'
import { Check, X, Trash2, Search, ChevronUp, ChevronDown, Filter } from 'lucide-react'

interface ReportedContent {
  id: number
  title: string
  author: string
  type: string
  reportReason: string
  reportedBy: string
  dateReported: string
  status: 'pending' | 'approved' | 'rejected' | 'removed'
}

// Mock data - replace with actual API calls
const mockReportedContent: ReportedContent[] = [
  {
    id: 1,
    title: "Live Stream Session XYZ",
    author: "Teacher John",
    type: "livestream",
    reportReason: "Inappropriate content",
    reportedBy: "User123",
    dateReported: "2025-10-26",
    status: "pending",
  },
  {
    id: 2,
    title: "Recording ABC",
    author: "Teacher Jane",
    type: "recording",
    reportReason: "Copyright violation",
    reportedBy: "User456",
    dateReported: "2025-10-25",
    status: "pending",
  },
]

export default function ContentModerationPage() {
  const [reportedContent, setReportedContent] = useState<ReportedContent[]>(mockReportedContent)
  const [selectedContent, setSelectedContent] = useState<ReportedContent | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ReportedContent
    direction: 'asc' | 'desc'
  }>({ key: 'dateReported', direction: 'desc' })

  // Filter and sort content
  const filteredAndSortedContent = useMemo(() => {
    const filtered = reportedContent.filter(content => 
      content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.reportReason.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return filtered.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [reportedContent, searchQuery, sortConfig])

  const handleSort = (key: keyof ReportedContent) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

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

  return (
    <div className="p-6">
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">Content Moderation</h1>
            <p className="text-gray-600">Review and moderate flagged content from the platform</p>
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
                  onClick={() => handleSort('reportReason')}
                >
                  <div className="flex items-center gap-2">
                    Report Reason
                    {sortConfig.key === 'reportReason' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {sortConfig.key === 'status' && (
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{content.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{content.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{content.author}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{content.reportReason}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${content.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${content.status === 'approved' ? 'bg-green-100 text-green-800' : ''}
                      ${content.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                      ${content.status === 'removed' ? 'bg-gray-100 text-gray-800' : ''}
                    `}>
                      {content.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => {
                        setSelectedContent(content)
                        setShowModal(true)
                      }}
                      className="text-indigo-600 hover:text-indigo-900"
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
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Review Content</h2>
                <p className="text-sm text-gray-500 mt-1">ID: {selectedContent.id}</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  setSelectedContent(null)
                  setRejectReason("")
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
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
                    <p className="text-sm font-medium">{selectedContent.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Report Date</p>
                    <p className="text-sm font-medium">{selectedContent.dateReported}</p>
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
                <div className="bg-gray-50 rounded-lg p-4 min-h-[200px]">
                  {/* Replace with actual content preview */}
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Content preview will be displayed here
                  </div>
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

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 mt-6 border-t border-gray-200">
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
        </div>
      )}
    </div>
  )
}
