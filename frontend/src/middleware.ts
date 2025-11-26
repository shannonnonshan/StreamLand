import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  
  const { pathname } = request.nextUrl;

  // Public routes - allow without auth
  const publicRoutes = ['/auth/login', '/auth/register', '/auth/callback', '/auth/oauth-complete', '/'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Check if user is authenticated
  if (!token) {
    if (!isPublicRoute && !pathname.startsWith('/student')) {
      // Redirect to login if trying to access protected routes
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
    return NextResponse.next();
  }

  // Verify JWT token and get role from it
  let user: { role: string; sub: string } | null = null;
  try {
    const secretKey = process.env.NEXT_PUBLIC_JWT_SECRET || process.env.JWT_SECRET;
    if (!secretKey) {
      console.error('[Middleware] JWT_SECRET not configured');
      throw new Error('JWT_SECRET not configured');
    }
    const secret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, secret);
    user = {
      role: payload.role as string,
      sub: payload.sub as string,
    };
  } catch (e) {
    console.error('Failed to verify JWT token:', e);
    // Invalid token, clear cookies and redirect to login
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    response.cookies.delete('token');
    response.cookies.delete('user');
    return response;
  }

  if (!user || !user.role || !user.sub) {
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    response.cookies.delete('token');
    response.cookies.delete('user');
    return response;
  }

  // Role-based route protection - logout and redirect to login if wrong role
  if (pathname.startsWith('/teacher/')) {
    if (user.role !== 'TEACHER') {
      const response = NextResponse.redirect(new URL('/auth/login?error=unauthorized&required=teacher', request.url));
      response.cookies.delete('token');
      response.cookies.delete('user');
      return response;
    }
  }

  if (pathname.startsWith('/admin/')) {
    if (user.role !== 'ADMIN') {
      const response = NextResponse.redirect(new URL('/auth/login?error=unauthorized&required=admin', request.url));
      response.cookies.delete('token');
      response.cookies.delete('user');
      return response;
    }
  }

  if (pathname.startsWith('/student/') && pathname !== '/student') {
    if (user.role !== 'STUDENT') {
      const response = NextResponse.redirect(new URL('/auth/login?error=unauthorized&required=student', request.url));
      response.cookies.delete('token');
      response.cookies.delete('user');
      return response;
    }
  }

  return NextResponse.next();
}

// Disable middleware - role checking is done in layouts
export const config = {
  matcher: [],
};
