'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      // Save tokens to localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Get user profile
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
        .then((res) => res.json())
        .then((user) => {
          localStorage.setItem('user', JSON.stringify(user));

          // Redirect based on role
          if (user.role === 'TEACHER') {
            router.push(`/teacher/${user.id}`);
          } else if (user.role === 'ADMIN') {
            router.push('/admin/dashboard');
          } else {
            router.push(`/student/${user.id}/dashboard`);
          }
        })
        .catch(() => {
          router.push('/login?error=oauth_failed');
        });
    } else {
      // Error handling
      router.push('/?error=oauth_failed');
    }
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2 text-gray-800">Authenticating...</h2>
        <p className="text-gray-600">Please wait a moment.</p>
      </div>
    </div>
  );
}
