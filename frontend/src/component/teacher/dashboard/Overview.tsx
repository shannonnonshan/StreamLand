"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import Image from "next/image";
import { useTeacherDashboard } from "@/hooks/useTeacherDashboard";
import { Users, Eye, Video, FileText } from "lucide-react";

// Lazy load ApexCharts only when needed (reduces initial bundle)
const ReactApexChart = dynamic(() => import("react-apexcharts"), { 
  ssr: false,
  loading: () => <div className="h-80 bg-gray-100 rounded-lg animate-pulse" />,
});

interface OverviewProps {
  filter: string;
}

// Helper function to get categories and data based on filter
const getChartConfig = (filter: string, stats: any) => {
  const now = new Date();
  
  if (filter === 'last 7 day') {
    const categories: string[] = [];
    const viewsData: number[] = stats?.dailyViews?.slice(-7) || [];
    const subsData: number[] = stats?.dailySubscribers?.slice(-7) || [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      categories.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    
    return { 
      categories, 
      viewsData: viewsData.length === 7 ? viewsData : Array(7).fill(0),
      subsData: subsData.length === 7 ? subsData : Array(7).fill(0)
    };
  }
  
  if (filter === 'last 30 day') {
    const categories: string[] = [];
    const viewsData: number[] = stats?.dailyViews?.slice(-30) || [];
    const subsData: number[] = stats?.dailySubscribers?.slice(-30) || [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      if (i % 5 === 0 || i === 29) { // Show every 5th day
        categories.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      } else {
        categories.push('');
      }
    }
    
    return { 
      categories, 
      viewsData: viewsData.length === 30 ? viewsData : Array(30).fill(0),
      subsData: subsData.length === 30 ? subsData : Array(30).fill(0)
    };
  }
  
  if (filter === 'last 90 day') {
    const categories: string[] = [];
    const viewsData: number[] = stats?.dailyViews?.slice(-90) || [];
    const subsData: number[] = stats?.dailySubscribers?.slice(-90) || [];
    
    for (let i = 89; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      if (i % 15 === 0 || i === 89) { // Show every 15th day
        categories.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      } else {
        categories.push('');
      }
    }
    
    return { 
      categories, 
      viewsData: viewsData.length === 90 ? viewsData : Array(90).fill(0),
      subsData: subsData.length === 90 ? subsData : Array(90).fill(0)
    };
  }
  
  // Default: last 12 months
  return {
    categories: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    viewsData: stats?.monthlyViews || Array(12).fill(0),
    subsData: stats?.monthlySubscribers || Array(12).fill(0)
  };
};

export default function Overview({ filter }: OverviewProps) {
  const { stats, loading, error } = useTeacherDashboard(filter);
  
  const chartConfig = getChartConfig(filter, stats);
  
  const series = [
    {
      name: "Views",
      data: chartConfig.viewsData,
    },
    {
      name: "Subscribers",
      data: chartConfig.subsData,
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
      categories: chartConfig.categories,
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
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">Total Students</div>
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="text-blue-600" size={20} />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats?.totalStudents || 0}</div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">Total Views</div>
          <div className="p-2 bg-purple-100 rounded-lg">
            <Eye className="text-purple-600" size={20} />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats?.totalViews.toLocaleString() || 0}</div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">Livestreams</div>
          <div className="p-2 bg-red-100 rounded-lg">
            <Video className="text-red-600" size={20} />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats?.totalLivestreams || 0}</div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">Documents</div>
          <div className="p-2 bg-green-100 rounded-lg">
            <FileText className="text-green-600" size={20} />
          </div>
        </div>
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
        <div className="mx-auto">
        {stats && stats.monthlyViews ? (
          <ReactApexChart 
              options={options} 
              series={series} 
              type="area" 
              height={300} 
          />
        ) : (
          <div className="h-80 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Loading chart...</p>
          </div>
        )}
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
