'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useVideoCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/livestream/categories`);
        if (!response.ok) {
          throw new Error('Failed to load categories');
        }

        const data = (await response.json()) as string[];
        if (isMounted) {
          setCategories(Array.from(new Set(data.filter((value) => value.trim().length > 0))));
        }
      } catch {
        if (isMounted) {
          setCategories([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  return { categories, isLoading };
}
