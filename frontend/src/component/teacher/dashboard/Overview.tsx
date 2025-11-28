"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import Image from "next/image";
import { useTeacherDashboard } from "@/hooks/useTeacherDashboard";
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface OverviewProps {
  filter: string;
}

export default function Overview({ filter }: OverviewProps) {
  const { stats, loading, error } = useTeacherDashboard();
  
  const series = [
    {
      name: "Views",
      data: stats?.monthlyViews || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      name: "Subscribers",
      data: stats?.monthlySubscribers || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ];

  const options: ApexOptions = {
    chart: {
      type: "area",
      height: 300,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ["#2563eb", "#9333ea"],
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    grid: { strokeDashArray: 2, borderColor: "#e5e7eb" },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.1, opacityTo: 0.8 },
    },
    xaxis: {
      categories: [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec",
      ],
      labels: {
        style: { colors: "#9ca3af", fontSize: "13px" },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#9ca3af", fontSize: "13px" },
        formatter: (value) => (value >= 1000 ? `${value / 1000}k` : value.toString()),
      },
    },
    tooltip: {
      y: {
        formatter: (value) => `${value >= 1000 ? `${value / 1000}k` : value}`,
      },
    },
    legend: { show: false },
  };
  const topStreams = stats?.topLivestreams || [];
  if (loading) {
    return (
      <div className="w-full p-3 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-3 flex items-center justify-center min-h-[400px]">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="w-full p-3 text-black">
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="text-sm text-gray-600 mb-1">Total Students</div>
        <div className="text-2xl font-bold text-gray-900">{stats?.totalStudents || 0}</div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="text-sm text-gray-600 mb-1">Total Views</div>
        <div className="text-2xl font-bold text-gray-900">{stats?.totalViews.toLocaleString() || 0}</div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="text-sm text-gray-600 mb-1">Livestreams</div>
        <div className="text-2xl font-bold text-gray-900">{stats?.totalLivestreams || 0}</div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="text-sm text-gray-600 mb-1">Documents</div>
        <div className="text-2xl font-bold text-gray-900">{stats?.totalDocuments || 0}</div>
      </div>
    </div>

    <div className="mx-auto p-6 bg-white rounded-xl shadow">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Overview - Last 12 Months
        </h2>
        <p className="text-sm text-gray-600">
          Current filter: <span className="font-medium">{filter}</span>
        </p>
      </div>

      {/* Legend */}
      <div className="flex justify-center sm:justify-end items-center gap-x-4 mb-6">
        <div className="inline-flex items-center">
          <span className="size-2.5 inline-block bg-blue-600 rounded-sm me-2"></span>
          <span className="text-[13px] text-gray-600">Views</span>
        </div>
        <div className="inline-flex items-center">
          <span className="size-2.5 inline-block bg-purple-600 rounded-sm me-2"></span>
          <span className="text-[13px] text-gray-600">Subscribers</span>
        </div>
      </div>

      {/* Chart Wrapper */}
        <div className=" mx-auto">
        <ReactApexChart 
            options={options} 
            series={series} 
            type="area" 
            height={300} 
        />
        </div>
    </div>
    {/* Top live streams */}
      <div className="mx-auto mt-6 bg-[#292C6D] rounded-xl shadow p-6">
        <h2 className="text-xl mb-4 font-semibold text-white">Your top live streams</h2>
        {topStreams.length === 0 ? (
          <p className="text-white text-center py-8">No ended livestreams yet</p>
        ) : (
          <>
            {/* Header row */}
            <div className="grid grid-cols-12 px-4 py-2 mb-3 text-sm font-semibold text-white border-b">
              <div className="col-span-6">Content</div>
              <div className="col-span-3">Peak Viewers</div>
              <div className="col-span-3">Total Views</div>
            </div>
            <div className="space-y-4">
              {topStreams.map((stream) => (
                <div
                  key={stream.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-between p-4"
                >
                  {/* Content */}
                  <div className="flex items-center gap-3 w-1/2">
                    <Image 
                      src={stream.thumbnail || "/logo.png"} 
                      alt={stream.title} 
                      width={80} 
                      height={64} 
                      className="rounded-lg object-cover" 
                    />
                    <h3 className="font-semibold text-gray-800">{stream.title}</h3>
                  </div>

                  {/* Peak Viewers */}
                  <div className="w-1/4 text-gray-600">{stream.peakViewers.toLocaleString()}</div>

                  {/* Total Views */}
                  <div className="w-1/4 text-gray-600">{stream.totalViews.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
