/**
 * Global fetch wrapper with automatic token refresh on 401
 * Use this instead of raw fetch() for all authenticated API calls
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    return null;
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
      return result.accessToken;
    }
    
    // Refresh failed - clear auth and redirect
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/';
    return null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

/**
 * Fetch with automatic token refresh on 401
 * Drop-in replacement for native fetch()
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  
  // Add Authorization header if not present
  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Make the request
  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      
      if (newToken) {
        onTokenRefreshed(newToken);
        
        // Retry original request with new token
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    } else {
      // Wait for refresh to complete
      const newToken = await new Promise<string>((resolve) => {
        subscribeTokenRefresh((token: string) => {
          resolve(token);
        });
      });
      
      // Retry with new token
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, {
        ...options,
        headers,
      });
    }
  }

  return response;
}
