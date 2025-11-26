'use client';

import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const fetcher = async (url: string) => {
  const accessToken = localStorage.getItem('accessToken');
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};

export function useFriends() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_URL}/student/friends`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000, // 10 seconds
    }
  );

  return {
    friends: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useFriendRequests() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_URL}/student/friends/requests?type=received&status=PENDING`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  return {
    friendRequests: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useSuggestions() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_URL}/student/suggestions`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds - suggestions don't change often
    }
  );

  return {
    suggestions: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useBlockedUsers() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_URL}/student/friends/blocked`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    blockedUsers: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useSearchStudents(query: string) {
  const shouldFetch = query.trim().length >= 2;
  
  const { data, error, isLoading } = useSWR(
    shouldFetch ? `${API_URL}/student/search?q=${encodeURIComponent(query)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    searchResults: data || [],
    isLoading: shouldFetch && isLoading,
    isError: error,
  };
}
