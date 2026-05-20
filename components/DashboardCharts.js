"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import React from "react";

if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && /The width\(-?\d+\) and height\(-?\d+\) of chart should be greater than 0/.test(args[0])) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

const COLORS = ["#3b82f6", "#8b5cf6", "#14b8a6", "#ec4899"]; // Blue, Purple, Teal, Pink

export function BrandRevenueChart({ data }) {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  if (!isMounted) return <div style={{ width: '100%', height: '100%', minHeight: 200 }} />;

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            borderColor: "#27272a",
            color: "#fff",
            borderRadius: "8px",
          }}
          itemStyle={{ color: "#fff" }}
          formatter={(value) =>
            `$${Number(value).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopModelsChart({ data }) {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  if (!isMounted) return <div style={{ width: '100%', height: '100%', minHeight: 200 }} />;

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="model"
          stroke="#a1a1aa"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#a1a1aa"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#fff" }}
          itemStyle={{ color: "#fff" }}
          cursor={{ fill: "#27272a", opacity: 0.4 }}
        />
        <Bar dataKey="sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
      </BarChart>
    </ResponsiveContainer>
  );
}


