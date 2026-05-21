import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('apple_cases').select('series').limit(10);
  console.log("apple_cases series:", [...new Set(data.map(d => d.series))]);

  const { data: sp } = await supabase.from('screen_protectors').select('iphone_series').limit(10);
  console.log("screen_protectors iphone_series:", [...new Set(sp.map(d => d.iphone_series))]);
}
run();
