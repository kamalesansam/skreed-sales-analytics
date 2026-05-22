"use client";

import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';

if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && /The width\(-?\d+\) and height\(-?\d+\) of chart should be greater than 0/.test(args[0])) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Loader2 } from 'lucide-react';

const LEVEL_NAMES = [
  "Master Category",
  "Device Series",
  "Device Model",
  "Finish",
  "Case Type",
  "Pattern",
  "Color Group",
  "Specific Shade"
];

export default function MasterDrillDownChart({ rawData, historicalData, currentLevel, setCurrentLevel, isFiltered, onBarClickOnly }) {
  const getL1 = (row) => {
    if (!isFiltered) {
      if (['Power Banks', 'AirPods Cases', 'Lanyards', 'Screen Protector Kits'].includes(row.product_type)) {
        return 'Accessories';
      }
    }
    if (row.product_type === 'Power Banks') return 'Powerbanks';
    if (row.product_type === 'AirPods Cases') return 'AirPods Cases';
    if (row.product_type === 'Lanyards') return 'Lanyards';
    if (row.product_type === 'Screen Protector Kits') return 'Screen Protectors';
    if (row.brand === 'Apple') return 'Apple';
    if (row.brand === 'Samsung') return 'Samsung';
    if (row.brand === 'Google') return 'Google Pixel';
    return 'Other';
  };

  const getLevelValue = (row, level) => {
    switch (level) {
      case 0: return getL1(row);
      case 1: return row.series;
      case 2: return row.device_model;
      case 3: return row.finish;
      case 4: return row.case_type;
      case 5: return row.print;
      case 6: return row.color_group;
      case 7: return row.color || row.variant_name;
      default: return null;
    }
  };

  const checkLevelData = (level) => {
    if (!rawData) return false;
    for (const row of rawData) {
      if (getLevelValue(row, level) && (Number(row.quantity) || Number(row.total_sales))) return true;
    }
    return false;
  };

  const { canDrillDown, canDrillUp } = useMemo(() => {
    let down = false;
    let up = false;
    for (let i = currentLevel + 1; i <= 7; i++) {
      if (checkLevelData(i)) { down = true; break; }
    }
    for (let i = currentLevel - 1; i >= 0; i--) {
      if (checkLevelData(i)) { up = true; break; }
    }
    return { canDrillDown: down, canDrillUp: up };
  }, [rawData, currentLevel, isFiltered]);

  const handleDrillDown = () => {
    for (let i = currentLevel + 1; i <= 7; i++) {
      if (checkLevelData(i)) {
        setCurrentLevel(i);
        break;
      }
    }
  };

  const handleDrillUp = () => {
    for (let i = currentLevel - 1; i >= 0; i--) {
      if (checkLevelData(i)) {
        setCurrentLevel(i);
        break;
      }
    }
  };

  const currentData = useMemo(() => {
    if (!rawData) return [];

    const map = new Map();

    const processRow = (row, isSeed) => {
      const val = getLevelValue(row, currentLevel);
      if (!val) return; // Ignore row if it has no data for this specific level
      
      let label = val;
      
      // Disambiguation Logic
      if (currentLevel > 0) {
         const genericValues = ['gloss', 'matte', 'printed', 'solids', 'clear'];
         if (genericValues.includes(String(val).toLowerCase().trim())) {
           const l1 = getL1(row);
           label = `${val} (${l1})`;
         }
      }

      if (!map.has(label)) {
        map.set(label, { name: label, rawValue: val, quantity: 0, revenue: 0 });
      }
      
      if (!isSeed) {
        const qty = Number(row.quantity) || 0;
        const rev = Number(row.total_sales) || 0;
        const entry = map.get(label);
        entry.quantity += qty;
        entry.revenue += rev;
      }
    };

    // Seed the map with all valid labels for the currently selected facets (Ghost Labels)
    if (historicalData) {
      historicalData.forEach(row => processRow(row, true));
    }

    // Populate actual active data
    rawData.forEach(row => processRow(row, false));

    return Array.from(map.values()).sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return a.name.localeCompare(b.name);
    });
  }, [rawData, historicalData, currentLevel, isFiltered]);

  const handleBarInteractiveClick = (data) => {
    if (onBarClickOnly && data && data.rawValue) {
      onBarClickOnly(currentLevel, data.rawValue);
      handleDrillDown();
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-xl text-foreground">
          <p className="font-semibold mb-1">{data.name}</p>
          <p className="text-[#38bdf8]">Items Sold: {data.quantity.toLocaleString()}</p>
          <p className="text-[#E19200]">Revenue: ${data.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      );
    }
    return null;
  };

  if (!rawData) {
    return (
      <Card className="w-full h-[500px] flex flex-col items-center justify-center bg-card border-border">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground font-medium">Loading aggregated data...</p>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-card border-border text-foreground flex flex-col">
      <CardHeader className="flex flex-col space-y-4 pb-2 border-b border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-xl font-bold">
            Aggregated Level: {LEVEL_NAMES[currentLevel]}
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDrillUp} 
              disabled={!canDrillUp}
              className="bg-muted border-border hover:bg-accent hover:text-accent-foreground font-semibold"
            >
              <ArrowUp className="h-4 w-4 mr-2" /> Drill Up
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDrillDown} 
              disabled={!canDrillDown}
              className="bg-muted border-border hover:bg-accent hover:text-accent-foreground font-semibold"
            >
              <ArrowDown className="h-4 w-4 mr-2" /> Drill Down
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-6 min-h-[400px]">
        {currentData.length === 0 ? (
          <div className="w-full h-[400px] flex items-center justify-center text-muted-foreground font-medium">
            No data available for the selected filters at Level: {LEVEL_NAMES[currentLevel]}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400} minWidth={200} minHeight={200}>
            <BarChart data={currentData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} barGap={0} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="var(--muted-foreground)"
                tick={{ fill: 'var(--foreground)', fontWeight: 'bold', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                yAxisId="left"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(128, 128, 128, 0.3)" }} />
              <Bar
                yAxisId="left"
                dataKey="quantity"
                fill="#005A87"
                radius={[4, 4, 0, 0]}
                minPointSize={2}
                onClick={handleBarInteractiveClick}
                cursor="pointer"
              >
                <LabelList dataKey="quantity" position="top" formatter={(val) => val === 0 ? '0' : ''} fill="#a1a1aa" fontSize={10} />
              </Bar>
              <Bar
                yAxisId="right"
                dataKey="revenue"
                fill="#E19200"
                radius={[4, 4, 0, 0]}
                minPointSize={2}
                onClick={handleBarInteractiveClick}
                cursor="pointer"
              >
                <LabelList dataKey="revenue" position="top" formatter={(val) => val === 0 ? '0' : ''} fill="#a1a1aa" fontSize={10} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
