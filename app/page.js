import { createClient } from "@/utils/supabase/server";
import DashboardClientWrapper from "@/components/DashboardClientWrapper";

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

  return (
    <main className="dark min-h-screen bg-[#1c1c1e] text-neutral-50 p-8">
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg text-red-400 mb-8">
            <p className="font-semibold">Error fetching data</p>
            <p className="text-sm">{error.message}</p>
          </div>
        )}
        <DashboardClientWrapper rawData={rawSales} />
      </div>
    </main>
  );
}
