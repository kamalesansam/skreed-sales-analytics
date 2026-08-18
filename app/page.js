import { createClient } from "@/utils/supabase/server";
import DashboardClientWrapper from "@/components/DashboardClientWrapper";

// Columns every category view now exposes for refund / return tracking.
const REFUND_COLS =
  "refund_status, refunded_quantity, refunded_amount, refund_date, refund_note, refund_allocated";

// Supabase caps un-ranged selects at 1000 rows and fails silently past that.
// Ask for an explicit window so growth never truncates the dashboard without warning.
const MAX_ROWS = 100000;

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const filterOrders = (data) => (data || []).filter(order => {
    if (!order.order_name) return true;
    const match = String(order.order_name).match(/\d+/);
    if (!match) return true;
    return parseInt(match[0], 10) >= 1017;
  });

  const [appleRes, samsungRes, googleRes, airpodsRes, pbRes, lanRes, spRes, colorCatalogRes] = await Promise.all([
    supabase.from('apple_cases').select(`order_date, order_name, total_sales, quantity, device_model, series, finish, case_type, print, color_group, variant_name, ${REFUND_COLS}`).range(0, MAX_ROWS),
    supabase.from('samsung_cases').select(`order_date, order_name, total_sales, quantity, device_model, series, finish, print, color_group, variant_name, ${REFUND_COLS}`).range(0, MAX_ROWS),
    supabase.from('google_cases').select(`order_date, order_name, total_sales, quantity, device_model, series, finish, print, color_group, variant_name, ${REFUND_COLS}`).range(0, MAX_ROWS),
    supabase.from('airpods_cases').select(`order_date, order_name, total_sales, quantity, device_model, series, print, color_group, variant_name, ${REFUND_COLS}`).range(0, MAX_ROWS),
    supabase.from('power_banks').select(`order_date, order_name, total_sales, quantity, finish, color_group, variant_name, ${REFUND_COLS}`).range(0, MAX_ROWS),
    supabase.from('lanyards').select(`order_date, order_name, total_sales, quantity, type, color, ${REFUND_COLS}`).range(0, MAX_ROWS),
    supabase.from('screen_protectors').select(`order_date, order_name, total_sales, quantity, iphone_series, variant_title, ${REFUND_COLS}`).range(0, MAX_ROWS),
    supabase.from('color_catalog').select('variant_name, color_group').range(0, MAX_ROWS)
  ]);

  const error = appleRes.error || samsungRes.error || googleRes.error || airpodsRes.error
    || pbRes.error || lanRes.error || spRes.error || colorCatalogRes.error;

  const appleData = filterOrders(appleRes.data).map(d => {
    const is13 = (d.series && String(d.series).toLowerCase().includes('13')) ||
                 (d.device_model && String(d.device_model).toLowerCase().includes('13'));
    return is13 ? { ...d, finish: 'Matte' } : d;
  });

  const samsungData = filterOrders(samsungRes.data).map(d => {
    const isS23 = (d.series && String(d.series).toLowerCase().includes('s23')) ||
                  (d.device_model && String(d.device_model).toLowerCase().includes('s23'));
    return isS23 ? { ...d, finish: 'Matte' } : d;
  });
  const googleData = filterOrders(googleRes.data);
  const airpodsData = filterOrders(airpodsRes.data);
  const pbData = filterOrders(pbRes.data);
  const lanData = filterOrders(lanRes.data);
  const spData = filterOrders(spRes.data);
  const colorCatalog = colorCatalogRes.data || [];

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
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg text-red-400 mb-8">
            <p className="font-semibold">Error fetching data</p>
            <p className="text-sm">{error.message}</p>
          </div>
        )}
        <DashboardClientWrapper rawData={rawSales} userEmail={user?.email} colorCatalog={colorCatalog} />
      </div>
    </main>
  );
}
