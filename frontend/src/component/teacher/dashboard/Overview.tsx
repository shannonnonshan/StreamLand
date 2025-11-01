"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import Image from "next/image";
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface OverviewProps {
  filter: string;
}

export default function Overview({ filter }: OverviewProps) {
  const series = [
    {
      name: "Views",
      data: [1200, 3200, 4500, 3800, 6200, 5400, 7200, 6900, 8200, 7600, 8800, 9400],
    },
    {
      name: "Subscribers",
      data: [400, 800, 1200, 1600, 2000, 2600, 3100, 3500, 4200, 4600, 5100, 6000],
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
   const rows = [
    {
      img: "/logo.png",
      content: "The Sliding Mr. Bones",
      mostViews: "Malcolm Lockyer",
      views: "1961",
    },
    {
      img: "/logo.png",
      content: "Witchy Woman",
      mostViews: "The Eagles",
      views: "1972",
    },
    {
      img: "/logo.png",
      content: "Shining Star",
      mostViews: "Earth, Wind, and Fire",
      views: "1975",
    },
  ];
  return (
    <div className="w-full p-3 text-black">
    <div className="mx-auto p-6 bg-white rounded-xl shadow">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Overview
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
        {/* Header row */}
        <div className="grid grid-cols-12 px-4 py-2 mb-3 text-sm font-semibold text-white border-b">
          <div className="col-span-6">Content</div>
          <div className="col-span-3">Most Views</div>
          <div className="col-span-3">Views</div>
        </div>
        <div className="space-y-4">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-between p-4"
            >
              {/* Content */}
              <div className="flex items-center gap-3 w-1/2">
                <Image src={row.img} alt={row.content} width={80} height={64} className="rounded-lg object-cover" />
                <h3 className="font-semibold text-gray-800">{row.content}</h3>
              </div>

              {/* Most Views */}
              <div className="w-1/4 text-gray-600">{row.mostViews}</div>

              {/* Views */}
              <div className="w-1/4 text-gray-600">{row.views}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
