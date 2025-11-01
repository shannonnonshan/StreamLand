"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/component/admin/dialog";
import { Input } from "@/component/admin/input";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface SearchModalProps {
  /** Controls the visibility of the modal */
  isOpen: boolean;
  /** Callback function when the modal is closed */
  onClose: () => void;
  /** Current pathname used to determine search context */
  pathname: string;
}

/**
 * SearchModal Component
 * 
 * A reusable search modal that adapts its behavior based on the current route.
 * Different routes will trigger different types of searches (accounts, reports, etc.)
 */
export default function SearchModal({ isOpen, onClose, pathname }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  /**
   * Get the appropriate placeholder text for the search input
   * based on the current route
   */
  const getSearchPlaceholder = () => {
    if (pathname.includes("/manage-account")) {
      return "Search accounts";
    } else if (pathname.includes("/manage-report")) {
      return "Search reports...";
    } else if (pathname.includes("/moderate-content")) {
      return "Search content...";
    } else if (pathname.includes("/chat")) {
      return "Search messages...";
    } else if (pathname.includes("/manage-notification")) {
      return "Search notifications...";
    }
    return "Search";
  };

  /**
   * Determine the type of search to perform based on the current route
   * This affects which backend endpoint will handle the search
   */
  const getSearchType = () => {
    if (pathname.includes("/manage-account")) {
      return "accounts";
    } else if (pathname.includes("/manage-report")) {
      return "reports";
    } else if (pathname.includes("/moderate-content")) {
      return "contents";
    } else if (pathname.includes("/chat")) {
      return "messages";
    } else if (pathname.includes("/manage-notification")) {
      return "notifications";
    }
    return "all";
  };

  /**
   * Handle the search form submission
   * 1. Make API request to backend search endpoint
   * 2. Navigate to search results page
   * 3. Handle loading and error states
   */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const searchType = getSearchType();
      const queryParams = new URLSearchParams({
        type: searchType,
        query: searchQuery.trim()
      });

      const response = await fetch(`/api/admin/search?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Search request failed');
      }

      // Store search results in state management if needed
      await response.json();
      
      // Navigate to search results page
      router.push(`/admin/search?${queryParams.toString()}`);
      onClose();
    } catch (error) {
      console.error('Search error:', error);
      // Implement error handling UI
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getSearchPlaceholder()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSearch} className="space-y-4">
          <Input
            type="text"
            placeholder={getSearchPlaceholder()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`w-full px-4 py-2 text-white rounded-md ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#292C6D] hover:bg-[#1a1d4d]'
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}