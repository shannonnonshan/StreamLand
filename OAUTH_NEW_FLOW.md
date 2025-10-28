# OAuth New User Flow - Logic Implementation

## 🎯 Overview

Đã implement logic mới cho OAuth authentication: **Kiểm tra user tồn tại trước khi yêu cầu thông tin bổ sung**.

## 📋 Flow Description

### Old Flow (Deprecated)
1. User clicks OAuth button
2. User selects role BEFORE authentication
3. Backend creates account with role

**Problem**: Existing users bị buộc phải chọn role mỗi lần đăng nhập.

### New Flow (Current Implementation)

#### For Existing Users:
```
User → Click Google/GitHub → Authenticate → Backend detects existing user → Auto login → Dashboard
```

#### For New Users:
```
User → Click Google/GitHub → Authenticate → Backend detects new user → Frontend shows registration modal → User selects role + provides additional info → Account created → Dashboard
```

## 🏗️ Implementation Details

### Backend Changes

#### 1. **auth.service.ts** - Modified OAuth login methods

```typescript
async googleLogin(googleData) {
  // Check if user exists
  let user = await this.prisma.user.findUnique({ where: { googleId } });
  
  if (!user) {
    user = await this.prisma.user.findUnique({ where: { email } });
    
    if (user) {
      // Link Google account to existing user
      user = await this.prisma.user.update({ ... });
    } else {
      // NEW USER - Return profile data without creating account
      return {
        isNewUser: true,
        provider: 'google',
        profile: { googleId, email, fullName, avatar }
      };
    }
  }
  
  // EXISTING USER - Generate tokens and login
  const tokens = await this.generateTokens(...);
  return {
    isNewUser: false,
    user, 
    ...tokens
  };
}
```

**Key Changes**:
- Returns `isNewUser: true` with profile data for new users
- Returns `isNewUser: false` with tokens for existing users
- No longer creates user account immediately

#### 2. **auth.controller.ts** - Modified OAuth callbacks

```typescript
@Get('google/callback')
googleAuthCallback(@Request() req, @Res() res) {
  const result = req.user;
  
  if (result.isNewUser) {
    // Redirect to registration completion page
    const profileData = encodeURIComponent(JSON.stringify(result.profile));
    res.redirect(`${FRONTEND_URL}/auth/oauth-complete?provider=${result.provider}&profile=${profileData}`);
  } else {
    // Redirect with tokens for existing user
    res.redirect(`${FRONTEND_URL}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`);
  }
}
```

#### 3. **New Endpoint** - Complete OAuth registration

```typescript
@Post('complete-oauth')
async completeOAuth(@Body() completeOAuthDto: CompleteOAuthDto) {
  return this.authService.completeOAuthRegistration(completeOAuthDto);
}
```

#### 4. **New DTO** - CompleteOAuthDto

```typescript
export class CompleteOAuthDto {
  provider: 'google' | 'github';
  socialId: string;
  email: string;
  fullName: string;
  avatar?: string;
  role: Role;              // Required
  phoneNumber?: string;    // Optional
  address?: string;        // Optional
}
```

#### 5. **New Service Method** - completeOAuthRegistration

```typescript
async completeOAuthRegistration(data: CompleteOAuthDto) {
  // Check for existing user
  const existingUser = await this.prisma.user.findFirst({
    where: {
      OR: [
        { email },
        provider === 'google' ? { googleId: socialId } : { githubId: socialId }
      ]
    }
  });
  
  if (existingUser) {
    throw new ConflictException('User already exists');
  }
  
  // Create new user with all data
  const user = await this.prisma.user.create({
    data: {
      email, fullName, role,
      ...(provider === 'google' ? { googleId: socialId } : { githubId: socialId }),
      avatar, phoneNumber, address,
      password: '',
      isVerified: true
    }
  });
  
  // Generate tokens and return
  const tokens = await this.generateTokens(...);
  return { user, ...tokens };
}
```

### Frontend Changes

#### 1. **New Modal** - `completeOAuth.tsx`

Features:
- Displays user profile from OAuth provider (avatar, name, email)
- Role selection (Student / Teacher) - **Required**
- Phone number input - Optional
- Address textarea - Optional
- Beautiful UI with Framer Motion animations
- Error handling

Props:
```typescript
interface CompleteOAuthModalProps {
  isOpen: boolean;
  closeModal: () => void;
  provider: 'google' | 'github';
  profile: {
    socialId: string;
    email: string;
    fullName: string;
    avatar?: string;
  };
  onComplete: (data: {
    role: 'STUDENT' | 'TEACHER';
    phoneNumber?: string;
    address?: string;
  }) => void;
}
```

#### 2. **New Page** - `/auth/oauth-complete/page.tsx`

Purpose: Handle OAuth new user redirect and show completion modal

Flow:
```typescript
1. Parse URL params (provider, profile)
2. Show CompleteOAuthModal
3. On submit → Call completeOAuthRegistration()
4. On success → Redirect to dashboard based on role
```

#### 3. **Updated Hook** - `useAuth.ts`

New method:
```typescript
const completeOAuthRegistration = async (data: {
  provider: 'google' | 'github';
  socialId: string;
  email: string;
  fullName: string;
  avatar?: string;
  role: 'STUDENT' | 'TEACHER';
  phoneNumber?: string;
  address?: string;
}) => {
  const response = await fetch(`${API_URL}/auth/complete-oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const result = await response.json();
  
  // Save tokens and user data
  localStorage.setItem('accessToken', result.accessToken);
  localStorage.setItem('refreshToken', result.refreshToken);
  localStorage.setItem('user', JSON.stringify(result.user));
  
  setUser(result.user);
  setIsAuthenticated(true);
  
  return { success: true, user: result.user };
};
```

## 🔄 Complete User Journey

### Scenario 1: New User with Google

1. User visits landing page
2. Clicks "Đăng Nhập bằng Google"
3. Redirects to Google OAuth consent screen
4. Google authenticates user and returns to `/auth/google/callback`
5. Backend checks: No user with this googleId or email exists
6. Backend returns `{ isNewUser: true, profile: {...} }`
7. Backend redirects to `/auth/oauth-complete?provider=google&profile=...`
8. Frontend shows `CompleteOAuthModal` with:
   - User's Google avatar and name
   - Role selection buttons
   - Optional phone and address fields
9. User selects "Học Viên" (Student) role
10. Frontend calls `POST /auth/complete-oauth` with all data
11. Backend creates new user with role = STUDENT
12. Backend returns tokens
13. Frontend saves tokens and redirects to `/student/dashboard`

### Scenario 2: Existing User with Google

1. User visits landing page
2. Clicks "Đăng Nhập bằng Google"
3. Redirects to Google OAuth consent screen
4. Google authenticates user and returns to `/auth/google/callback`
5. Backend checks: User exists with this googleId or email
6. Backend generates tokens immediately
7. Backend returns `{ isNewUser: false, user: {...}, tokens }`
8. Backend redirects to `/auth/callback?accessToken=...&refreshToken=...`
9. Frontend saves tokens (existing callback logic)
10. Frontend redirects to dashboard based on stored user role

### Scenario 3: Email User Already Registered, First Time Using Google

1. User has account with email `user@gmail.com` and password
2. User clicks "Đăng Nhập bằng Google"
3. Google returns same email `user@gmail.com`
4. Backend finds existing user by email
5. Backend **links** Google account: `UPDATE user SET googleId = '...'`
6. Backend logs user in immediately
7. No registration modal shown
8. User can now login with either email/password OR Google

## 🔒 Security Considerations

1. **Duplicate Prevention**: Backend checks both socialId AND email before creating account
2. **Account Linking**: Existing email users automatically linked to OAuth provider
3. **Verified Status**: OAuth users automatically have `isVerified: true`
4. **Token Security**: JWT tokens generated only after successful registration/login

## 📁 Files Changed

### Backend
- `src/auth/auth.service.ts` - Modified googleLogin() and githubLogin()
- `src/auth/auth.service.ts` - Added completeOAuthRegistration()
- `src/auth/auth.controller.ts` - Modified OAuth callbacks
- `src/auth/auth.controller.ts` - Added POST /complete-oauth endpoint
- `src/auth/dto/complete-oauth.dto.ts` - Created new DTO
- `src/auth/dto/register.dto.ts` - Exported Role enum
- `src/auth/dto/index.ts` - Exported CompleteOAuthDto and Role

### Frontend
- `src/component/(modal)/completeOAuth.tsx` - New modal component
- `src/app/auth/oauth-complete/page.tsx` - New page for OAuth completion
- `src/hooks/useAuth.ts` - Added completeOAuthRegistration() method

## ✅ Testing Checklist

- [ ] New user with Google → Shows registration modal → Creates account → Redirects to dashboard
- [ ] New user with GitHub → Shows registration modal → Creates account → Redirects to dashboard
- [ ] Existing user with Google → Auto login → No modal → Redirects to dashboard
- [ ] Existing user with GitHub → Auto login → No modal → Redirects to dashboard
- [ ] Email user uses Google first time → Auto linked → No modal → Auto login
- [ ] Role selection required validation works
- [ ] Optional fields (phone, address) saved correctly
- [ ] Error handling for duplicate accounts
- [ ] Token generation and storage working
- [ ] Redirect to correct dashboard based on role (teacher/[id] vs student/dashboard)

## 🚀 Next Steps

1. Test Google OAuth with new flow
2. Setup GitHub OAuth App
3. Test GitHub OAuth with new flow
4. Add error handling for network failures
5. Add loading states during OAuth process
6. Consider adding profile picture upload option in completion modal

## 📝 Notes

- Old role selection modal (`roleSelector.tsx`) can be deprecated/removed
- State parameter no longer needed in OAuth URLs
- Backend now controls the flow based on user existence
- Frontend reacts to backend's decision (isNewUser flag)
- More user-friendly: No unnecessary inputs for existing users
