# OAuth Role Selection Logic

## 🎯 Tổng Quan

Hệ thống OAuth của StreamLand cho phép user chọn role (STUDENT hoặc TEACHER) trước khi đăng nhập bằng Google hoặc GitHub.

## 🔄 Flow Hoạt Động

### 1. **User Click OAuth Button**
```
User → Click "Đăng nhập bằng Google/GitHub" 
     → Role Selector Modal xuất hiện
```

### 2. **User Chọn Role**
```
User → Chọn "Học Viên" (STUDENT) hoặc "Giáo Viên" (TEACHER)
     → Role được encode thành base64 và thêm vào state parameter
     → Redirect đến OAuth provider
```

### 3. **OAuth Provider Authentication**
```
OAuth Provider → User đăng nhập và cho phép quyền truy cập
               → Redirect về backend callback với state parameter
```

### 4. **Backend Xử Lý**
```
Backend → Decode state parameter để lấy role
        → Kiểm tra user tồn tại với socialId (googleId/githubId)
        → Nếu không: Kiểm tra user tồn tại với email
        → Nếu có email: Link social account vào user hiện tại
        → Nếu không có: Tạo user mới với role được chọn
        → Tạo JWT tokens
        → Redirect về frontend với tokens
```

### 5. **Frontend Complete Auth**
```
Frontend → Lưu tokens vào localStorage
         → Fetch user profile
         → Redirect theo role:
           - TEACHER: /teacher/[id]
           - STUDENT: /student/dashboard
```

## 📝 Implementation Details

### Frontend (useAuth Hook)

```typescript
// hooks/useAuth.ts
const loginWithGoogle = useCallback((role?: 'STUDENT' | 'TEACHER') => {
  // Encode role as base64 state parameter
  const state = role ? btoa(JSON.stringify({ role })) : undefined;
  const url = state 
    ? `${API_URL}/auth/google?state=${encodeURIComponent(state)}`
    : `${API_URL}/auth/google`;
  window.location.href = url;
}, []);
```

### Backend (Google Strategy)

```typescript
// strategies/google.strategy.ts
async validate(
  request: any,
  accessToken: string,
  refreshToken: string,
  profile: Profile,
  done: VerifyCallback,
): Promise<any> {
  // Extract role from state parameter
  let role: 'STUDENT' | 'TEACHER' | undefined;
  try {
    if (request.query.state) {
      const decoded = JSON.parse(
        Buffer.from(request.query.state, 'base64').toString()
      );
      role = decoded.role;
    }
  } catch (error) {
    console.error('Failed to parse OAuth state:', error);
  }

  const user = await this.authService.googleLogin({
    googleId: id,
    email: emails?.[0]?.value || '',
    fullName: displayName,
    avatar: photos?.[0]?.value,
    role, // Pass role to auth service
  });

  done(null, user);
}
```

### Backend (Auth Service)

```typescript
// auth.service.ts
async googleLogin(googleData: {
  googleId: string;
  email: string;
  fullName: string;
  avatar?: string;
  role?: Role;
}) {
  // ... logic kiểm tra user ...
  
  // Khi tạo user mới
  user = await this.prisma.user.create({
    data: {
      email: googleData.email,
      fullName: googleData.fullName,
      googleId: googleData.googleId,
      avatar: googleData.avatar,
      password: '',
      isVerified: true,
      role: googleData.role || 'STUDENT', // ⭐ Sử dụng role được chọn
    },
  });
}
```

## 🎨 UI Components

### Role Selector Modal

Modal cho phép user chọn role trước khi OAuth:

```tsx
// component/(modal)/roleSelector.tsx
<RoleSelectorModal 
  isOpen={isRoleSelectorOpen}
  closeModal={() => setIsRoleSelectorOpen(false)}
  onSelectRole={handleRoleSelect}
  provider={selectedProvider} // 'google' | 'github'
/>
```

Features:
- 2 options: Học Viên (STUDENT) và Giáo Viên (TEACHER)
- Icons và descriptions rõ ràng
- Hover effects với colors khác nhau
- Cancel button

### Login Modal Integration

```tsx
// component/(modal)/login.tsx
const handleOAuthClick = (provider: 'google' | 'github') => {
  setSelectedProvider(provider);
  setIsRoleSelectorOpen(true); // Mở role selector
};

const handleRoleSelect = (role: 'STUDENT' | 'TEACHER') => {
  setIsRoleSelectorOpen(false);
  
  // Call OAuth with role
  if (selectedProvider === 'google') {
    loginWithGoogle(role);
  } else {
    loginWithGithub(role);
  }
};
```

## 🔐 Security Considerations

### State Parameter
- State được encode bằng base64
- Chứa JSON object với role: `{ role: 'STUDENT' | 'TEACHER' }`
- Backend validate và decode an toàn với try-catch

### Default Behavior
- Nếu không có role trong state → Default là `STUDENT`
- Nếu decode state failed → Continue without role, default `STUDENT`
- Existing users: Role không bị thay đổi khi link social account

### Account Linking Logic

```typescript
// Priority order:
1. Find by socialId (googleId/githubId)
   - If found: Use existing user (keep their role)

2. If not found, find by email
   - If found: Link social account to existing user (keep their role)
   
3. If not found:
   - Create new user with selected role (or default STUDENT)
```

## 📊 Data Flow Diagram

```
┌─────────────┐
│   Landing   │
│    Page     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Login Modal  │ ◄─── Click "Đăng nhập bằng Google/GitHub"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Role        │
│ Selector    │ ◄─── Choose STUDENT or TEACHER
│ Modal       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   OAuth     │
│  Provider   │ ◄─── state=eyJyb2xlIjoiU1RVRE...
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Backend    │
│  Strategy   │ ◄─── Decode state, extract role
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Auth     │
│  Service    │ ◄─── Check user, create/link with role
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Tokens    │
│  Generated  │ ◄─── JWT tokens created
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Redirect   │
│  Callback   │ ◄─── /auth/callback?accessToken=...
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Dashboard   │ ◄─── Redirect by role
└─────────────┘
```

## 🧪 Testing

### Test Cases

1. **New User - Student Role**
   - Click OAuth button
   - Select "Học Viên"
   - Complete OAuth
   - Verify: User created with role=STUDENT
   - Verify: Redirected to /student/dashboard

2. **New User - Teacher Role**
   - Click OAuth button
   - Select "Giáo Viên"
   - Complete OAuth
   - Verify: User created with role=TEACHER
   - Verify: Redirected to /teacher/[id]

3. **Existing User - Account Linking**
   - User exists with email only (no socialId)
   - Login with OAuth
   - Verify: Social account linked
   - Verify: Role NOT changed (keep existing)

4. **Returning OAuth User**
   - User has socialId already
   - Login with OAuth
   - Verify: Login successful
   - Verify: Role unchanged

5. **No Role Selected (Edge Case)**
   - Direct access to OAuth URL without state
   - Complete OAuth
   - Verify: User created with default role=STUDENT

## 🔧 Configuration

### Environment Variables Required

**Backend (.env)**:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
APP_URL=http://localhost:3001
```

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### OAuth App Configuration

**Google Console**:
- Authorized redirect URIs: `http://localhost:3001/auth/google/callback`

**GitHub OAuth App**:
- Authorization callback URL: `http://localhost:3001/auth/github/callback`

## 📚 Related Files

### Frontend
- `src/hooks/useAuth.ts` - Auth hook with OAuth methods
- `src/component/(modal)/login.tsx` - Login modal with OAuth buttons
- `src/component/(modal)/roleSelector.tsx` - Role selection modal
- `src/app/auth/callback/page.tsx` - OAuth callback handler
- `src/app/page.tsx` - Landing page

### Backend
- `src/auth/strategies/google.strategy.ts` - Google OAuth strategy
- `src/auth/strategies/github.strategy.ts` - GitHub OAuth strategy
- `src/auth/auth.service.ts` - Authentication business logic
- `src/auth/dto/google-login.dto.ts` - Google login DTO with role
- `src/auth/dto/github-login.dto.ts` - GitHub login DTO with role

## ✨ Features

✅ Role selection before OAuth
✅ Beautiful UI with animations
✅ Account linking for existing users
✅ Default role fallback
✅ Secure state parameter handling
✅ Error handling for edge cases
✅ Role-based redirect after login
✅ Support for both Google and GitHub
