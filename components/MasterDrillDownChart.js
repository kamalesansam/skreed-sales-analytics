"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid, LabelList } from 'recharts';

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
import { Loader2, ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const createNode = () => ({ quantity: 0, revenue: 0, children: {} });

const APPLE_MODELS = {
  "iPhone 17 series": ["iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17", "iPhone 17 Air"],
  "iPhone 16 series": ["iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16"],
  "iPhone 15 series": ["iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15"],
  "iPhone 14 series": ["iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14"],
  "iPhone 13 series": ["iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13 Mini", "iPhone 13"],
};

const SAMSUNG_MODELS = {
  "Samsung Galaxy S26 Series": ["Samsung Galaxy S26 Ultra", "Samsung Galaxy S26+", "Samsung Galaxy S26"],
  "Samsung Galaxy S25 Series": ["Samsung Galaxy S25 Ultra", "Samsung Galaxy S25+", "Samsung Galaxy S25"],
  "Samsung Galaxy S24 Series": ["Samsung Galaxy S24 Ultra", "Samsung Galaxy S24+", "Samsung Galaxy S24"],
  "Samsung Galaxy S23 Series": ["Samsung Galaxy S23 Ultra", "Samsung Galaxy S23+", "Samsung Galaxy S23"],
};

const GOOGLE_MODELS = {
  "Google Pixel 10 Series": ["Google Pixel 10 Pro XL", "Google Pixel 10 Pro", "Google Pixel 10"],
  "Google Pixel 8 Series": ["Google Pixel 8 Pro", "Google Pixel 8"],
  "Google Pixel 7 Series": ["Google Pixel 7"],
};

const AIRPODS_MODELS = {
  "AirPods 4 Series": ["AirPods 4"],
  "AirPods 3 Series": ["AirPods 3", "AirPods Pro 3"],
  "AirPods 2 Series": ["AirPods 2", "AirPods Pro 2"]
};

function buildSkeleton(colorGroupMap) {
  const root = createNode();

  const buildShades = (groupName) => {
    const node = createNode();
    (colorGroupMap[groupName] || []).forEach(shade => {
      node.children[shade] = createNode();
    });
    return node;
  };

  const buildColorGroupsWithShades = () => {
    const node = createNode();
    Object.keys(colorGroupMap).forEach(group => {
      node.children[group] = buildShades(group);
    });
    return node;
  };

  const buildPrintedLeaf = () => {
    const node = createNode();
    node.children["Printed"] = createNode();
    return node;
  };

  // Apple Subtree
  const appleNode = createNode();
  Object.entries(APPLE_MODELS).forEach(([series, models]) => {
    appleNode.children[series] = createNode();
    models.forEach(model => {
      appleNode.children[series].children[model] = createNode();
      ["Gloss", "Matte"].forEach(finish => {
        appleNode.children[series].children[model].children[finish] = createNode();
        ["Tough", "MagTough"].forEach(caseType => {
          appleNode.children[series].children[model].children[finish].children[caseType] = createNode();
          appleNode.children[series].children[model].children[finish].children[caseType].children["Solids"] = buildColorGroupsWithShades();
          appleNode.children[series].children[model].children[finish].children[caseType].children["Printed"] = buildPrintedLeaf();
        });
      });
    });
  });
  root.children["Apple"] = appleNode;

  // Samsung / Google Subtree
  const buildSamGooSubtree = (modelsDict) => {
    const node = createNode();
    Object.entries(modelsDict).forEach(([series, models]) => {
      node.children[series] = createNode();
      models.forEach(model => {
        node.children[series].children[model] = createNode();
        ["Gloss", "Matte"].forEach(finish => {
          node.children[series].children[model].children[finish] = createNode();
          node.children[series].children[model].children[finish].children["Solids"] = buildColorGroupsWithShades();
          node.children[series].children[model].children[finish].children["Printed"] = buildPrintedLeaf();
        });
      });
    });
    return node;
  };

  root.children["Samsung"] = buildSamGooSubtree(SAMSUNG_MODELS);
  root.children["Google"] = buildSamGooSubtree(GOOGLE_MODELS);

  // Accessories Subtree
  const accNode = createNode();

  // AirPods
  accNode.children["AirPods Cases"] = createNode();
  Object.entries(AIRPODS_MODELS).forEach(([series, models]) => {
    accNode.children["AirPods Cases"].children[series] = createNode();
    models.forEach(model => {
      accNode.children["AirPods Cases"].children[series].children[model] = createNode();
      accNode.children["AirPods Cases"].children[series].children[model].children["Solids"] = buildColorGroupsWithShades();
      accNode.children["AirPods Cases"].children[series].children[model].children["Printed"] = buildPrintedLeaf();
    });
  });

  // Power Banks
  accNode.children["Power Banks"] = createNode();
  ["Gloss", "Matte"].forEach(finish => {
    accNode.children["Power Banks"].children[finish] = buildColorGroupsWithShades();
  });

  // Lanyards
  accNode.children["Lanyards"] = createNode();
  ["Crossbody", "Wrist Strap"].forEach(type => {
    accNode.children["Lanyards"].children[type] = createNode();
    ["Black", "Beige"].forEach(color => {
      accNode.children["Lanyards"].children[type].children[color] = createNode();
    });
  });

  // Screen Protector Kits
  accNode.children["Screen Protector Kits"] = createNode();
  const buildSPKSubtree = (modelsDict) => {
    const node = createNode();
    Object.entries(modelsDict).forEach(([series, models]) => {
      node.children[series] = createNode();
      models.forEach(model => {
        node.children[series].children[model] = createNode();
      });
    });
    return node;
  };

  // Directly append Apple models under Screen Protector Kits
  Object.entries(APPLE_MODELS).forEach(([series, models]) => {
    accNode.children["Screen Protector Kits"].children[series] = createNode();
    models.forEach(model => {
      accNode.children["Screen Protector Kits"].children[series].children[model] = createNode();
    });
  });

  root.children["Accessories"] = accNode;

  return root;
}

export default function MasterDrillDownChart({ rawData }) {
  const [drillPath, setDrillPath] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skeleton, setSkeleton] = useState(null);
  const [sortConfig, setSortConfig] = useState({ field: 'order_date', direction: 'desc' });

  const handleSort = (field) => {
    if (sortConfig.field === field) {
      setSortConfig({
        field,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      setSortConfig({ field, direction: 'desc' });
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const supabase = createClient();

        const { data: colorData, error: colorErr } = await supabase.from('color_catalog').select('color_group, variant_name');
        if (colorErr) throw colorErr;

        const colorGroupMap = {};
        (colorData || []).forEach(c => {
          if (!c.color_group) return;
          if (!colorGroupMap[c.color_group]) colorGroupMap[c.color_group] = [];
          if (c.variant_name && !colorGroupMap[c.color_group].includes(c.variant_name)) {
            colorGroupMap[c.color_group].push(c.variant_name);
          }
        });

        const rootNode = buildSkeleton(colorGroupMap);

        const paths = [];

        (rawData || []).forEach(row => {
          const qty = Number(row.quantity) || 0;
          const rev = Number(row.total_sales) || 0;
          if (!qty && !rev) return;

          const path = getRowPath(row);
          if (path && path.length > 0) {
            paths.push({ path, qty, rev });
          }
        });

        paths.forEach(({ path, qty, rev }) => {
          let curr = rootNode;
          curr.quantity += qty;
          curr.revenue += rev;
          for (const step of path) {
            if (!step) break;
            const targetKey = Object.keys(curr.children).find(
              key => key.trim().toLowerCase() === step.trim().toLowerCase()
            );
            if (targetKey) {
              curr = curr.children[targetKey];
              curr.quantity += qty;
              curr.revenue += rev;
            } else {
              break;
            }
          }
        });

        setSkeleton(rootNode);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [rawData]);

  const currentData = useMemo(() => {
    if (!skeleton) return [];
    let curr = skeleton;
    for (const step of drillPath) {
      if (curr.children && curr.children[step]) {
        curr = curr.children[step];
      } else {
        return [];
      }
    }
    return Object.entries(curr.children)
      .map(([key, node]) => ({
        name: key,
        quantity: node.quantity,
        revenue: node.revenue,
        hasChildren: Object.keys(node.children).length > 0
      }));
  }, [skeleton, drillPath]);

  const handleBarClick = (data) => {
    if (data.hasChildren) {
      setDrillPath([...drillPath, data.name]);
    }
  };

  const handleBack = () => {
    setDrillPath(drillPath.slice(0, -1));
  };

  const handleReset = () => {
    setDrillPath([]);
  };

  function getRowPath(row) {
    let series = row.series;
    if (series && !series.toLowerCase().endsWith(' series')) {
      series += ' Series';
    }

    if (row.brand === 'Apple') {
      return row.print === 'Printed'
        ? ["Apple", series, row.device_model, row.finish, row.case_type, "Printed", "Printed"]
        : ["Apple", series, row.device_model, row.finish, row.case_type, "Solids", row.color_group, row.variant_name];
    } else if (row.brand === 'Samsung' || row.brand === 'Google') {
      return row.print === 'Printed'
        ? [row.brand, series, row.device_model, row.finish, "Printed", "Printed"]
        : [row.brand, series, row.device_model, row.finish, "Solids", row.color_group, row.variant_name];
    } else if (row.brand === 'Accessories') {
      if (row.product_type === 'Power Banks') {
        return ["Accessories", "Power Banks", row.finish, row.color_group, row.variant_name];
      } else if (row.product_type === 'Lanyards') {
        return ["Accessories", "Lanyards", row.type, row.color];
      } else if (row.product_type === 'Screen Protector Kits') {
        return ["Accessories", "Screen Protector Kits", series, row.device_model];
      } else {
        return row.print === 'Printed'
          ? ["Accessories", "AirPods Cases", series, row.device_model, "Printed", "Printed"]
          : ["Accessories", "AirPods Cases", series, row.device_model, "Solids", row.color_group, row.variant_name];
      }
    }
    return [];
  }

  const filteredRawData = useMemo(() => {
    if (!rawData) return [];
    return rawData.filter(row => {
      const path = getRowPath(row);
      for (let i = 0; i < drillPath.length; i++) {
        if (!path[i] || path[i].toLowerCase() !== drillPath[i].toLowerCase()) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortConfig.field === 'order_date') {
        const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
        const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortConfig.field === 'order_name') {
        const nameA = a.order_name || '';
        const nameB = b.order_name || '';
        return sortConfig.direction === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }
      return 0;
    });
  }, [rawData, drillPath, sortConfig]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-xl text-foreground">
          <p className="font-semibold mb-1">{data.name}</p>
          <p className="text-[#38bdf8]">Items Sold: {data.quantity.toLocaleString()}</p>
          <p className="text-[#E19200]">Revenue: ${data.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          {data.hasChildren && (
            <p className="text-xs text-[#005A87] mt-2 font-medium">Click bar to drill down</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="w-full h-[500px] flex flex-col items-center justify-center bg-card border-border">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground font-medium">Loading hierarchical data...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-[500px] flex flex-col items-center justify-center bg-card border-red-900/50">
        <p className="text-red-400 font-semibold">Error loading chart</p>
        <p className="text-red-300/80 text-sm mt-2">{error}</p>
      </Card>
    );
  }

  const isRoot = drillPath.length === 0;

  return (
    <Card className="w-full bg-card border-border text-foreground flex flex-col">
      <CardHeader className="flex flex-col space-y-4 pb-2 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">
            {isRoot ? "Master Sales Breakdown" : `Drill Down: ${drillPath.join(' > ')}`}
          </CardTitle>
        </div>
        {!isRoot && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBack} className="bg-muted border-border hover:bg-accent hover:text-accent-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back / Drill Up
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} className="bg-muted border-border hover:bg-accent hover:text-accent-foreground">
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 pt-6 min-h-[400px]">
        <ResponsiveContainer width="100%" height={400} minWidth={200} minHeight={200}>
          <BarChart data={currentData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} barGap={0} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#374151"
              tick={{ fill: '#111827', fontWeight: 'bold', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="left"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6" }} />
            <Bar
              yAxisId="left"
              dataKey="quantity"
              fill="#005A87"
              radius={[4, 4, 0, 0]}
              onClick={handleBarClick}
              cursor="pointer"
              minPointSize={2}
            >
              <LabelList dataKey="quantity" position="top" formatter={(val) => val === 0 ? '0' : ''} fill="#a1a1aa" fontSize={10} />
            </Bar>
            <Bar
              yAxisId="right"
              dataKey="revenue"
              fill="#E19200"
              radius={[4, 4, 0, 0]}
              onClick={handleBarClick}
              cursor="pointer"
              minPointSize={2}
            >
              <LabelList dataKey="revenue" position="top" formatter={(val) => val === 0 ? '0' : ''} fill="#a1a1aa" fontSize={10} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="my-6 border-t border-border" />

        <h3 className="text-lg font-semibold text-foreground mb-4">Raw Data</h3>
        <div className="max-h-96 overflow-y-auto border border-border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">
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
                <TableHead className="text-muted-foreground font-medium">
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
                <TableHead className="text-muted-foreground font-medium">Series</TableHead>
                <TableHead className="text-muted-foreground font-medium">Model</TableHead>
                <TableHead className="text-muted-foreground font-medium">Finish</TableHead>
                <TableHead className="text-muted-foreground font-medium">Type</TableHead>
                <TableHead className="text-muted-foreground font-medium">Print</TableHead>
                <TableHead className="text-muted-foreground font-medium">Color Group</TableHead>
                <TableHead className="text-muted-foreground font-medium">Shade</TableHead>
                <TableHead className="text-muted-foreground font-medium text-right">QTY</TableHead>
                <TableHead className="text-muted-foreground font-medium text-right">Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRawData.length === 0 ? (
                <TableRow className="border-b border-border">
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                    No raw data found for this selection.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRawData.map((row, idx) => (
                  <TableRow key={idx} className="border-b border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">
                      {row.order_date
                        ? new Date(row.order_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.order_name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.series || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.device_model || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.finish || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.case_type || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.print || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.color_group || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.variant_name || '-'}</TableCell>
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
  );
}
