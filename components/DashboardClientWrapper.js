"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, CalendarIcon } from "lucide-react";
import { BrandRevenueChart, TopModelsChart } from "@/components/DashboardCharts";
import ColorRadarChart from "@/components/ColorRadarChart";
import MasterDrillDownChart from "@/components/MasterDrillDownChart";
import { ThemeToggle } from "@/components/theme-toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function DashboardClientWrapper({ rawData }) {
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState({ start: '', end: '' });

  const filteredRawData = useMemo(() => {
    if (!rawData) return [];

    return rawData.filter(row => {
      if (dateFilter !== 'all' && row.order_date) {
        const rowDate = new Date(row.order_date).getTime();
        const now = Date.now();

        if (dateFilter === '24h') return (now - rowDate) <= 24 * 60 * 60 * 1000;
        if (dateFilter === 'week') return (now - rowDate) <= 7 * 24 * 60 * 60 * 1000;
        if (dateFilter === 'month') return (now - rowDate) <= 30 * 24 * 60 * 60 * 1000;
        if (dateFilter === 'quarter') return (now - rowDate) <= 90 * 24 * 60 * 60 * 1000;
        if (dateFilter === 'year') return (now - rowDate) <= 365 * 24 * 60 * 60 * 1000;
        if (dateFilter === 'custom') {
          if (customDate.start && new Date(customDate.start).getTime() > rowDate) return false;
          // For end date, we add 24 hours to include the whole day
          if (customDate.end && new Date(customDate.end).getTime() + (24 * 60 * 60 * 1000) < rowDate) return false;
        }
      }
      return true;
    });
  }, [rawData, dateFilter, customDate.start, customDate.end]);

  const totalRevenue = useMemo(() => {
    return filteredRawData.reduce((sum, order) => sum + (Number(order.total_sales) || 0), 0);
  }, [filteredRawData]);

  const totalItemsSold = useMemo(() => {
    return filteredRawData.reduce((sum, order) => sum + (Number(order.quantity) || 0), 0);
  }, [filteredRawData]);

  const brandRevenueData = useMemo(() => {
    const brands = ['Apple', 'Samsung', 'Google', 'Accessories'];
    return brands.map(brand => {
      const brandData = filteredRawData.filter(d => d.brand === brand);
      return {
        name: brand,
        value: brandData.reduce((sum, item) => sum + (Number(item.total_sales) || 0), 0)
      };
    }).filter(b => b.value > 0);
  }, [filteredRawData]);

  const topModelsData = useMemo(() => {
    const getModelName = (item) => {
      if (item.device_model) return item.device_model;
      if (item.product_type === 'Screen Protector Kits') return `${item.iphone_series} Screen Protector`;
      if (item.product_type === 'Power Banks') return `${item.finish} Power Bank`;
      if (item.product_type === 'Lanyards') return `${item.type} Lanyard`;
      return item.product_title || 'Unknown Model';
    };

    const modelMap = {};
    filteredRawData.forEach(item => {
      const modelName = getModelName(item);
      if (!modelMap[modelName]) modelMap[modelName] = 0;
      modelMap[modelName] += (Number(item.quantity) || 0);
    });

    return Object.entries(modelMap)
      .map(([model, sales]) => ({ model, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  }, [filteredRawData]);

  return (
    <div className="space-y-8">
      {/* Date Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Skreed Sales Analytics</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px] bg-card border-border text-sm">
              <SelectValue placeholder="Select Date" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
              <SelectItem value="custom">Custom Date</SelectItem>
            </SelectContent>
          </Select>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-[140px] justify-start text-left font-normal bg-card border-border text-sm ${!customDate.start && "text-muted-foreground"}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate.start ? format(new Date(customDate.start), "MMM d, yyyy") : <span>Start Date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border text-foreground">
                  <Calendar
                    mode="single"
                    selected={customDate.start ? new Date(customDate.start) : undefined}
                    onSelect={(date) => setCustomDate({ ...customDate, start: date ? format(date, "yyyy-MM-dd") : '' })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-[140px] justify-start text-left font-normal bg-card border-border text-sm ${!customDate.end && "text-muted-foreground"}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate.end ? format(new Date(customDate.end), "MMM d, yyyy") : <span>End Date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border text-foreground">
                  <Calendar
                    mode="single"
                    selected={customDate.end ? new Date(customDate.end) : undefined}
                    onSelect={(date) => setCustomDate({ ...customDate, end: date ? format(date, "yyyy-MM-dd") : '' })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totalItemsSold.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-full">
        <MasterDrillDownChart rawData={filteredRawData} />
      </div>

      {/* Render Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full pt-4">
              <BrandRevenueChart data={brandRevenueData} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Selling Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full pt-4">
              <TopModelsChart data={topModelsData} />
            </div>
          </CardContent>
        </Card>

        <ColorRadarChart data={filteredRawData} />
      </div>
    </div>
  );
}
