"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

function decodeJwt(token: string): { sub: string; email: string; role: string } | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function navigate(path: string) {
  window.location.href = path;
}

export default function AuthCallback() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const error = searchParams.get("error");
    const isApproved = searchParams.get("isApproved");
    const bannedUntil = searchParams.get("bannedUntil");

    // Wait for params to hydrate
    if (!accessToken && !error && !isApproved) return;

    // ── Success ───────────────────────────────────────────────────────────
    if (accessToken && refreshToken) {
      const decoded = decodeJwt(accessToken);
      if (!decoded) {
        navigate("/?error=oauth_failed");
        return;
      }

      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify({
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
      }));

      if (decoded.role === "TEACHER") navigate(`/teacher/${decoded.sub}`);
      else if (decoded.role === "ADMIN") navigate(`/admin/${decoded.sub}`);
      else navigate(`/student/${decoded.sub}/dashboard`);
      return;
    }

    // ── Pending approval ──────────────────────────────────────────────────
    if (isApproved === "false") {
      sessionStorage.setItem(
        "pendingApprovalNotice",
        "Your teacher account has not been approved yet. Please wait for the approval email before signing in."
      );
      navigate("/");
      return;
    }

    // ── Banned or other error ─────────────────────────────────────────────
    if (error) {
      navigate(`/?error=${encodeURIComponent(error)}&bannedUntil=${bannedUntil || ""}`);
      return;
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2 text-gray-800">Signing you in...</h2>
        <p className="text-gray-600">Almost there.</p>
      </div>
    </div>
  );
}