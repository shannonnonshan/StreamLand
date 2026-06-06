"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ReactNode } from "react";
import { raleway } from "@/utils/front";
import { useDocumentsContext, DocumentsProvider } from "../DocumentsContext";

function DocumentsLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const teacherId = (params?.id as string) || "1"; // fallback
  const { documents, isLoading } = useDocumentsContext();

  const tabs = [
    { name: "All", slug: "all" },
    { name: "File", slug: "file" },
    { name: "Image", slug: "image" },
    { name: "Video", slug: "video" },
  ];

  const totalDocuments = documents.length;
  const imageCount = documents.filter((doc) => doc.fileType === "image").length;
  const videoCount = documents.filter((doc) => doc.fileType === "video").length;
  const fileCount = documents.filter((doc) => doc.fileType !== "image" && doc.fileType !== "video").length;
  const recentCount = documents.filter((doc) => {
    const uploadedAt = new Date(doc.uploadedAt).getTime();
    return Number.isFinite(uploadedAt) && Date.now() - uploadedAt < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const headerStats = [
    { label: "Total", value: totalDocuments },
    { label: "Files", value: fileCount },
    { label: "Images", value: imageCount },
    { label: "Videos", value: videoCount },
    { label: "Recent", value: recentCount },
  ];

  return (
    <div className={`flex h-full flex-col bg-slate-50 px-4 pb-6 pt-5 ${raleway.className}`}>
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Teacher workspace</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Your Documents</h1>
              <p className="mt-1 text-sm text-slate-500">
                {isLoading ? 'Loading live counts...' : 'Clean overview with fast access to every file.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {headerStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{stat.label}</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-0.5">
            {tabs.map((tab) => {
              const href = tab.slug === "all" ? `/teacher/${teacherId}/documents/all` : `/teacher/${teacherId}/documents/${tab.slug}`;
              const isActive = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={tab.slug}
                  href={href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-sky-600 text-white shadow-sm"
                      : tab.slug === "all"
                        ? "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                        : tab.slug === "video"
                          ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : tab.slug === "image"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return (
    <DocumentsProvider>
      <DocumentsLayoutShell>{children}</DocumentsLayoutShell>
    </DocumentsProvider>
  );
}
