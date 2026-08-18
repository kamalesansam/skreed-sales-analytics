/**
 * Shopify webhook receiver - keeps shopify_orders_raw live.
 *
 * Subscribed topics (see scripts/register-webhooks.mjs):
 *   orders/create, orders/updated, orders/cancelled, refunds/create
 *
 * Rather than parsing Shopify's REST webhook payload (a different shape from the
 * GraphQL Admin API), this re-fetches the affected order through the exact same
 * code path the batch sync uses. One extra API call per webhook, in exchange for
 * a guarantee that live updates and a full re-sync can never disagree.
 *
 * Env required (set these in Vercel too, not just .env.local):
 *   SHOPIFY_STORE           - e.g. zeosmobile-com.myshopify.com (NOT the storefront domain)
 *   SHOPIFY_CLIENT_ID       - Dev Dashboard app credentials; exchanged for a
 *   SHOPIFY_CLIENT_SECRET     24-hour access token on demand
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   SHOPIFY_WEBHOOK_SECRET  - defaults to SHOPIFY_CLIENT_SECRET, which is what
 *                             Shopify signs webhook bodies with
 *   SHOPIFY_ADMIN_TOKEN     - a legacy custom-app shpat_ token, if you have one;
 *                             skips the client-credentials exchange entirely
 */

import {
  API_VERSION, MIN_ORDER_NO, fetchOrderById, orderNo, shapeOrder, supabaseAdmin,
  upsertRows, verifyWebhook,
} from '@/lib/shopify-sync.mjs';

// node:crypto and the service-role key mean this must not run on the edge.
// (nodejs is the Next 16 default; stated explicitly because it is load-bearing here.)
export const runtime = 'nodejs';
// One Shopify fetch plus one Supabase write. Shopify itself gives up at 5s and
// retries, so this only needs to outlive a slow-but-succeeding round trip.
export const maxDuration = 15;

function ok(body) {
  return Response.json(body, { status: 200 });
}

export async function POST(request) {
  const store = process.env.SHOPIFY_STORE;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const token = process.env.SHOPIFY_ADMIN_TOKEN; // optional legacy custom-app token
  // Shopify signs webhooks with the app's client secret.
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || clientSecret;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const canCallShopify = Boolean(token || (clientId && clientSecret));

  // Read the body as raw text: the HMAC is over the exact bytes Shopify sent,
  // so parsing first and re-serialising would break verification.
  const raw = await request.text();
  const hmac = request.headers.get('x-shopify-hmac-sha256');
  const topic = request.headers.get('x-shopify-topic') ?? 'unknown';
  const shopDomain = request.headers.get('x-shopify-shop-domain');

  if (!secret || !store || !canCallShopify || !supabaseUrl || !serviceKey) {
    console.error('[shopify-webhook] missing env; refusing to process');
    // 500 so Shopify retries once the config is fixed.
    return Response.json({ error: 'not configured' }, { status: 500 });
  }

  if (!verifyWebhook(raw, hmac, secret)) {
    console.warn(`[shopify-webhook] rejected unsigned/invalid request (topic=${topic})`);
    return Response.json({ error: 'invalid signature' }, { status: 401 });
  }

  // Signature proves it came from Shopify; this proves it came from OUR shop.
  if (shopDomain && shopDomain !== store) {
    console.warn(`[shopify-webhook] rejected foreign shop ${shopDomain}`);
    return Response.json({ error: 'unexpected shop' }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Malformed body will never parse, so 200 to stop Shopify retrying forever.
    console.error('[shopify-webhook] unparseable body');
    return ok({ ignored: 'unparseable' });
  }

  // orders/* deliver the order; refunds/create delivers a refund carrying order_id.
  const orderId = payload.admin_graphql_api_id ?? payload.id ?? payload.order_id;
  if (!orderId) return ok({ ignored: 'no order id in payload' });

  try {
    const order = await fetchOrderById(
      topic.startsWith('refunds/') ? payload.order_id : orderId,
      { store, token, clientId, clientSecret }
    );

    if (!order) return ok({ ignored: 'order not found' });

    if (orderNo(order.name) < MIN_ORDER_NO) {
      return ok({ ignored: `below #${MIN_ORDER_NO} cutoff`, order: order.name });
    }

    const rows = shapeOrder(order);
    // Deterministic ids make this idempotent, so Shopify's at-least-once delivery
    // and out-of-order retries are both harmless.
    await upsertRows(rows, supabaseAdmin(supabaseUrl, serviceKey));

    const status = rows[0]?.refund_status ?? 'none';
    console.log(`[shopify-webhook] ${topic} ${order.name}: ${rows.length} rows, status=${status}`);
    return ok({ order: order.name, rows: rows.length, status });
  } catch (err) {
    // 500 makes Shopify retry with backoff, which is what we want for a transient
    // Shopify/Supabase blip.
    console.error(`[shopify-webhook] ${topic} failed:`, err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// A GET is handy for confirming the route is deployed and correctly configured.
// Reports which variables are PRESENT - booleans only, never any values - so a
// misconfigured deployment can be diagnosed without digging through logs.
export async function GET() {
  const store = process.env.SHOPIFY_STORE;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  const present = {
    SHOPIFY_STORE: Boolean(store),
    SHOPIFY_CLIENT_ID: Boolean(process.env.SHOPIFY_CLIENT_ID),
    SHOPIFY_CLIENT_SECRET: Boolean(clientSecret),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  // A legacy shpat_ token makes the client credentials pair unnecessary.
  if (process.env.SHOPIFY_ADMIN_TOKEN) {
    present.SHOPIFY_CLIENT_ID = true;
    present.SHOPIFY_CLIENT_SECRET = Boolean(clientSecret || process.env.SHOPIFY_WEBHOOK_SECRET);
  }
  const missing = Object.entries(present).filter(([, v]) => !v).map(([k]) => k);

  const warnings = [];
  if (store && !store.endsWith('.myshopify.com')) {
    warnings.push(`SHOPIFY_STORE should be the myshopify domain, not "${store}"`);
  }

  return Response.json({
    ok: true,
    configured: missing.length === 0 && warnings.length === 0,
    missing,
    warnings,
    apiVersion: API_VERSION,
    auth: process.env.SHOPIFY_ADMIN_TOKEN ? 'static-token' : 'client-credentials',
  });
}
