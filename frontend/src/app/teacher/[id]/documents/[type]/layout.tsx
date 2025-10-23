"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ReactNode } from "react";
import { raleway } from "@/utils/front";

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const teacherId = (params?.id as string) || "1"; // fallback

  const tabs = [
    { name: "File", slug: "file" },
    { name: "Image", slug: "image" },
    { name: "Video", slug: "video" },
  ];

  return (
    <div className={`flex flex-col h-full pt-5 ${raleway.className}`}>
      <h1 className="mb-4 text-black font-bold text-2xl">
        Your Documents
      </h1>
      {/* Nav Tabs */}
      <div className="flex border-b border-gray-300 space-x-6 px-4">
        {tabs.map((tab) => {
          const href = `/teacher/${teacherId}/documents/${tab.slug}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={tab.slug}
              href={href}
              className={`pb-2 font-semibold text-xl ${
                isActive
                  ? "border-b-2 border-black text-black"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>

      {/* Nội dung tab */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
