"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { useTeacherDashboard } from "@/hooks/useTeacherDashboard";
import { Video, FileText, TrendingUp } from "lucide-react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface ContentProps {
  filter: string;
}

// Helper function to get categories and data based on filter
const getChartConfig = (filter: string, stats: any) => {
  const now = new Date();
  
  if (filter === 'last 7 day') {
    const categories: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      categories.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    return { categories, dataPoints: 7 };
  }
  
  if (filter === 'last 30 day') {
    const categories: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      if (i % 5 === 0 || i === 29) {
        categories.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      } else {
        categories.push('');
      }
    }
    return { categories, dataPoints: 30 };
  }
  
  if (filter === 'last 90 day') {
    const categories: string[] = [];
    for (let i = 89; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      if (i % 15 === 0 || i === 89) {
        categories.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      } else {
        categories.push('');
      }
    }
    return { categories, dataPoints: 90 };
  }
  
  return {
    categories: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    dataPoints: 12
  };
};

export default function Content({ filter }: ContentProps) {
  const { stats, loading, error } = useTeacherDashboard(filter);
  
  const chartConfig = getChartConfig(filter, stats);
  const viewsData = stats?.dailyViews?.slice(-chartConfig.dataPoints) || Array(chartConfig.dataPoints).fill(0);
  
  const series = [
    {
      name: "Views",
      data: viewsData.length === chartConfig.dataPoints ? viewsData : Array(chartConfig.dataPoints).fill(0),
    },
    {
      name: "Recordings",
      data: Array(chartConfig.dataPoints).fill(Math.round((stats?.totalRecordings || 0) / chartConfig.dataPoints)),
    },
    {
      name: "Documents",
      data: Array(chartConfig.dataPoints).fill(Math.round((stats?.totalDocuments || 0) / chartConfig.dataPoints)),
    },
  ];

  const options: ApexOptions = {
    chart: {
      type: "area",
      height: 300,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ["#2563eb", "#9333ea", "#10b981"],
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

  return (
    <div className="w-full p-3 text-black">
    <div className="mx-auto p-6 bg-white rounded-xl shadow">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Content
        </h2>
        <p className="text-sm text-gray-600">
          Current filter: <span className="font-medium">{filter}</span>
        </p>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-blue-700 font-medium">Recordings</div>
              <div className="p-2 bg-blue-200 rounded-lg">
                <Video className="text-blue-700" size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-900">{stats.totalRecordings}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-green-700 font-medium">Documents</div>
              <div className="p-2 bg-green-200 rounded-lg">
                <FileText className="text-green-700" size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-green-900">{stats.totalDocuments}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-purple-700 font-medium">Avg Views/Stream</div>
              <div className="p-2 bg-purple-200 rounded-lg">
                <TrendingUp className="text-purple-700" size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-900">{stats.avgViewsPerStream}</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-center sm:justify-end items-center gap-x-4 mb-6">
        <div className="inline-flex items-center">
          <span className="size-2.5 inline-block bg-blue-600 rounded-sm me-2"></span>
          <span className="text-[13px] text-gray-600">Views</span>
        </div>
        <div className="inline-flex items-center">
          <span className="size-2.5 inline-block bg-purple-600 rounded-sm me-2"></span>
          <span className="text-[13px] text-gray-600">Recordings</span>
        </div>
        <div className="inline-flex items-center">
          <span className="size-2.5 inline-block bg-green-600 rounded-sm me-2"></span>
          <span className="text-[13px] text-gray-600">Documents</span>
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
    </div>
  );
}
