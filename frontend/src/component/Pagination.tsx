import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  showInfo?: boolean;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  showInfo = true,
  className = '',
}: PaginationProps) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`grid grid-cols-3 items-center bg-white p-4 rounded-xl shadow-sm ${className}`}>
      <div className="text-sm text-gray-600">
        {showInfo && (
          <>Showing {startIndex + 1} to {endIndex} of {totalItems} items</>
        )}
      </div>
      
      <div className="flex items-center gap-2 justify-center">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-1">
          {/* First page */}
          {currentPage > 2 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                1
              </button>
              {currentPage > 3 && <span className="text-gray-400">...</span>}
            </>
          )}
          
          {/* Current page and neighbors */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(page => 
              page === currentPage || 
              page === currentPage - 1 || 
              page === currentPage + 1
            )
            .map(page => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  page === currentPage
                    ? "bg-[#292C6D] text-white font-medium"
                    : "hover:bg-gray-100"
                }`}
              >
                {page}
              </button>
            ))}
          
          {/* Last page */}
          {currentPage < totalPages - 1 && (
            <>
              {currentPage < totalPages - 2 && <span className="text-gray-400">...</span>}
              <button
                onClick={() => onPageChange(totalPages)}
                className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>
        
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div /> {/* Empty column for grid layout */}
    </div>
  );
}
