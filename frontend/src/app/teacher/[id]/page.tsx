"use client";

import { useState, Suspense } from "react";
import Overview from "@/component/teacher/dashboard/Overview";
import Content from "@/component/teacher/dashboard/Content";
import Audience from "@/component/teacher/dashboard/Audience";
import { raleway } from "@/utils/front";

const TabSkeleton = () => (
  <div className="space-y-4">
    <div className="h-80 bg-slate-100 rounded-2xl animate-pulse" />
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
      ))}
    </div>
  </div>
);

export default function TeacherHome() {
  const [activeTab, setActiveTab] = useState("overview");
  const [filter, setFilter] = useState("last 7 day");

  const tabs = ["Overview", "Content", "Audience"];
  const filterOptions = ["last 7 day", "last 30 day", "last 90 day"];

  const renderActiveTab = () => {
    switch (activeTab) {
      case "overview":
        return (
          <Suspense fallback={<TabSkeleton />}>
            <Overview filter={filter} />
          </Suspense>
        );
      case "content":
        return (
          <Suspense fallback={<TabSkeleton />}>
            <Content filter={filter} />
          </Suspense>
        );
      case "audience":
        return (
          <Suspense fallback={<TabSkeleton />}>
            <Audience filter={filter} />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex h-full flex-col px-2 pb-6 pt-5 ${raleway.className}`}>
      <div className="mx-auto w-full max-w-7xl">

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {/* Title block */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Teacher workspace
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Track your streams, content and audience.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Filter date
              </span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                {filterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>


          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-0.5">
            {tabs.map((tab) => {
              const tabKey = tab.toLowerCase();
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tabKey)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-sky-600 text-white shadow-sm"
                      : tabKey === "overview"
                        ? "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                        : tabKey === "content"
                          ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-5">{renderActiveTab()}</div>
      </div>
    </div>
  );
}