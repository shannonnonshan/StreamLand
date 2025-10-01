"use client";

import { useState } from "react";
import Overview from "@/component/teacher/dashboard/Overview";
import Content from "@/component/teacher/dashboard/Content";
import Audience from "@/component/teacher/dashboard/Audience";

export default function TeacherHome() {
  const [activeTab, setActiveTab] = useState("overview");
  const [filter, setFilter] = useState("last 7 day");

  const tabs = ["Overview", "Content", "Audience"];
  const filterOptions = ["last 7 day", "last 30 day", "last 90 day"];

  const renderActiveTab = () => {
    switch (activeTab) {
      case "overview":
        return <Overview filter={filter} />;
      case "content":
        return <Content filter={filter} />;
      case "audience":
        return <Audience filter={filter} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full p-3 text-black">
      {/* Top row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-3">
          <button className="bg-yellow-300 text-black font-semibold px-4 py-2 rounded-full hover:bg-yellow-400">
            + Schedule live stream
          </button>
          <button className="bg-red-400 text-white font-semibold px-4 py-2 rounded-full hover:bg-red-500">
            + Start your live stream
          </button>
        </div>
      </div>

      {/* Tabs + Filter */}
      <div className="flex items-center justify-between border-b">
        <div className="flex gap-8">
          {tabs.map((tab) => {
            const tabKey = tab.toLowerCase();
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tabKey)}
                className={`pb-2 text-sm font-medium ${
                  activeTab === tabKey
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-black"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Filter Date</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-yellow-300 text-black text-sm px-3 py-1 rounded-md focus:outline-none"
          >
            {filterOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">{renderActiveTab()}</div>
    </div>
  );
}
