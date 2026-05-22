"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, CalendarIcon, User, LogOut } from "lucide-react";
import { BrandRevenueChart, TopModelsChart } from "@/components/DashboardCharts";
import ColorRadarChart from "@/components/ColorRadarChart";
import MasterDrillDownChart from "@/components/MasterDrillDownChart";
import { ThemeToggle } from "@/components/theme-toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { getLiteralDateString, getPastDateString } from '../lib/date-utils';
import { FacetedFilter } from "./FacetedFilter";

export default function DashboardClientWrapper({ rawData, userEmail }) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [router, supabase]);

  useEffect(() => {
    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 5 minutes = 300,000 ms
      timeoutId = setTimeout(() => {
        handleLogout();
      }, 300000);
    };

    resetTimer();

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [handleLogout]);

  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState({ start: '', end: '' });

  const [facets, setFacets] = useState({
    l1: new Set(),
    l2: new Set(),
    l3: new Set(),
    l4: new Set(),
    l5: new Set(),
    l6: new Set(),
    l7: new Set(),
    l8: new Set()
  });

  const handleSelectFacet = (level, value, isOnly, allOptionsForLevel) => {
    setFacets(prev => {
      const newFacets = { ...prev };
      let set = new Set(prev[level]);
      if (isOnly) {
        set.clear();
        set.add(value);
      } else {
        if (set.size === 0 && allOptionsForLevel) {
          set = new Set(allOptionsForLevel);
          set.delete(value);
        } else {
          if (set.has(value)) set.delete(value);
          else set.add(value);
          
          if (allOptionsForLevel && set.size === allOptionsForLevel.length) {
            set.clear();
          }
        }
      }
      newFacets[level] = set;
      return newFacets;
    });
  };

  const getL1 = (row) => {
    if (row.product_type === 'Power Banks') return 'Powerbanks';
    if (row.product_type === 'AirPods Cases') return 'AirPods Cases';
    if (row.product_type === 'Lanyards') return 'Lanyards';
    if (row.product_type === 'Screen Protector Kits') return 'Screen Protectors';
    if (row.brand === 'Apple') return 'Apple';
    if (row.brand === 'Samsung') return 'Samsung';
    if (row.brand === 'Google') return 'Google Pixel';
    return 'Other';
  };

  const dateFilteredData = useMemo(() => {
    if (!rawData) return [];

    return rawData.filter(row => {
      if (dateFilter !== 'all' && row.order_date) {
        const rowLiteral = getLiteralDateString(row.order_date);

        if (dateFilter === '24h') return rowLiteral >= getPastDateString(1);
        if (dateFilter === 'week') return rowLiteral >= getPastDateString(7);
        if (dateFilter === 'month') return rowLiteral >= getPastDateString(30);
        if (dateFilter === 'quarter') return rowLiteral >= getPastDateString(90);
        if (dateFilter === 'year') return rowLiteral >= getPastDateString(365);
        if (dateFilter === 'custom') {
          if (customDate.start && rowLiteral < customDate.start) return false;
          if (customDate.end && rowLiteral > customDate.end) return false;
        }
      }
      return true;
    });
  }, [rawData, dateFilter, customDate.start, customDate.end]);

  const filteredRawData = useMemo(() => {
    return dateFilteredData.filter(row => {
      const l1 = getL1(row);
      if (facets.l1.size > 0 && !facets.l1.has(l1)) return false;
      if (facets.l2.size > 0 && row.series && !facets.l2.has(row.series)) return false;
      if (facets.l3.size > 0 && row.device_model && !facets.l3.has(row.device_model)) return false;
      if (facets.l4.size > 0 && row.finish && !facets.l4.has(row.finish)) return false;
      if (facets.l5.size > 0 && row.case_type && !facets.l5.has(row.case_type)) return false;
      if (facets.l6.size > 0 && row.print && !facets.l6.has(row.print)) return false;
      if (facets.l7.size > 0 && row.color_group && !facets.l7.has(row.color_group)) return false;
      if (facets.l8.size > 0 && row.color && !facets.l8.has(row.color)) return false;
      return true;
    });
  }, [dateFilteredData, facets]);
  
  const facetOptions = useMemo(() => {
    const l1Opts = ['Apple', 'Samsung', 'Google Pixel', 'AirPods Cases', 'Powerbanks', 'Lanyards', 'Screen Protectors'];
    
    const filterUpTo = (levelExclusions = []) => {
      return dateFilteredData.filter(row => {
        const l1 = getL1(row);
        if (!levelExclusions.includes('l1') && facets.l1.size > 0 && !facets.l1.has(l1)) return false;
        if (!levelExclusions.includes('l2') && facets.l2.size > 0 && row.series && !facets.l2.has(row.series)) return false;
        if (!levelExclusions.includes('l3') && facets.l3.size > 0 && row.device_model && !facets.l3.has(row.device_model)) return false;
        if (!levelExclusions.includes('l4') && facets.l4.size > 0 && row.finish && !facets.l4.has(row.finish)) return false;
        if (!levelExclusions.includes('l5') && facets.l5.size > 0 && row.case_type && !facets.l5.has(row.case_type)) return false;
        if (!levelExclusions.includes('l6') && facets.l6.size > 0 && row.print && !facets.l6.has(row.print)) return false;
        if (!levelExclusions.includes('l7') && facets.l7.size > 0 && row.color_group && !facets.l7.has(row.color_group)) return false;
        return true;
      });
    };

    const getOpts = (data, key) => Array.from(new Set(data.map(r => r[key]).filter(Boolean))).sort();

    let l7Opts = ['Black', 'Beige', 'Blue', 'Green', 'Pink', 'Red', 'White', 'Yellow', 'Purple', 'Clear'];
    if (facets.l1.has('Lanyards')) {
      l7Opts = ['Black', 'Beige'];
    }

    return {
      l1: l1Opts,
      l2: getOpts(filterUpTo(['l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8']), 'series'),
      l3: getOpts(filterUpTo(['l3', 'l4', 'l5', 'l6', 'l7', 'l8']), 'device_model'),
      l4: getOpts(filterUpTo(['l4', 'l5', 'l6', 'l7', 'l8']), 'finish'),
      l5: getOpts(filterUpTo(['l5', 'l6', 'l7', 'l8']), 'case_type'),
      l6: getOpts(filterUpTo(['l6', 'l7', 'l8']), 'print'),
      l7: l7Opts,
      l8: getOpts(filterUpTo(['l8']), 'color'),
    };
  }, [dateFilteredData, facets]);

  const l1HasPwrLanyard = facets.l1.has('Powerbanks') || facets.l1.has('Lanyards');
  const l1HasAirLanyardScreen = facets.l1.has('AirPods Cases') || facets.l1.has('Lanyards') || facets.l1.has('Screen Protectors');
  const l1IncludesApple = facets.l1.has('Apple');
  const l1HasLanyardScreen = facets.l1.has('Lanyards') || facets.l1.has('Screen Protectors');
  const l1HasScreen = facets.l1.has('Screen Protectors');
  
  const facetDisabled = {
    l1: false,
    l2: l1HasPwrLanyard,
    l3: l1HasPwrLanyard,
    l4: l1HasAirLanyardScreen,
    l5: !l1IncludesApple,
    l6: l1HasLanyardScreen,
    l7: l1HasScreen,
    l8: l1HasLanyardScreen,
  };

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
          {userEmail && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Signed in as</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:bg-red-500 focus:text-white cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
        <div className="flex flex-wrap gap-2 mb-4">
          <FacetedFilter title="Master Category" options={facetOptions.l1} selectedValues={facets.l1} onSelect={(v, o, allOpts) => handleSelectFacet('l1', v, o, allOpts)} disabled={facetDisabled.l1} />
          <FacetedFilter title="Device Series" options={facetOptions.l2} selectedValues={facets.l2} onSelect={(v, o, allOpts) => handleSelectFacet('l2', v, o, allOpts)} disabled={facetDisabled.l2} />
          <FacetedFilter title="Device Model" options={facetOptions.l3} selectedValues={facets.l3} onSelect={(v, o, allOpts) => handleSelectFacet('l3', v, o, allOpts)} disabled={facetDisabled.l3} />
          <FacetedFilter title="Finish" options={facetOptions.l4} selectedValues={facets.l4} onSelect={(v, o, allOpts) => handleSelectFacet('l4', v, o, allOpts)} disabled={facetDisabled.l4} />
          <FacetedFilter title="Case Type" options={facetOptions.l5} selectedValues={facets.l5} onSelect={(v, o, allOpts) => handleSelectFacet('l5', v, o, allOpts)} disabled={facetDisabled.l5} />
          <FacetedFilter title="Pattern" options={facetOptions.l6} selectedValues={facets.l6} onSelect={(v, o, allOpts) => handleSelectFacet('l6', v, o, allOpts)} disabled={facetDisabled.l6} />
          <FacetedFilter title="Color Group" options={facetOptions.l7} selectedValues={facets.l7} onSelect={(v, o, allOpts) => handleSelectFacet('l7', v, o, allOpts)} disabled={facetDisabled.l7} />
          <FacetedFilter title="Specific Shade" options={facetOptions.l8} selectedValues={facets.l8} onSelect={(v, o, allOpts) => handleSelectFacet('l8', v, o, allOpts)} disabled={facetDisabled.l8} />
        </div>
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
