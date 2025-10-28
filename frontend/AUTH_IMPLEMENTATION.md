# Frontend Authentication Implementation

## ✅ Đã hoàn thành:

### 1. Custom Hook `useAuth()`
Tạo file: `frontend/src/hooks/useAuth.ts`

**Features:**
- `register(data)` - Đăng ký tài khoản mới
- `login(data)` - Đăng nhập với email/password
- `verifyOtp(data)` - Xác thực OTP
- `requestOtp(email)` - Yêu cầu gửi lại OTP
- `loginWithGoogle()` - Đăng nhập Google OAuth
- `loginWithGithub()` - Đăng nhập GitHub OAuth
- `logout()` - Đăng xuất
- `getProfile()` - Lấy thông tin user
- `user` - Thông tin user hiện tại
- `loading` - Trạng thái loading
- `error` - Thông báo lỗi
- `isAuthenticated` - Trạng thái đăng nhập

### 2. Cập nhật Login Modal
File: `frontend/src/component/(modal)/login.tsx`

**Changes:**
- ✅ Import và sử dụng `useAuth()` hook
- ✅ Thay thế mock API bằng real API calls
- ✅ Thêm Google OAuth button
- ✅ Thêm GitHub OAuth button
- ✅ Auto redirect dựa trên role (TEACHER → /teacher/[id], STUDENT → /student/dashboard)
- ✅ Hiển thị loading state
- ✅ Xử lý errors từ backend

### 3. OAuth Callback Page
Tạo file: `frontend/src/app/auth/callback/page.tsx`

**Purpose:**
- Nhận tokens từ OAuth redirect
- Lưu tokens vào localStorage
- Fetch user profile
- Redirect đến trang phù hợp theo role

### 4. Environment Variables
Tạo file: `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 📋 Cách sử dụng useAuth() trong components:

### Example 1: Login Component
```tsx
'use client';

import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  
  const handleLogin = async (e) => {
    e.preventDefault();
    const result = await login({
      email: 'user@example.com',
      password: 'password123'
    });
    
    if (result.success) {
      // Redirect or show success message
    }
  };
  
  return (
    <form onSubmit={handleLogin}>
      {/* Form fields */}
      <button disabled={loading}>
        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
}
```

### Example 2: Register Component
```tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export default function RegisterPage() {
  const { register, verifyOtp, loading } = useAuth();
  const [showOtp, setShowOtp] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  const handleRegister = async (data) => {
    const result = await register(data);
    
    if (result.success) {
      setUserEmail(result.email);
      setShowOtp(true);
    }
  };
  
  const handleVerifyOtp = async (otp) => {
    const result = await verifyOtp({
      email: userEmail,
      otp: otp
    });
    
    if (result.success) {
      // User is now logged in, redirect
    }
  };
  
  return (
    <>
      {!showOtp ? (
        <RegisterForm onSubmit={handleRegister} />
      ) : (
        <OTPForm onSubmit={handleVerifyOtp} email={userEmail} />
      )}
    </>
  );
}
```

### Example 3: Protected Page
```tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [loading, isAuthenticated, router]);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Welcome, {user?.fullName}!</h1>
      <p>Email: {user?.email}</p>
      <p>Role: {user?.role}</p>
    </div>
  );
}
```

### Example 4: OAuth Login
```tsx
'use client';

import { useAuth } from '@/hooks/useAuth';

export default function SocialLogin() {
  const { loginWithGoogle, loginWithGithub } = useAuth();
  
  return (
    <div>
      <button onClick={loginWithGoogle}>
        Login with Google
      </button>
      
      <button onClick={loginWithGithub}>
        Login with GitHub
      </button>
    </div>
  );
}
```

### Example 5: Logout
```tsx
'use client';

import { useAuth } from '@/hooks/useAuth';

export default function LogoutButton() {
  const { logout, loading } = useAuth();
  
  return (
    <button onClick={logout} disabled={loading}>
      {loading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
```

## 🔄 Authentication Flow:

### 1. Email/Password Registration:
```
User fills form → register() → Backend creates user → OTP sent
→ User enters OTP → verifyOtp() → Tokens returned → Auto login
→ Redirect to dashboard
```

### 2. Email/Password Login:
```
User enters credentials → login() → Backend validates
→ Tokens returned → Save to localStorage → Redirect based on role
```

### 3. Google OAuth:
```
User clicks "Login with Google" → loginWithGoogle()
→ Redirect to Google → User authorizes → Google redirects to /auth/google/callback
→ Backend processes → Redirects to /auth/callback with tokens
→ Frontend saves tokens → Fetches user profile → Redirect to dashboard
```

### 4. GitHub OAuth:
```
User clicks "Login with GitHub" → loginWithGithub()
→ Redirect to GitHub → User authorizes → GitHub redirects to /auth/github/callback
→ Backend processes → Redirects to /auth/callback with tokens
→ Frontend saves tokens → Fetches user profile → Redirect to dashboard
```

## 🔐 Token Management:

Tokens được lưu trong `localStorage`:
- `accessToken` - JWT token (expires in 15 minutes)
- `refreshToken` - Refresh token (expires in 7 days)
- `user` - User profile data

## 📝 Next Steps:

1. ✅ Update Register modal to use `useAuth()`
2. ✅ Update Verify OTP modal to use `useAuth()`
3. ⏳ Test all authentication flows
4. ⏳ Add refresh token logic
5. ⏳ Add protected route middleware
6. ⏳ Handle token expiration
7. ⏳ Setup GitHub OAuth App credentials

## 🧪 Testing:

### Backend (Terminal 1):
```bash
cd backend
npm run start:dev
```

### Frontend (Terminal 2):
```bash
cd frontend
npm run dev
```

### Test URLs:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Google OAuth: http://localhost:3001/auth/google
- GitHub OAuth: http://localhost:3001/auth/github
- Callback: http://localhost:3000/auth/callback

## ⚠️ Important Notes:

1. Make sure CORS is enabled in backend `main.ts`:
```typescript
app.enableCors({
  origin: 'http://localhost:3000',
  credentials: true,
});
```

2. Add validation pipe in backend `main.ts`:
```typescript
app.useGlobalPipes(new ValidationPipe());
```

3. For production, use environment variables and HTTPS.

4. Consider using httpOnly cookies instead of localStorage for better security.
