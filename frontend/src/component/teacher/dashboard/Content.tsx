"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface ContentProps {
  filter: string;
}

export default function Content({ filter }: ContentProps) {
  const series = [
    {
      name: "Views",
      data: [1200, 3200, 4500, 3800, 6200, 5400, 7200, 6900, 8200, 7600, 8800, 9400],
    },
    {
      name: "favorites",
      data: [400, 800, 1200, 1600, 2000, 2600, 3100, 3500, 4200, 4600, 5100, 6000],
    },
    {
      name: "comments",
      data: [100, 600, 1000, 1400, 1800, 2400, 3000, 3300, 4000, 4400, 4900, 5000],
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

      {/* Legend */}
      <div className="flex justify-center sm:justify-end items-center gap-x-4 mb-6">
        <div className="inline-flex items-center">
          <span className="size-2.5 inline-block bg-blue-600 rounded-sm me-2"></span>
          <span className="text-[13px] text-gray-600">Views</span>
        </div>
        <div className="inline-flex items-center">
          <span className="size-2.5 inline-block bg-purple-600 rounded-sm me-2"></span>
          <span className="text-[13px] text-gray-600">Favorites</span>
        </div>
        <div className="inline-flex items-center">
          <span className="size-2.5 inline-block bg-green-600 rounded-sm me-2"></span>
          <span className="text-[13px] text-gray-600">Comments</span>
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
