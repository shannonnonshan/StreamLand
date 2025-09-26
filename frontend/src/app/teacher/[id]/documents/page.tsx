"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function DocumentRootPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();

  useEffect(() => {
    const id = params.id || "1";
    router.replace(`/teacher/${id}/documents/file`);
  }, [router, params?.id]);

  return null;
}
