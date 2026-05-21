import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: air } = await supabase.from('airpods_cases').select('series').limit(10);
  console.log("airpods_cases series:", [...new Set(air.map(d => d.series))]);
}
run();
