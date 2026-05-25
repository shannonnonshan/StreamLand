'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { PlayCircleIcon } from '@heroicons/react/24/outline';

const PrimaryColor = '161853';
const API_URL = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/ai`;
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const MAX_HISTORY_ITEMS = 10;

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  teacherName?: string;
  totalViews?: number;
  status?: string;
  type?: string;
  thumbnailUrl?: string;
  category?: string;
  endedAt?: string;
}

const normalizeSearchResults = (payload: any): SearchResult[] => {
  const rawResults = Array.isArray(payload)
    ? payload
    : payload?.results || payload?.data || payload?.items || [];

  if (!Array.isArray(rawResults)) return [];

  return rawResults
    .map((item: any) => {
      const metadata = item?.metadata ?? item ?? {};
      const title = metadata?.title ?? metadata?.name ?? metadata?.content ?? '';

      if (!metadata?.id || !title) return null;

      return {
        id: String(metadata.id),
        title: String(title),
        description: metadata?.description ?? '',
        teacherName: metadata?.teacher_name ?? metadata?.teacherName ?? '',
        totalViews: typeof metadata?.totalViews === 'number' ? metadata.totalViews : undefined,
        status: metadata?.status ?? undefined,
        type: metadata?.type ?? undefined,
        thumbnailUrl: metadata?.thumbnailUrl ?? metadata?.thumbnail ?? undefined,
        category: metadata?.category ?? undefined,
        endedAt: metadata?.endedAt ?? metadata?.ended_at ?? undefined,
      } as SearchResult;
    })
    .filter((result: SearchResult | null): result is SearchResult => !!result);
};

function SearchVideoCard({ item, index }: { item: SearchResult; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const router = useRouter();

  const categoryLabel = item.category || (item.type ? item.type.toUpperCase() : 'Video');
  const formattedDate = item.endedAt ? new Date(item.endedAt).toLocaleDateString('en-US') : '';

  const handleClick = () => {
    if (item.status === 'LIVE') {
      router.push(`/student/livestream/${item.id}`);
      return;
    }

    router.push(`/student/video/${item.id}`);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      className={`w-full rounded-2xl border bg-white p-3 md:p-4 cursor-pointer transition-all duration-200 ${
        isHovered
          ? 'border-[#161853]/40 shadow-md -translate-y-[1px]'
          : 'border-gray-200 shadow-sm'
      }`}
    >
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative w-full md:w-56 h-36 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          {item.thumbnailUrl && !imageError ? (
            <Image
              src={item.thumbnailUrl}
              alt={item.title}
              fill
              priority={index < 3}
              loading={index < 3 ? 'eager' : 'lazy'}
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 224px"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <PlayCircleIcon className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base md:text-lg font-semibold text-[#161853] line-clamp-2">
              {item.title}
            </h3>
            <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-[#161853]/10 text-[#161853] border border-[#161853]/20 whitespace-nowrap">
              {categoryLabel}
            </span>
          </div>

          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
            {item.description || 'Explore this lesson for more details.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
            <span className="font-medium text-[#161853]">{item.teacherName || 'Unknown teacher'}</span>
            <span>•</span>
            <span>
              {typeof item.totalViews === 'number'
                ? `${item.totalViews.toLocaleString()} views`
                : 'New upload'}
            </span>
            {formattedDate && (
              <>
                <span>•</span>
                <span>{formattedDate}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchResultsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const query = searchParams.get('query')?.trim() || '';
  const viewerId = params?.id || 'guest';

  const getHistoryStorageKey = () => `streamland:search-history:${viewerId || 'guest'}`;

  const saveSearchHistory = (term: string) => {
    if (typeof window === 'undefined') return;
    const trimmed = term.trim();
    if (!trimmed) return;

    try {
      const raw = localStorage.getItem(getHistoryStorageKey());
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      const existing = Array.isArray(parsed) ? parsed : [];
      const nextHistory = [trimmed, ...existing.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())]
        .slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(getHistoryStorageKey(), JSON.stringify(nextHistory));
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (query) {
      saveSearchHistory(query);
    }
  }, [query, viewerId]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setErrorMessage('');
      return;
    }

    const controller = new AbortController();
    const fetchResults = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const params = new URLSearchParams({ query, top_k: '20' });
        const response = await fetch(`${API_URL}/search?${params.toString()}`, {
          method: 'POST',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Search request failed');
        }

        const payload = await response.json();
        const normalized = normalizeSearchResults(payload);
        const videosOnly = normalized.filter((item) => item.type === 'video' || !item.type);

        const missingDetails = videosOnly.filter(
          (item) => !item.thumbnailUrl || !item.teacherName || !item.description,
        );

        if (missingDetails.length === 0) {
          setResults(videosOnly);
          return;
        }

        const detailResponses = await Promise.all(
          missingDetails.map((item) =>
            fetch(`${BACKEND_API_URL}/livestream/${item.id}`, {
              signal: controller.signal,
            })
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null),
          ),
        );

        const detailMap = new Map(
          detailResponses
            .filter((detail) => detail && detail.id)
            .map((detail) => [String(detail.id), detail]),
        );

        const hydrated = videosOnly.map((item) => {
          const detail = detailMap.get(item.id);
          if (!detail) return item;

          return {
            ...item,
            title: item.title || detail.title,
            description: item.description || detail.description,
            thumbnailUrl: item.thumbnailUrl || detail.thumbnailUrl || detail.thumbnail || detail.thumbnail_url,
            teacherName: item.teacherName || detail?.teacher?.fullName || detail?.teacher?.name,
            category: item.category || detail.category,
            endedAt: item.endedAt || detail.endedAt,
          } as SearchResult;
        });

        setResults(hydrated);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setErrorMessage('Failed to load search results.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
    return () => controller.abort();
  }, [query]);

  const subtitle = useMemo(() => {
    if (!query) return 'Type a query in the search bar to get started.';
    if (isLoading) return 'Searching for videos...';
    if (errorMessage) return errorMessage;
    if (results.length === 0) return 'No videos matched your search.';
    return `${results.length} video${results.length !== 1 ? 's' : ''} found`;
  }, [query, isLoading, errorMessage, results.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500">Search results for</p>
        <h1 className={`text-2xl font-bold text-[#${PrimaryColor}]`}>
          {query || 'Search'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        {viewerId === 'guest' && (
          <p className="text-xs text-gray-400 mt-2">You are browsing as a guest.</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#161853]"></div>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-xl">
          <p>{query ? 'No videos found for this search yet.' : 'Start searching to see results here.'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 md:gap-4">
          {results.map((item, index) => (
            <SearchVideoCard key={item.id} item={item} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
