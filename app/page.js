import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package } from "lucide-react";
import { BrandRevenueChart, TopModelsChart } from "@/components/DashboardCharts";
import ColorRadarChart from "@/components/ColorRadarChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MasterDrillDownChart from "@/components/MasterDrillDownChart";

export default async function Page() {
  const supabase = await createClient();
  
  // Step 2: Fetch ALL rows from the shopify_orders_raw table for KPIs
  const { data: rawOrdersData, error } = await supabase
    .from('shopify_orders_raw')
    .select('order_name, total_sales, quantity');

  const filterOrders = (data) => (data || []).filter(order => {
    if (!order.order_name) return true;
    const match = String(order.order_name).match(/\d+/);
    if (!match) return true;
    return parseInt(match[0], 10) >= 1017;
  });

  const rawOrders = filterOrders(rawOrdersData);

  let totalRevenue = 0;
  let totalItemsSold = 0;

  if (rawOrders) {
    totalRevenue = rawOrders.reduce((sum, order) => sum + (Number(order.total_sales) || 0), 0);
    totalItemsSold = rawOrders.reduce((sum, order) => sum + (Number(order.quantity) || 0), 0);
  }

  // Step 2: Fetch recent orders
  const { data: recentOrdersData } = await supabase
    .from('shopify_orders_raw')
    .select('order_date, order_name, product_title, total_sales')
    .order('order_date', { ascending: false })
    .limit(30);
  const recentOrders = filterOrders(recentOrdersData).slice(0, 7);

  const [appleRes, samsungRes, googleRes, airpodsRes, pbRes, lanRes, spRes] = await Promise.all([
    supabase.from('apple_cases').select('order_date, order_name, total_sales, quantity, device_model, series, finish, case_type, print, color_group, variant_name'),
    supabase.from('samsung_cases').select('order_date, order_name, total_sales, quantity, device_model, series, finish, print, color_group, variant_name'),
    supabase.from('google_cases').select('order_date, order_name, total_sales, quantity, device_model, series, finish, print, color_group, variant_name'),
    supabase.from('airpods_cases').select('order_date, order_name, total_sales, quantity, device_model, series, print, color_group, variant_name'),
    supabase.from('power_banks').select('order_date, order_name, total_sales, quantity, finish, color_group, variant_name'),
    supabase.from('lanyards').select('order_date, order_name, total_sales, quantity, type, color'),
    supabase.from('screen_protectors').select('order_date, order_name, total_sales, quantity, iphone_series, variant_title')
  ]);

  const appleData = filterOrders(appleRes.data);
  const samsungData = filterOrders(samsungRes.data);
  const googleData = filterOrders(googleRes.data);
  const airpodsData = filterOrders(airpodsRes.data);
  const pbData = filterOrders(pbRes.data);
  const lanData = filterOrders(lanRes.data);
  const spData = filterOrders(spRes.data);

  const accessoriesData = [
    ...(airpodsData.map(d => ({ ...d, product_type: 'AirPods Cases', brand: 'Accessories' }))),
    ...(pbData.map(d => ({ ...d, product_type: 'Power Banks', brand: 'Accessories' }))),
    ...(lanData.map(d => ({ ...d, product_type: 'Lanyards', brand: 'Accessories' }))),
    ...(spData.map(d => ({ ...d, product_type: 'Screen Protector Kits', brand: 'Accessories', series: d.iphone_series, device_model: d.variant_title })))
  ];

  const rawSales = [
    ...(appleData.map(d => ({ ...d, brand: 'Apple' }))),
    ...(samsungData.map(d => ({ ...d, brand: 'Samsung' }))),
    ...(googleData.map(d => ({ ...d, brand: 'Google' }))),
    ...accessoriesData
  ];

  // Aggregating brandRevenueData
  const brandRevenueData = [
    { name: 'Apple', value: appleData.reduce((sum, item) => sum + (Number(item.total_sales) || 0), 0) },
    { name: 'Samsung', value: samsungData.reduce((sum, item) => sum + (Number(item.total_sales) || 0), 0) },
    { name: 'Google', value: googleData.reduce((sum, item) => sum + (Number(item.total_sales) || 0), 0) },
    { name: 'Accessories', value: accessoriesData.reduce((sum, item) => sum + (Number(item.total_sales) || 0), 0) }
  ].filter(b => b.value > 0);

  // Aggregating topModelsData
  const allModels = [...appleData, ...samsungData, ...googleData, ...accessoriesData];
  
  const getModelName = (item) => {
    if (item.device_model) return item.device_model;
    if (item.product_type === 'Screen Protector Kits') return `${item.iphone_series} Screen Protector`;
    if (item.product_type === 'Power Banks') return `${item.finish} Power Bank`;
    if (item.product_type === 'Lanyards') return `${item.type} Lanyard`;
    return item.product_title || 'Unknown Model';
  };

  const modelMap = {};
  allModels.forEach(item => {
    const modelName = getModelName(item);
    if (!modelMap[modelName]) modelMap[modelName] = 0;
    modelMap[modelName] += (Number(item.quantity) || 0);
  });

  const topModelsData = Object.entries(modelMap)
    .map(([model, sales]) => ({ model, sales }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return (
    // We add the 'dark' class here so that shadcn components use their dark CSS variables natively
    <main className="dark min-h-screen bg-zinc-950 text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Step 3: Clean Header */}
        <header className="pb-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Skreed Sales Analytics</h1>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg text-red-400 mb-8">
            <p className="font-semibold">Error fetching data</p>
            <p className="text-sm">{error.message}</p>
          </div>
        )}

        {/* Step 4: Metric Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Items Sold</CardTitle>
              <Package className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {totalItemsSold.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full">
          <MasterDrillDownChart rawData={rawSales} />
        </div>

        {/* Step 6: Render Charts */}
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

          <ColorRadarChart data={rawSales} />
        </div>
      </div>
    </main>
  );
}
