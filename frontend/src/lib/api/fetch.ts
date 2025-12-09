const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Helper to get auth token
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || localStorage.getItem('accessToken');
}

// Helper to refresh access token
async function refreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const result = await response.json();
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
}

// Helper for authenticated fetch with auto-retry on 401
export async function authenticatedFetch(url: string, options: RequestInit = {}, retried = false): Promise<any> {
  const token = getAuthToken();
  
  if (!token) {
    console.error('No auth token found in localStorage');
    throw new Error('Authentication required');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Merge with any additional headers from options
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      if (typeof value === 'string') headers[key] = value;
    });
  }

  console.log('Making authenticated request:', { url, hasToken: !!token });

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If 401 and haven't retried yet, try refreshing token
  if (response.status === 401 && !retried) {
    console.log('Got 401, attempting token refresh...');
    const refreshed = await refreshToken();
    
    if (refreshed) {
      console.log('Token refreshed successfully, retrying request...');
      // Retry the request with new token
      return authenticatedFetch(url, options, true);
    } else {
      console.error('Token refresh failed');
      // Clear auth data and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/';
      throw new Error('Session expired. Please login again.');
    }
  }

  if (!response.ok) {
    console.error('API request failed:', response.status, response.statusText);
    const errorText = await response.text();
    console.error('Error details:', errorText);
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
