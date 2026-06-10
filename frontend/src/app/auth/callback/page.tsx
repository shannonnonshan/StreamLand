"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const error = searchParams.get("error");
    const isApproved = searchParams.get("isApproved");
    const bannedUntil = searchParams.get("bannedUntil");

    // Wait until at least one param is present — avoid running on empty pre-hydration render
    if (!accessToken && !error && !isApproved) return;

    // ── Success: tokens present → save and redirect by role ──────────────
    if (accessToken && refreshToken) {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((user) => {
          localStorage.setItem("user", JSON.stringify(user));
          if (user.role === "TEACHER") router.replace(`/teacher/${user.id}`);
          else if (user.role === "ADMIN") router.replace(`/admin/${user.id}`);
          else router.replace(`/student/${user.id}/dashboard`);
        })
        .catch(() => router.replace("/?error=oauth_failed"));
      return;
    }
    
    if (isApproved === "false") {
      sessionStorage.setItem(
        "pendingApprovalNotice",
        "Your teacher account has not been approved yet. Please wait for the approval email before signing in."
      );
      router.replace("/");
      return;
    }

    if (error) {
      router.replace(`/?error=${encodeURIComponent(error)}&bannedUntil=${bannedUntil || ""}`);
      return;
    }
  }, [searchParams]);

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