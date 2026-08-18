#!/usr/bin/env node
/**
 * Batch-pull orders and refunds from Shopify into Supabase (shopify_orders_raw).
 *
 *   node scripts/sync-shopify.mjs               # orders touched in the last 60 days
 *   node scripts/sync-shopify.mjs --since 2026-01-01
 *   node scripts/sync-shopify.mjs --all         # every order, from the beginning
 *   node scripts/sync-shopify.mjs --dry-run     # show what would change, write nothing
 *
 * The live webhook (app/api/shopify/webhook/route.js) keeps the data current minute
 * to minute. This script is the safety net: run it after any outage, or on a nightly
 * schedule, to repair anything the webhooks missed. Both share lib/shopify-sync.mjs,
 * so they can never disagree about what an order means.
 *
 * Note it filters on updated_at, NOT created_at: a refund can land on an order placed
 * months earlier, and that order's created_at never changes. Filtering on creation
 * date would silently miss exactly the refunds this dashboard exists to show.
 *
 * Why not rebuild from a Shopify sales-report export? Those reports EXCLUDE refunded
 * orders. That is how 22 orders went missing from this dataset. The Admin API used
 * here includes them.
 *
 * Required env (put them in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   - service role, needed to write
 *   SHOPIFY_STORE               - the myshopify domain, e.g. zeosmobile-com.myshopify.com
 *                                 (the storefront domain will NOT work)
 *   SHOPIFY_CLIENT_ID           - Dev Dashboard app credentials
 *   SHOPIFY_CLIENT_SECRET
 *
 * Optional:
 *   SHOPIFY_ADMIN_TOKEN         - a legacy custom-app shpat_ token; if set, it is
 *                                 used directly and the client id/secret ignored
 *   SHOPIFY_API_VERSION         - defaults to a currently-supported version
 *
 * Where the credentials live: Shopify stopped allowing new legacy custom apps on
 * 2026-01-01, so there is no shpat_ token to reveal in the admin any more. Open the
 * Dev Dashboard, pick your app, go to Settings, and copy the Client ID and Client
 * secret. This code exchanges them for a 24-hour token as needed. The app must be
 * installed on the store and have the read_orders scope.
 */

import { readFileSync } from 'node:fs';
import {
  MIN_ORDER_NO, fetchOrders, orderNo, shapeOrder, supabaseAdmin, upsertRows,
} from '../lib/shopify-sync.mjs';

// ---------------------------------------------------------------- env
function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // no .env.local - rely on the real environment
  }
}
loadEnv();

const {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  SHOPIFY_STORE,
  SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET,
  SHOPIFY_ADMIN_TOKEN, // optional: legacy custom-app token, skips the exchange
} = process.env;

// Dev Dashboard apps have no permanent token; client id + secret are exchanged
// for a 24-hour one on demand. A legacy shpat_ token is used directly if present.
const CREDS = {
  store: SHOPIFY_STORE,
  token: SHOPIFY_ADMIN_TOKEN,
  clientId: SHOPIFY_CLIENT_ID,
  clientSecret: SHOPIFY_CLIENT_SECRET,
};

function requireEnv() {
  const needed = { SUPABASE_URL, SERVICE_KEY, SHOPIFY_STORE };
  if (!SHOPIFY_ADMIN_TOKEN) {
    needed.SHOPIFY_CLIENT_ID = SHOPIFY_CLIENT_ID;
    needed.SHOPIFY_CLIENT_SECRET = SHOPIFY_CLIENT_SECRET;
  }
  const missing = Object.entries(needed)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    console.error('See the comment at the top of this file for how to get each one.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SYNC_ALL = args.includes('--all');
const sinceArg = args.indexOf('--since');
const SINCE = SYNC_ALL
  ? null
  : sinceArg !== -1 && args[sinceArg + 1]
    ? args[sinceArg + 1]
    : new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- main
async function main() {
  requireEnv();
  console.log(`Shopify -> Supabase sync${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  store : ${SHOPIFY_STORE}`);
  console.log(`  range : ${SINCE ? `orders updated on/after ${SINCE}` : 'all orders'}`);

  const all = await fetchOrders({
    // updated_at, so late refunds on old orders are picked up.
    searchQuery: SINCE ? `updated_at:>=${SINCE}` : '',
    creds: CREDS,
    onProgress: n => console.log(`  fetched ${n} orders...`),
  });

  const orders = all.filter(o => orderNo(o.name) >= MIN_ORDER_NO);
  console.log(`\n${orders.length} orders in scope (>= #${MIN_ORDER_NO}, ${all.length - orders.length} test orders skipped)\n`);

  const rows = orders.flatMap(shapeOrder);
  const tally = {};
  for (const r of rows) tally[r.refund_status] = (tally[r.refund_status] ?? 0) + 1;

  console.log(`${rows.length} line rows built`);
  console.log('  by status:', tally);

  if (DRY_RUN) {
    console.log('\nDry run - nothing written. Sample row:');
    console.log(JSON.stringify(rows[0], null, 2));
    return;
  }

  const supabase = supabaseAdmin(SUPABASE_URL, SERVICE_KEY);
  await upsertRows(rows, supabase, {
    onProgress: (done, total) => console.log(`  upserted ${done}/${total}`),
  });

  console.log('\nDone.');
}

main().catch(err => {
  console.error('\nSync failed:', err.message);
  process.exit(1);
});
