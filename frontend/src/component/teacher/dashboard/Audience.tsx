"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { useTeacherDashboard } from "@/hooks/useTeacherDashboard";
import { Users, Clock, Star } from "lucide-react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface AudienceProps {
  filter: string;
  teacherId?: string;
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
      if (i % 5 === 0 || i === 29) {
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
      if (i % 15 === 0 || i === 89) {
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
  
  return {
    categories: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    viewsData: stats?.monthlyViews || Array(12).fill(0),
    subsData: stats?.monthlySubscribers || Array(12).fill(0)
  };
};

export default function Audience({ filter, teacherId }: AudienceProps) {
  const { stats, loading, error } = useTeacherDashboard(filter, teacherId);
  
  const chartConfig = getChartConfig(filter, stats);
  
  const series = [
    {
      name: "Monthly Viewers",
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

  if (loading) {
    return (
      <div className="w-full p-3 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading audience data...</div>
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
    {/* Audience Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">Total Subscribers</div>
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="text-blue-600" size={20} />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats?.totalStudents || 0}</div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">Total Watch Time</div>
          <div className="p-2 bg-orange-100 rounded-lg">
            <Clock className="text-orange-600" size={20} />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats?.totalWatchTimeHours || 0}h</div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">Teacher Rating</div>
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Star className="text-yellow-600" size={20} />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats?.rating.toFixed(1) || '0.0'} ⭐</div>
      </div>
    </div>

    <div className="mx-auto p-6 bg-white rounded-xl shadow">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Audience Growth
        </h2>
        <p className="text-sm text-gray-600">
          Current filter: <span className="font-medium">{filter}</span>
        </p>
      </div>

      {/* Legend */}
      <div className="flex justify-center sm:justify-end items-center gap-x-4 mb-6">
        <div className="inline-flex items-center">
          <span className="size-2.5 inline-block bg-blue-600 rounded-sm me-2"></span>
          <span className="text-[13px] text-gray-600">Monthly Viewers</span>
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
    </div>
  );
}
