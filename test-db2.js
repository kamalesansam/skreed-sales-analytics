import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: sam } = await supabase.from('samsung_cases').select('series').limit(10);
  console.log("samsung_cases series:", [...new Set(sam.map(d => d.series))]);

  const { data: goo } = await supabase.from('google_cases').select('series').limit(10);
  console.log("google_cases series:", [...new Set(goo.map(d => d.series))]);
}
run();
