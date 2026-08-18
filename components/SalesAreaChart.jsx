"use client";

import React, { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  revenue: {
    label: "Revenue ($)",
    color: "#06b6d4", // Cyan
  },
  sales: {
    label: "Sales Volume",
    color: "#3b82f6", // Blue
  },
  returns: {
    label: "Returned ($)",
    color: "#f59e0b", // Amber
  },
};

export default function SalesAreaChart({ rawData, timeline = 'daily' }) {
  const { processedData, hasReturns } = useMemo(() => {
    if (!rawData || rawData.length === 0) return { processedData: [], hasReturns: false };

    const map = new Map();

    // Bucket a date into the current timeline granularity.
    const keyFor = (dateObj) => {
      if (timeline === 'hourly') {
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}T${String(dateObj.getHours()).padStart(2, '0')}:00`;
      }
      if (timeline === 'weekly') {
        // Group by Sunday of that week
        const d = new Date(dateObj);
        d.setDate(d.getDate() - d.getDay());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (timeline === 'monthly') {
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      }
      return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    };

    const bucket = (key) => {
      if (!map.has(key)) map.set(key, { date: key, revenue: 0, sales: 0, returns: 0 });
      return map.get(key);
    };

    let sawReturn = false;

    rawData.forEach(row => {
      if (row.order_date) {
        const dateObj = new Date(row.order_date);
        if (!isNaN(dateObj.getTime())) {
          const entry = bucket(keyFor(dateObj));
          entry.revenue += Number(row.total_sales) || 0;
          entry.sales += Number(row.quantity) || 0;
        }
      }

      // Returns land on the day the refund was issued, not the day of the sale -
      // a refund weeks later belongs to the week the money actually went back.
      if (row.refund_status === 'returned' && row.refund_date) {
        const refundObj = new Date(row.refund_date);
        const amount = Number(row.refunded_amount) || 0;
        if (!isNaN(refundObj.getTime()) && amount > 0) {
          bucket(keyFor(refundObj)).returns += amount;
          sawReturn = true;
        }
      }
    });

    const result = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

    // To prevent long decimal places in revenue, round it
    return {
      processedData: result.map(item => ({
        ...item,
        revenue: Math.round(item.revenue * 100) / 100,
        returns: Math.round(item.returns * 100) / 100,
      })),
      hasReturns: sawReturn,
    };
  }, [rawData, timeline]);

  if (!processedData || processedData.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-card border border-border rounded-lg text-muted-foreground">
        No sales data available for the selected filters.
      </div>
    );
  }

  return (
    <div className="w-full p-4 bg-card border border-border rounded-lg shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-foreground">Sales Over Time</h2>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: chartConfig.revenue.color }} />
            Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: chartConfig.sales.color }} />
            Units
          </span>
          {hasReturns && (
            <span className="flex items-center gap-1.5" title="Plotted on the date the refund was issued, not the date of the original sale.">
              <span className="h-2 w-2 rounded-full" style={{ background: chartConfig.returns.color }} />
              Returned
            </span>
          )}
        </div>
      </div>
      <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
        <AreaChart data={processedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-sales)" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="var(--color-sales)" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="fillReturns" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-returns)" stopOpacity={0.7}/>
              <stop offset="100%" stopColor="var(--color-returns)" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            stroke="#a1a1aa"
            fontSize={12}
            tickFormatter={(value) => {
              if (timeline === 'hourly') {
                const [datePart, timePart] = value.split('T');
                const [y, m, d] = datePart.split('-');
                const [hh, mm] = timePart.split(':');
                const date = new Date(y, m - 1, d, hh, mm);
                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ' ' + date.toLocaleTimeString("en-US", { hour: '2-digit', minute:'2-digit' });
              } else if (timeline === 'monthly') {
                const [y, m] = value.split('-');
                const date = new Date(y, m - 1, 1);
                return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
              } else if (timeline === 'weekly') {
                const [y, m, d] = value.split('-');
                const startDate = new Date(y, m - 1, d);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
              } else {
                const [y, m, d] = value.split('-');
                const date = new Date(y, m - 1, d);
                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }
            }}
          />
          <YAxis 
            yAxisId="left" 
            tickLine={false} 
            axisLine={false} 
            tickMargin={8} 
            stroke="#a1a1aa"
            fontSize={12}
            tickFormatter={(value) => `$${value}`} 
            domain={[0, dataMax => Math.ceil(dataMax * 1.05)]}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            tickLine={false} 
            axisLine={false} 
            tickMargin={8} 
            stroke="#a1a1aa"
            fontSize={12}
            domain={[0, dataMax => Math.ceil(dataMax * 4)]}
          />
          <ChartTooltip 
            cursor={false} 
            content={
              <ChartTooltipContent 
                indicator="dot" 
                labelFormatter={(value) => {
                  if (timeline === 'hourly') {
                    const [datePart, timePart] = value.split('T');
                    const [y, m, d] = datePart.split('-');
                    const [hh, mm] = timePart.split(':');
                    const date = new Date(y, m - 1, d, hh, mm);
                    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) + ' ' + date.toLocaleTimeString("en-US", { hour: '2-digit', minute:'2-digit' });
                  } else if (timeline === 'monthly') {
                    const [y, m] = value.split('-');
                    const date = new Date(y, m - 1, 1);
                    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                  } else if (timeline === 'weekly') {
                    const [y, m, d] = value.split('-');
                    const startDate = new Date(y, m - 1, d);
                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
                    return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
                  } else {
                    const [y, m, d] = value.split('-');
                    const date = new Date(y, m - 1, d);
                    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                  }
                }}
              />
            } 
          />
          <Area yAxisId="left" type="natural" dataKey="revenue" fill="url(#fillRevenue)" fillOpacity={0.8} stroke="var(--color-revenue)" strokeWidth={2} />
          <Area yAxisId="right" type="natural" dataKey="sales" fill="url(#fillSales)" fillOpacity={0.8} stroke="var(--color-sales)" strokeWidth={2} />
          {hasReturns && (
            <Area yAxisId="left" type="natural" dataKey="returns" fill="url(#fillReturns)" fillOpacity={0.7} stroke="var(--color-returns)" strokeWidth={2} />
          )}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
