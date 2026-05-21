"use client";

import React, { useState, useMemo } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  sales: {
    label: "Items Sold",
    color: "hsl(var(--primary))",
  },
};

export default function ColorRadarChart({ data }) {
  const [filters, setFilters] = useState(["phones", "powerbanks", "airpods"]);

  const chartData = useMemo(() => {
    if (!data) return [];
    
    const showPhones = filters.includes("phones");
    const showPowerBanks = filters.includes("powerbanks");
    const showAirPods = filters.includes("airpods");

    const colorMap = {};

    data.forEach(item => {
      let isMatch = false;
      
      const isPhone = ['Apple', 'Samsung', 'Google'].includes(item.brand);
      if (isPhone && showPhones) isMatch = true;
      if (item.product_type === 'Power Banks' && showPowerBanks) isMatch = true;
      if (item.product_type === 'AirPods Cases' && showAirPods) isMatch = true;

      if (!isMatch) return;

      const color = item.color_group || item.color;
      if (!color || color === 'N/A' || color === 'Printed') return;

      if (!colorMap[color]) colorMap[color] = 0;
      colorMap[color] += (Number(item.quantity) || 0);
    });

    return Object.entries(colorMap)
      .map(([color, sales]) => ({ color, sales }))
      .sort((a, b) => b.sales - a.sales);
  }, [data, filters]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-4">
        <CardTitle>Top Selling Colors</CardTitle>
        <CardDescription>
          Filter by category to see color popularity
        </CardDescription>
        <ToggleGroup 
          type="multiple" 
          value={filters} 
          onValueChange={(value) => setFilters(value)}
          className="mt-4 flex-wrap justify-center gap-2"
        >
          <ToggleGroupItem value="phones" aria-label="Toggle Phone Cases" className="text-xs data-[state=on]:hover:text-neutral-400">
            Phone Cases
          </ToggleGroupItem>
          <ToggleGroupItem value="powerbanks" aria-label="Toggle Power Banks" className="text-xs data-[state=on]:hover:text-neutral-400">
            Power Banks
          </ToggleGroupItem>
          <ToggleGroupItem value="airpods" aria-label="Toggle AirPods Cases" className="text-xs data-[state=on]:hover:text-neutral-400">
            AirPods Cases
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[350px]">
          <RadarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarAngleAxis dataKey="color" className="text-xs text-muted-foreground" />
            <PolarGrid className="stroke-border" />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} className="text-xs text-muted-foreground" />
            <Radar
              dataKey="sales"
              fill="var(--color-sales)"
              fillOpacity={0.6}
              stroke="var(--color-sales)"
              strokeWidth={2}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
