# OAuth Setup Guide

## Backend OAuth Implementation Complete! ✅

Đã cài đặt xong OAuth2 cho Google và GitHub với các tính năng:

### Endpoints đã tạo:

1. **Google OAuth**:
   - `GET /auth/google` - Khởi động flow Google OAuth
   - `GET /auth/google/callback` - Callback từ Google
   - `POST /auth/google` - Manual login với Google data

2. **GitHub OAuth**:
   - `GET /auth/github` - Khởi động flow GitHub OAuth
   - `GET /auth/github/callback` - Callback từ GitHub
   - `POST /auth/github` - Manual login với GitHub data

### Cấu hình cần thiết:

#### 1. Google OAuth Setup:
- Đã có credentials trong `.env`
- Callback URL: `http://localhost:3001/auth/google/callback`

#### 2. GitHub OAuth Setup:
- Tạo GitHub OAuth App tại: https://github.com/settings/developers
- Application name: StreamLand
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3001/auth/github/callback`
- Copy Client ID và Client Secret vào `.env` file:
  ```
  GITHUB_CLIENT_ID=your_github_client_id
  GITHUB_CLIENT_SECRET=your_github_client_secret
  ```

### Database Schema:
Schema đã được cập nhật với:
- `googleId` (String, unique, optional)
- `githubId` (String, unique, optional)

### Flow hoạt động:

1. User nhấn "Login with Google/GitHub" trên frontend
2. Frontend redirect đến `http://localhost:3001/auth/google` hoặc `/auth/github`
3. Backend redirect user đến Google/GitHub để authenticate
4. User đăng nhập và authorize
5. Google/GitHub redirect về `http://localhost:3001/auth/google/callback` hoặc `/auth/github/callback`
6. Backend xử lý callback:
   - Tìm user theo `googleId` hoặc `githubId`
   - Nếu không tìm thấy, tìm theo `email`
   - Nếu tìm thấy user theo email, link OAuth account vào user đó
   - Nếu không tìm thấy, tạo user mới
   - Tạo JWT tokens
7. Backend redirect về frontend với tokens: `http://localhost:3000/auth/callback?accessToken=xxx&refreshToken=xxx`
8. Frontend lưu tokens và redirect user vào app

### Frontend Integration:

Thêm buttons trong login modal:

```tsx
// Google Login
<button 
  onClick={() => window.location.href = 'http://localhost:3001/auth/google'}
  className="..."
>
  Login with Google
</button>

// GitHub Login
<button 
  onClick={() => window.location.href = 'http://localhost:3001/auth/github'}
  className="..."
>
  Login with GitHub
</button>
```

Tạo callback page tại `frontend/src/app/auth/callback/page.tsx`:

```tsx
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
      
      // Redirect to dashboard
      router.push('/student/dashboard');
    } else {
      // Error handling
      router.push('/login?error=oauth_failed');
    }
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
        <p className="text-gray-600">Please wait while we log you in.</p>
      </div>
    </div>
  );
}
```

### Testing:

1. Start backend: `npm run start:dev`
2. Navigate to: `http://localhost:3001/auth/google` or `/auth/github`
3. Complete OAuth flow
4. Check if you're redirected back with tokens

### Security Notes:

- Tokens are passed via URL query params (consider using POST for production)
- Make sure to use HTTPS in production
- Set proper CORS settings in `main.ts`
- Consider using session-based auth or httpOnly cookies for better security
