import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing queries...');
  try {
    const [colorData, appleRes, samsungRes, googleRes, airpodsRes] = await Promise.all([
      supabase.from('color_catalog').select('color_group, variant_name').limit(1),
      supabase.from('apple_cases').select('series, device_model, finish, case_type, print, color_group, variant_name, quantity').limit(1),
      supabase.from('samsung_cases').select('series, device_model, finish, print, color_group, variant_name, quantity').limit(1),
      supabase.from('google_cases').select('series, device_model, finish, print, color_group, variant_name, quantity').limit(1),
      supabase.from('airpods_cases').select('series, device_model, print, color_group, variant_name, quantity').limit(1)
    ]);

    if (colorData.error) console.error('color_catalog error:', colorData.error);
    if (appleRes.error) console.error('apple_cases error:', appleRes.error);
    if (samsungRes.error) console.error('samsung_cases error:', samsungRes.error);
    if (googleRes.error) console.error('google_cases error:', googleRes.error);
    if (airpodsRes.error) console.error('airpods_cases error:', airpodsRes.error);

    console.log('Done testing.');
  } catch (err) {
    console.error('Caught error:', err);
  }
}

test();
