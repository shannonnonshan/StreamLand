"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ReactNode } from "react";

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const id = (params?.id as string) || "1"; // fallback id = 1

  const tabs = [
    { name: "File", slug: "file" },
    { name: "Image", slug: "image" },
    { name: "Video", slug: "video" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Nav Tabs */}
      <div className="flex border-b border-gray-300 space-x-6 px-4">
        {tabs.map((tab) => {
          const href = `/teacher/${id}/documents/${tab.slug}`;
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={tab.slug}
              href={href}
              className={`pb-2 text-sm font-medium ${
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
