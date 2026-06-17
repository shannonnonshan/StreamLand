'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { PlayCircleIcon } from '@heroicons/react/24/outline';
import { getStudentRoute } from '@/utils/student';

const PrimaryColor = '161853';
const API_URL = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/ai`;
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const MAX_HISTORY_ITEMS = 10;

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  teacherName?: string;
  teacherId?: string;
  totalViews?: number;
  status?: string;
  type?: string;
  thumbnailUrl?: string;
  category?: string;
  endedAt?: string;
  videoUrl?: string;
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
        teacherId: metadata?.teacher_id ?? metadata?.teacherId ?? undefined,
        totalViews: typeof metadata?.totalViews === 'number' ? metadata.totalViews : undefined,
        status: metadata?.status ?? undefined,
        type: metadata?.type ?? undefined,
        thumbnailUrl: metadata?.thumbnailUrl ?? metadata?.thumbnail ?? undefined,
        category: metadata?.category ?? undefined,
        endedAt: metadata?.endedAt ?? metadata?.ended_at ?? undefined,
        // FIX 1: map videoUrl cho document
        videoUrl: metadata?.videoUrl ?? metadata?.fileUrl ?? undefined,
      } as SearchResult;
    })
    .filter((result: SearchResult | null): result is SearchResult => !!result);
};

function SearchVideoCard({ item, index }: { item: SearchResult; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const router = useRouter();

  const isDocument = item.type === 'document';
  const categoryLabel = isDocument
    ? 'DOC VIDEO'
    : item.category || (item.type ? item.type.toUpperCase() : 'Video');
  const formattedDate = item.endedAt ? new Date(item.endedAt).toLocaleDateString('en-US') : '';

  // FIX 2: navigate đúng theo type
  const handleClick = () => {
    if (item.status === 'LIVE') {
      router.push(getStudentRoute(`livestream/${item.id}`));
      return;
    }

    if (isDocument) {
      const params = new URLSearchParams({ type: 'document' });
      if (item.videoUrl) params.set('src', item.videoUrl);
      if (item.title) params.set('title', item.title);
      if (item.teacherName) params.set('teacherName', item.teacherName);
      if (item.teacherId) params.set('teacherId', item.teacherId);
      router.push(getStudentRoute(`video/${item.id}?${params.toString()}`));
      return;
    }

    router.push(getStudentRoute(`video/${item.id}`));
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
          {/* FIX 3: document dùng video tag lấy frame đầu giống public profile teacher */}
          {isDocument && item.videoUrl ? (
            <div className="relative w-full md:w-56 h-36 rounded-xl overflow-hidden bg-gradient-to-br from-[#161853]/10 to-[#292C6D]/10 shrink-0">
              <video
                src={item.videoUrl}
                className="h-full w-full object-cover pointer-events-none"
                muted
                playsInline
                preload="metadata"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
              <div className="absolute top-2 left-2 bg-[#161853] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                DOC
              </div>
            </div>
          ) : (
          <div className="relative w-full md:w-56 h-36 rounded-xl overflow-hidden bg-gray-100 shrink-0">
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
          {item.status === 'LIVE' && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}
          </div>
          )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base md:text-lg font-semibold text-[#161853] line-clamp-2">
              {item.title}
            </h3>
            <span className={`px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border ${
              isDocument
                ? 'bg-[#EC255A]/10 text-[#EC255A] border-[#EC255A]/20'
                : 'bg-[#161853]/10 text-[#161853] border-[#161853]/20'
            }`}>
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
      // ignore
    }
  };

  useEffect(() => {
    if (query) saveSearchHistory(query);
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
        // Giữ nguyên endpoint /ai/search POST như cũ
        const p = new URLSearchParams({ query, top_k: '20' });
        const response = await fetch(`${API_URL}/search?${p.toString()}`, {
          method: 'POST',
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Search request failed');

        const payload = await response.json();
        const normalized = normalizeSearchResults(payload);

        // FIX: bao gồm cả document, không chỉ video
        const filtered = normalized.filter((item) =>
          item.type === 'video' ||
          item.type === 'document' ||
          item.type === 'livestream' ||
          !item.type,
        );

        // Chỉ hydrate livestream thiếu data, document dùng videoUrl trực tiếp
        const missingLivestream = filtered.filter(
          (item) => item.type !== 'document' && (!item.thumbnailUrl || !item.teacherName || !item.description),
        );

        if (missingLivestream.length === 0) {
          setResults(filtered);
          return;
        }

        const detailResponses = await Promise.all(
          missingLivestream.map((item) =>
            fetch(`${BACKEND_API_URL}/livestream/${item.id}`, { signal: controller.signal })
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null),
          ),
        );

        const detailMap = new Map(
          detailResponses
            .filter((d) => d && d.id)
            .map((d) => [String(d.id), d]),
        );

        const hydrated = filtered.map((item) => {
          if (item.type === 'document') return item;
          const detail = detailMap.get(item.id);
          if (!detail) return item;
          return {
            ...item,
            title: item.title || detail.title,
            description: item.description || detail.description,
            thumbnailUrl: item.thumbnailUrl || detail.thumbnail || detail.thumbnailUrl,
            teacherName: item.teacherName || detail?.teacher?.fullName,
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
    return `${results.length} result${results.length !== 1 ? 's' : ''} found`;
  }, [query, isLoading, errorMessage, results.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500">Search results for</p>
        <h1 className={`text-2xl font-bold text-[#${PrimaryColor}]`}>{query || 'Search'}</h1>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        {viewerId === 'guest' && (
          <p className="text-xs text-gray-400 mt-2">You are browsing as a guest.</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#161853]" />
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