/**
 * Shared Shopify -> Supabase logic.
 *
 * Both the batch sync (`scripts/sync-shopify.mjs`) and the live webhook receiver
 * (`app/api/shopify/webhook/route.js`) go through this module, so a webhook and a
 * full re-sync can never disagree about what an order means.
 *
 * Everything here is pure or explicitly parameterised - no .env loading, no
 * process.exit, nothing Next-specific - so it runs identically in a serverless
 * function and in a plain node script.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

// Orders below this number are pre-launch/test data and are ignored everywhere,
// including by the dashboard's own filter.
export const MIN_ORDER_NO = 1017;
export const STORE_TZ = 'America/New_York';
export const API_VERSION = '2025-01';

export const orderNo = (name) => parseInt(String(name).match(/\d+/)?.[0] ?? '0', 10);

// ---------------------------------------------------------------- Shopify

/** Everything both callers need off an order. Kept in one place on purpose. */
export const ORDER_FIELDS = `
  name
  createdAt
  cancelledAt
  totalRefundedSet { shopMoney { amount } }
  lineItems(first: 100) {
    edges { node { title sku variantTitle quantity discountedTotalSet { shopMoney { amount } } } }
  }
  refunds {
    createdAt
    note
    totalRefundedSet { shopMoney { amount } }
    refundLineItems(first: 100) {
      edges { node { quantity subtotalSet { shopMoney { amount } } lineItem { sku variantTitle } } }
    }
  }
`;

export async function shopifyGraphQL(query, variables, { store, token, fetchImpl = fetch } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetchImpl(`https://${store}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`Shopify HTTP ${res.status}`);
      await new Promise(r => setTimeout(r, 2 ** attempt * 500));
      continue;
    }
    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${await res.text()}`);

    const body = await res.json();
    if (body.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(body.errors)}`);

    // Back off before the next page if we are near the cost ceiling.
    const left = body.extensions?.cost?.throttleStatus?.currentlyAvailable ?? 1000;
    if (left < 200) await new Promise(r => setTimeout(r, 1000));
    return body.data;
  }
  throw lastError ?? new Error('Shopify request failed after 5 attempts');
}

/** GraphQL edge soup -> the flat shape the rest of this module works with. */
export function normalizeOrder(node) {
  return {
    name: node.name,
    createdAt: node.createdAt,
    cancelledAt: node.cancelledAt,
    totalRefunded: Number(node.totalRefundedSet?.shopMoney?.amount ?? 0),
    lines: (node.lineItems?.edges ?? []).map(e => ({
      title: e.node.title,
      sku: e.node.sku,
      variantTitle: e.node.variantTitle,
      quantity: e.node.quantity,
      amount: Number(e.node.discountedTotalSet?.shopMoney?.amount ?? 0),
    })),
    refunds: (node.refunds ?? []).map(r => ({
      createdAt: r.createdAt,
      note: r.note,
      total: Number(r.totalRefundedSet?.shopMoney?.amount ?? 0),
      lines: (r.refundLineItems?.edges ?? []).map(e => ({
        quantity: e.node.quantity,
        subtotal: Number(e.node.subtotalSet?.shopMoney?.amount ?? 0),
        sku: e.node.lineItem?.sku,
        variantTitle: e.node.lineItem?.variantTitle,
      })),
    })),
  };
}

/** Fetch one order by its numeric Shopify id (what webhooks give us). */
export async function fetchOrderById(id, creds) {
  const gid = String(id).startsWith('gid://') ? String(id) : `gid://shopify/Order/${id}`;
  const data = await shopifyGraphQL(
    `query One($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`,
    { id: gid },
    creds
  );
  return data.order ? normalizeOrder(data.order) : null;
}

/** Page through every order matching a Shopify search query. */
export async function fetchOrders({ searchQuery, creds, onProgress }) {
  const orders = [];
  let cursor = null;
  for (;;) {
    const data = await shopifyGraphQL(
      `query Sync($cursor: String, $q: String) {
         orders(first: 100, after: $cursor, query: $q, sortKey: CREATED_AT) {
           edges { node { ${ORDER_FIELDS} } }
           pageInfo { hasNextPage endCursor }
         }
       }`,
      { cursor, q: searchQuery },
      creds
    );
    for (const edge of data.orders.edges) orders.push(normalizeOrder(edge.node));
    onProgress?.(orders.length);
    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
  }
  return orders;
}

// ---------------------------------------------------------------- helpers

/** Match the existing id convention: order number followed by 7 stable digits. */
export function synthId(orderName, sku, title, variant) {
  const hash = crypto.createHash('sha1').update(`${orderName}|${sku}|${title}|${variant}`).digest('hex');
  const suffix = String(parseInt(hash.slice(0, 10), 16) % 10_000_000).padStart(7, '0');
  return Number(`${orderNo(orderName)}${suffix}`);
}

/** Shopify returns UTC; the table stores store-local ISO strings. Handles DST. */
export function toStoreLocal(utcIso) {
  const d = new Date(utcIso);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: STORE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(d).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMin = Math.round((asUtc - d.getTime()) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${off}`;
}

export function iphoneSeries(title) {
  const m = /iPhone\s*(\d{2})/i.exec(title || '');
  return m ? `iPhone ${m[1]}` : 'Other / Accessories';
}

// ---------------------------------------------------------------- refunds

const RETURN_NOTE = /return|refus|wrong item|wrong shade|wrong colou?r|not received/i;
const CANCEL_NOTE = /cancel/i;
const PARTIAL_RATIO = 0.5;

/**
 * Work out what a refund actually was.
 *
 *   cancelled  - order pulled before fulfilment; never a real sale
 *   returned   - product came back (or customer refunded for goods received)
 *   adjustment - money back but goods kept (shipping credit, goodwill, price fix)
 *
 * Returns null when nothing refund-like happened.
 */
export function classify(order) {
  const notes = order.refunds.map(r => r.note).filter(Boolean).join(' ').trim();
  const isCancelled = Boolean(order.cancelledAt) || CANCEL_NOTE.test(notes);

  const perLine = new Map();
  let sawMoney = false;

  for (const r of order.refunds) {
    // A zero-value refund on a live order is a restock, not money back.
    if (r.total === 0 && !isCancelled) continue;
    if (r.lines.length) {
      sawMoney = true;
      const lineValue = r.lines.reduce((s, l) => s + l.subtotal, 0);
      // Refund much smaller than the goods' value => the customer kept the goods.
      if (lineValue > 0 && r.total > 0 && r.total < lineValue * PARTIAL_RATIO) continue;
      for (const l of r.lines) {
        const key = l.sku || l.variantTitle;
        const slot = perLine.get(key) ?? { qty: 0, amt: 0 };
        slot.qty += l.quantity;
        slot.amt += l.subtotal;
        perLine.set(key, slot);
      }
    } else if (r.total > 0) {
      sawMoney = true;
    }
  }

  const allocatedQty = [...perLine.values()].reduce((s, v) => s + v.qty, 0);
  let status;
  if (isCancelled) status = 'cancelled';
  else if (allocatedQty > 0 || RETURN_NOTE.test(notes)) status = 'returned';
  else if (sawMoney) status = 'adjustment';
  else return null;

  // Whole-order refund with no line detail, but only one line => unambiguous.
  let allocated = allocatedQty > 0;
  if (!allocated && order.lines.length === 1) {
    const only = order.lines[0];
    perLine.set(only.sku || only.variantTitle, {
      qty: status === 'adjustment' ? 0 : only.quantity,
      amt: Math.min(order.totalRefunded, only.amount),
    });
    allocated = status !== 'adjustment';
  } else if (!allocated && order.lines.length > 1) {
    // Spread the value by each line's share; do not invent unit counts.
    const orderValue = order.lines.reduce((s, l) => s + l.amount, 0) || 1;
    for (const l of order.lines) {
      perLine.set(l.sku || l.variantTitle, {
        qty: 0,
        amt: Math.round(order.totalRefunded * (l.amount / orderValue) * 100) / 100,
      });
    }
  }

  // Never attribute more product value than money actually went back.
  const allocatedAmt = [...perLine.values()].reduce((s, v) => s + v.amt, 0);
  if (allocatedAmt > order.totalRefunded && order.totalRefunded > 0) {
    const scale = order.totalRefunded / allocatedAmt;
    for (const v of perLine.values()) v.amt = Math.round(v.amt * scale * 100) / 100;
  }

  const refundDate = order.cancelledAt
    ?? order.refunds.map(r => r.createdAt).sort().at(-1)
    ?? null;

  return { status, notes: notes || null, refundDate, perLine, allocated };
}

/** One normalized order -> the shopify_orders_raw rows it should produce. */
export function shapeOrder(order) {
  const refund = classify(order);
  const orderDate = toStoreLocal(order.createdAt);

  return order.lines.map(line => {
    const hit = refund?.perLine.get(line.sku || line.variantTitle);
    return {
      id: synthId(order.name, line.sku, line.title, line.variantTitle),
      order_date: orderDate,
      order_name: order.name,
      product_title: line.title,
      variant_title: line.variantTitle,
      sku: line.sku || 'BLANK_SKU',
      iphone_series: iphoneSeries(line.title),
      quantity: line.quantity,
      total_sales: line.amount,
      refund_status: refund?.status ?? 'none',
      refunded_quantity: hit?.qty ?? 0,
      refunded_amount: hit?.amt ?? 0,
      refund_date: refund?.refundDate ? toStoreLocal(refund.refundDate) : null,
      refund_note: refund?.notes ?? null,
      refund_allocated: refund ? refund.allocated : true,
    };
  });
}

// ---------------------------------------------------------------- supabase

export function supabaseAdmin(url, serviceKey) {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Upsert in batches. Ids are deterministic, so re-running is always safe. */
export async function upsertRows(rows, supabase, { batchSize = 500, onProgress } = {}) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('shopify_orders_raw').upsert(slice, { onConflict: 'id' });
    if (error) throw new Error(`Supabase upsert failed at row ${i}: ${error.message}`);
    onProgress?.(Math.min(i + batchSize, rows.length), rows.length);
  }
  return rows.length;
}

/**
 * Verify a Shopify webhook signature. Uses a timing-safe comparison so the
 * endpoint cannot be probed byte by byte.
 */
export function verifyWebhook(rawBody, hmacHeader, secret) {
  if (!hmacHeader || !secret) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  let received;
  try {
    received = Buffer.from(hmacHeader, 'base64');
  } catch {
    return false;
  }
  if (received.length !== digest.length) return false;
  return crypto.timingSafeEqual(digest, received);
}
