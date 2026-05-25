"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, CalendarIcon, User, LogOut, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function DashboardClientWrapper({ rawData, userEmail, colorCatalog = [] }) {
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
  const [currentLevel, setCurrentLevel] = useState(0);

  const [facets, setFacets] = useState({
    l1: new Set(),
    l2: new Set(),
    l3: new Set(),
    l4: new Set(),
    l5: new Set(),
    l6: new Set(),
    l7: new Set(),
    l8: new Set(),
    l9: new Set()
  });

  const handleResetAll = () => {
    setDateFilter("all");
    setCustomDate({ start: '', end: '' });
    setCurrentLevel(0);
    setFacets({
      l1: new Set(),
      l2: new Set(),
      l3: new Set(),
      l4: new Set(),
      l5: new Set(),
      l6: new Set(),
      l7: new Set(),
      l8: new Set(),
      l9: new Set()
    });
  };

  const handleSelectFacet = (level, value, isOnly, allOptionsForLevel) => {
    const levels = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9'];
    const levelIdx = levels.indexOf(level);

    if (levelIdx !== -1) {
      setCurrentLevel(levelIdx);
    }

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

      if (levelIdx !== -1) {
        for (let i = levelIdx + 1; i < levels.length; i++) {
          newFacets[levels[i]] = new Set();
        }
      }

      const tempFilterUpTo = (baseData) => {
        return baseData.filter(row => {
          const l1 = getL1(row);
          const l2 = getL2(row);
          if (newFacets.l1.size > 0 && !newFacets.l1.has(l1)) return false;
          if (newFacets.l2.size > 0 && !newFacets.l2.has(l2)) return false;

          const isLanyard = l2 === 'Lanyards';
          const l3 = isLanyard ? row.type : row.series;
          if (newFacets.l3.size > 0 && (!l3 || !newFacets.l3.has(l3))) return false;

          const l4 = isLanyard ? row.color : row.device_model;
          if (newFacets.l4.size > 0 && (!l4 || !newFacets.l4.has(l4))) return false;

          if (newFacets.l5.size > 0 && (!row.finish || !newFacets.l5.has(row.finish))) return false;
          if (newFacets.l6.size > 0 && (!row.case_type || !newFacets.l6.has(row.case_type))) return false;
          if (newFacets.l7.size > 0 && (!row.print || !newFacets.l7.has(row.print))) return false;
          if (newFacets.l8.size > 0 && (!row.color_group || !newFacets.l8.has(row.color_group))) return false;

          const l9Val = row.variant_name || (isLanyard ? null : row.color);
          if (newFacets.l9.size > 0 && (!l9Val || !newFacets.l9.has(l9Val))) return false;

          return true;
        });
      };

      if (rawData) {
        const resultingData = tempFilterUpTo(rawData);
        if (resultingData.length > 0) {
          let inferredL1 = getL1(resultingData[0]);
          let inferredL2 = getL2(resultingData[0]);
          let allSameL1 = true;
          let allSameL2 = true;

          for (let i = 1; i < resultingData.length; i++) {
            if (getL1(resultingData[i]) !== inferredL1) allSameL1 = false;
            if (getL2(resultingData[i]) !== inferredL2) allSameL2 = false;
            if (!allSameL1 && !allSameL2) break;
          }

          if (allSameL1 && newFacets.l1.size === 0) {
            newFacets.l1 = new Set([inferredL1]);
          }
          if (allSameL2 && newFacets.l2.size === 0) {
            newFacets.l2 = new Set([inferredL2]);
          }
        }
      }

      return newFacets;
    });
  };

  const getL1 = (row) => {
    if (['Apple', 'Samsung', 'Google'].includes(row.brand)) return 'Phone Cases';
    return 'Accessories';
  };

  const getL2 = (row) => {
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

  const getFilterUpTo = useCallback((baseData) => (levelExclusions = []) => {
    return baseData.filter(row => {
      const l1 = getL1(row);
      const l2 = getL2(row);
      if (!levelExclusions.includes('l1') && facets.l1.size > 0 && !facets.l1.has(l1)) return false;
      if (!levelExclusions.includes('l2') && facets.l2.size > 0 && !facets.l2.has(l2)) return false;

      const isLanyard = l2 === 'Lanyards';

      const l3 = isLanyard ? row.type : row.series;
      if (!levelExclusions.includes('l3') && facets.l3.size > 0 && (!l3 || !facets.l3.has(l3))) return false;

      const l4 = isLanyard ? row.color : row.device_model;
      if (!levelExclusions.includes('l4') && facets.l4.size > 0 && (!l4 || !facets.l4.has(l4))) return false;

      if (!levelExclusions.includes('l5') && facets.l5.size > 0 && (!row.finish || !facets.l5.has(row.finish))) return false;
      if (!levelExclusions.includes('l6') && facets.l6.size > 0 && (!row.case_type || !facets.l6.has(row.case_type))) return false;
      if (!levelExclusions.includes('l7') && facets.l7.size > 0 && (!row.print || !facets.l7.has(row.print))) return false;
      if (!levelExclusions.includes('l8') && facets.l8.size > 0 && (!row.color_group || !facets.l8.has(row.color_group))) return false;

      const l9Val = row.variant_name || (isLanyard ? null : row.color);
      if (!levelExclusions.includes('l9') && facets.l9.size > 0 && (!l9Val || !facets.l9.has(l9Val))) return false;

      return true;
    });
  }, [facets]);

  const facetFilteredHistoricalData = useMemo(() => {
    if (!rawData) return [];
    return getFilterUpTo(rawData)();
  }, [rawData, getFilterUpTo]);

  const filteredRawData = useMemo(() => {
    return getFilterUpTo(dateFilteredData)();
  }, [dateFilteredData, getFilterUpTo]);

  const [sortConfig, setSortConfig] = useState({ field: 'order_date', direction: 'desc' });

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = useMemo(() => {
    if (!filteredRawData) return [];
    return [...filteredRawData].sort((a, b) => {
      let aVal = a[sortConfig.field];
      let bVal = b[sortConfig.field];

      if (sortConfig.field === 'total_sales' || sortConfig.field === 'quantity') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRawData, sortConfig]);

  const facetCounts = useMemo(() => {
    const filterUpToDate = getFilterUpTo(dateFilteredData);
    const counts = { l1: {}, l2: {}, l3: {}, l4: {}, l5: {}, l6: {}, l7: {}, l8: {}, l9: {} };

    const countMapped = (data, getVal, level) => {
      data.forEach(r => {
        const val = getVal(r);
        if (val) counts[level][val] = (counts[level][val] || 0) + 1;
      });
    };

    countMapped(filterUpToDate(['l1']), getL1, 'l1');
    countMapped(filterUpToDate(['l2']), getL2, 'l2');
    countMapped(filterUpToDate(['l3']), r => getL2(r) === 'Lanyards' ? r.type : r.series, 'l3');
    countMapped(filterUpToDate(['l4']), r => getL2(r) === 'Lanyards' ? r.color : r.device_model, 'l4');
    countMapped(filterUpToDate(['l5']), r => r.finish, 'l5');
    countMapped(filterUpToDate(['l6']), r => r.case_type, 'l6');
    countMapped(filterUpToDate(['l7']), r => r.print, 'l7');
    countMapped(filterUpToDate(['l8']), r => r.color_group, 'l8');
    countMapped(filterUpToDate(['l9']), r => r.variant_name || (getL2(r) === 'Lanyards' ? null : r.color), 'l9');

    return counts;
  }, [dateFilteredData, getFilterUpTo]);

  const facetOptions = useMemo(() => {
    const filterUpToRaw = getFilterUpTo(rawData);

    // Dynamic L1
    const l1Opts = ['Phone Cases', 'Accessories'];

    // Dynamic L2 based on L1
    let l2Opts = ['Apple', 'Samsung', 'Google Pixel', 'AirPods Cases', 'Powerbanks', 'Lanyards', 'Screen Protectors'];
    if (facets.l1.has('Phone Cases') && !facets.l1.has('Accessories')) {
      l2Opts = ['Apple', 'Samsung', 'Google Pixel'];
    } else if (facets.l1.has('Accessories') && !facets.l1.has('Phone Cases')) {
      l2Opts = ['AirPods Cases', 'Powerbanks', 'Lanyards', 'Screen Protectors'];
    } else if (facets.l1.size > 0) {
      // Both selected, show all
      l2Opts = ['Apple', 'Samsung', 'Google Pixel', 'AirPods Cases', 'Powerbanks', 'Lanyards', 'Screen Protectors'];
    } else {
      // None selected, actually wait, if they are at L0, MasterDrillDownChart doesn't use L2. 
      // If they are at L1, and NO filters applied, show all.
      l2Opts = ['Apple', 'Samsung', 'Google Pixel', 'AirPods Cases', 'Powerbanks', 'Lanyards', 'Screen Protectors'];
    }

    const getOpts = (data, getVal) => Array.from(new Set(data.map(getVal).filter(Boolean))).sort();

    const rawL8Opts = getOpts(filterUpToRaw(['l8', 'l9']), r => r.color_group);
    let l8Opts = rawL8Opts;

    // If the current branch supports Color Groups, force inject all 10 Color Groups
    // We determine this if Phone Cases are explicitly selected or implied.
    const isPhoneCaseView = facets.l1.has('Phone Cases') ||
      facets.l2.has('Apple') ||
      facets.l2.has('Samsung') ||
      facets.l2.has('Google Pixel') ||
      (facets.l1.size === 0 && facets.l2.size === 0);

    if (isPhoneCaseView && colorCatalog && colorCatalog.length > 0) {
      const catalogGroups = Array.from(new Set(colorCatalog.map(c => c.color_group)));
      l8Opts = Array.from(new Set([...rawL8Opts, ...catalogGroups])).sort();
    }

    const rawL9Opts = Array.from(new Set(filterUpToRaw(['l9']).map(r => r.variant_name || (getL2(r) === 'Lanyards' ? null : r.color)).filter(Boolean)));
    let l9Opts = rawL9Opts;

    if (colorCatalog && colorCatalog.length > 0 && facets.l8.size > 0) {
      const catalogShades = colorCatalog
        .filter(c => facets.l8.has(c.color_group))
        .map(c => c.variant_name);
      l9Opts = Array.from(new Set([...rawL9Opts, ...catalogShades])).sort();
    } else {
      l9Opts = Array.from(new Set(l9Opts)).sort();
    }

    return {
      l1: l1Opts,
      l2: l2Opts,
      l3: getOpts(filterUpToRaw(['l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9']), r => getL2(r) === 'Lanyards' ? r.type : r.series),
      l4: getOpts(filterUpToRaw(['l4', 'l5', 'l6', 'l7', 'l8', 'l9']), r => getL2(r) === 'Lanyards' ? r.color : r.device_model),
      l5: getOpts(filterUpToRaw(['l5', 'l6', 'l7', 'l8', 'l9']), r => r.finish),
      l6: getOpts(filterUpToRaw(['l6', 'l7', 'l8', 'l9']), r => r.case_type),
      l7: getOpts(filterUpToRaw(['l7', 'l8', 'l9']), r => r.print),
      l8: l8Opts,
      l9: l9Opts,
    };
  }, [rawData, facets, getFilterUpTo, colorCatalog]);

  const l2HasPwr = facets.l2.has('Powerbanks');
  const l2HasAirLanyardScreen = facets.l2.has('AirPods Cases') || facets.l2.has('Lanyards') || facets.l2.has('Screen Protectors');
  const l2IncludesApple = facets.l2.has('Apple');
  const l2HasLanyardScreen = facets.l2.has('Lanyards') || facets.l2.has('Screen Protectors');
  const l2HasScreen = facets.l2.has('Screen Protectors');
  const l2HasLanyards = facets.l2.has('Lanyards');

  const facetDisabled = {
    l1: false,
    l2: false,
    l3: l2HasPwr,
    l4: l2HasPwr,
    l5: l2HasAirLanyardScreen,
    l6: !l2IncludesApple,
    l7: l2HasLanyardScreen,
    l8: l2HasScreen || l2HasLanyards,
    l9: l2HasScreen || l2HasLanyards,
  };

  const hasActiveFacets = Object.values(facets).some(set => set.size > 0);

  const handleBarClickOnly = (levelIndex, rawValue) => {
    const keys = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9'];
    const facetKey = keys[levelIndex];
    const allOpts = facetOptions[facetKey];
    handleSelectFacet(facetKey, rawValue, true, allOpts);
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 bg-clip-text text-transparent dark:from-slate-100 dark:to-slate-500">Sales Overview</h2>
          <p className="text-muted-foreground mt-1">
            Analyze your sales performance across the entire catalog.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-card border-border shadow-sm">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
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
                <PopoverContent className="w-auto p-0 border-border bg-card">
                  <Calendar
                    mode="single"
                    selected={customDate.start ? new Date(customDate.start) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                        setCustomDate(prev => ({ ...prev, start: localDate.toISOString() }));
                      }
                    }}
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
                <PopoverContent className="w-auto p-0 border-border bg-card">
                  <Calendar
                    mode="single"
                    selected={customDate.end ? new Date(customDate.end) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                        setCustomDate(prev => ({ ...prev, end: localDate.toISOString() }));
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <ThemeToggle />

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
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <FacetedFilter title="Product Category" options={facetOptions.l1} selectedValues={facets.l1} onSelect={(v, o, allOpts) => handleSelectFacet('l1', v, o, allOpts)} disabled={facetDisabled.l1} counts={facetCounts.l1} />
          <FacetedFilter title="Brand / Item Type" options={facetOptions.l2} selectedValues={facets.l2} onSelect={(v, o, allOpts) => handleSelectFacet('l2', v, o, allOpts)} disabled={facetDisabled.l2} counts={facetCounts.l2} />
          <FacetedFilter title="Device Series" options={facetOptions.l3} selectedValues={facets.l3} onSelect={(v, o, allOpts) => handleSelectFacet('l3', v, o, allOpts)} disabled={facetDisabled.l3} counts={facetCounts.l3} />
          <FacetedFilter title="Device Model" options={facetOptions.l4} selectedValues={facets.l4} onSelect={(v, o, allOpts) => handleSelectFacet('l4', v, o, allOpts)} disabled={facetDisabled.l4} counts={facetCounts.l4} />
          <FacetedFilter title="Finish" options={facetOptions.l5} selectedValues={facets.l5} onSelect={(v, o, allOpts) => handleSelectFacet('l5', v, o, allOpts)} disabled={facetDisabled.l5} counts={facetCounts.l5} />
          <FacetedFilter title="Case Type" options={facetOptions.l6} selectedValues={facets.l6} onSelect={(v, o, allOpts) => handleSelectFacet('l6', v, o, allOpts)} disabled={facetDisabled.l6} counts={facetCounts.l6} />
          <FacetedFilter title="Pattern" options={facetOptions.l7} selectedValues={facets.l7} onSelect={(v, o, allOpts) => handleSelectFacet('l7', v, o, allOpts)} disabled={facetDisabled.l7} counts={facetCounts.l7} />
          <FacetedFilter title="Color Group" options={facetOptions.l8} selectedValues={facets.l8} onSelect={(v, o, allOpts) => handleSelectFacet('l8', v, o, allOpts)} disabled={facetDisabled.l8} counts={facetCounts.l8} />
          <FacetedFilter title="Specific Shade" options={facetOptions.l9} selectedValues={facets.l9} onSelect={(v, o, allOpts) => handleSelectFacet('l9', v, o, allOpts)} disabled={facetDisabled.l9} counts={facetCounts.l9} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="h-8 border-dashed ml-auto bg-white text-slate-900 hover:bg-slate-900 hover:text-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-100 dark:hover:text-slate-900 transition-colors"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset All
          </Button>
        </div>
        {(() => {
          const hasActiveFacets = Object.values(facets).some(set => set.size > 0);

          const handleBarClickOnly = (levelIndex, rawValue) => {
            const keys = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9'];
            const facetKey = keys[levelIndex];
            const allOpts = facetOptions[facetKey];
            handleSelectFacet(facetKey, rawValue, true, allOpts);
          };

          return (
            <MasterDrillDownChart
              rawData={filteredRawData}
              historicalData={facetFilteredHistoricalData}
              currentLevel={currentLevel}
              setCurrentLevel={setCurrentLevel}
              isFiltered={hasActiveFacets}
              onBarClickOnly={handleBarClickOnly}
              facetOptions={facetOptions}
            />
          );
        })()}
      </div>

      <Card className="mt-6 mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Raw Data Evidence</CardTitle>
          <div className="text-sm text-muted-foreground">
            Total results: {sortedData.length}
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto border border-border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card z-10">
                    <div
                      className="flex items-center gap-2 cursor-pointer hover:text-accent-foreground select-none"
                      onClick={() => handleSort('order_date')}
                    >
                      Date
                      {sortConfig.field === 'order_date' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                      ) : (
                        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card z-10">
                    <div
                      className="flex items-center gap-2 cursor-pointer hover:text-accent-foreground select-none"
                      onClick={() => handleSort('order_name')}
                    >
                      Order #
                      {sortConfig.field === 'order_name' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                      ) : (
                        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card z-10">Series</TableHead>
                  <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card z-10">Model</TableHead>
                  <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card z-10">Finish</TableHead>
                  <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card z-10">Type</TableHead>
                  <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card z-10">Print</TableHead>
                  <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card z-10">Color Group</TableHead>
                  <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card z-10">Shade</TableHead>
                  <TableHead className="text-muted-foreground font-medium text-right sticky top-0 bg-card z-10">QTY</TableHead>
                  <TableHead className="text-muted-foreground font-medium text-right sticky top-0 bg-card z-10">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow className="border-b border-border">
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                      No raw data found for this selection.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((row, idx) => (
                    <TableRow key={idx} className="border-b border-border hover:bg-muted/50">
                      <TableCell className="text-muted-foreground">
                        {row.order_date ? row.order_date.substring(0, 10) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.order_name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.series || row.type || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.device_model || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.finish || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.case_type || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.print || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.color_group || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.variant_name || row.color || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-right">{row.quantity || 0}</TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        ${Number(row.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
