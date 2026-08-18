#!/usr/bin/env node
/**
 * Register (or re-point) the Shopify webhooks that keep the dashboard live.
 *
 *   node scripts/register-webhooks.mjs --url https://your-app.vercel.app
 *   node scripts/register-webhooks.mjs --url https://... --dry-run
 *   node scripts/register-webhooks.mjs --list        # show what is registered now
 *   node scripts/register-webhooks.mjs --delete-all  # remove ours, e.g. before a rebuild
 *
 * Safe to re-run: existing subscriptions for these topics are updated in place
 * rather than duplicated, so you will not end up processing every order twice.
 *
 * Needs SHOPIFY_STORE plus either SHOPIFY_ADMIN_TOKEN (legacy custom app) or
 * SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (Dev Dashboard app). The app also
 * needs the write_webhooks scope (read_orders alone is not enough to register).
 *
 * After running, put the signing secret in your deployment env as
 * SHOPIFY_WEBHOOK_SECRET. For an admin-created custom app that is the app's
 * "API secret key" (Shopify admin -> Apps -> your app -> API credentials).
 */

import { readFileSync } from 'node:fs';
import { shopifyGraphQL } from '../lib/shopify-sync.mjs';

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* rely on the real environment */ }

const store = process.env.SHOPIFY_STORE;
const token = process.env.SHOPIFY_ADMIN_TOKEN; // optional legacy custom-app token
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
if (!store || !(token || (clientId && clientSecret))) {
  console.error('Missing SHOPIFY_STORE, and either SHOPIFY_ADMIN_TOKEN or');
  console.error('SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (see .env.local).');
  process.exit(1);
}
const creds = { store, token, clientId, clientSecret };

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? (args[i + 1] ?? true) : undefined;
};
const DRY_RUN = args.includes('--dry-run');
const LIST_ONLY = args.includes('--list');
const DELETE_ALL = args.includes('--delete-all');
const url = flag('url');

// orders/* all deliver the full order. refunds/create is included because it is the
// event this dashboard most cares about and we would rather not depend on
// orders/updated always firing for it.
const TOPICS = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED', 'REFUNDS_CREATE'];
const PATH = '/api/shopify/webhook';

async function listExisting() {
  // Reads `uri`. The older `endpoint` field and its URL are both deprecated.
  const data = await shopifyGraphQL(
    `query { webhookSubscriptions(first: 100) {
       edges { node { id topic uri apiVersion { handle } } }
     } }`,
    {},
    creds
  );
  return data.webhookSubscriptions.edges.map(e => ({
    id: e.node.id,
    topic: e.node.topic,
    uri: e.node.uri ?? '(non-http endpoint)',
    apiVersion: e.node.apiVersion?.handle ?? '?',
  }));
}

async function main() {
  const existing = await listExisting();

  if (LIST_ONLY) {
    if (!existing.length) console.log('No webhook subscriptions registered.');
    for (const w of existing) console.log(`  ${w.topic.padEnd(18)} -> ${w.uri}  [api ${w.apiVersion}]`);
    return;
  }

  if (DELETE_ALL) {
    const ours = existing.filter(w => w.uri.includes(PATH));
    if (!ours.length) return console.log('Nothing to delete.');
    for (const w of ours) {
      if (DRY_RUN) { console.log(`  would delete ${w.topic}`); continue; }
      await shopifyGraphQL(
        `mutation Del($id: ID!) { webhookSubscriptionDelete(id: $id) {
           deletedWebhookSubscriptionId userErrors { message } } }`,
        { id: w.id }, creds
      );
      console.log(`  deleted ${w.topic}`);
    }
    return;
  }

  if (!url || url === true) {
    console.error('Pass the public base URL, e.g. --url https://your-app.vercel.app');
    console.error('It must be HTTPS and publicly reachable - Shopify will not post to localhost.');
    process.exit(1);
  }
  const uri = `${String(url).replace(/\/$/, '')}${PATH}`;
  console.log(`Registering ${TOPICS.length} topics -> ${uri}${DRY_RUN ? ' (dry run)' : ''}\n`);

  for (const topic of TOPICS) {
    const already = existing.find(w => w.topic === topic && w.uri.includes(PATH));

    if (already && already.uri === uri) {
      console.log(`  ${topic.padEnd(18)} already correct, skipping`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  ${topic.padEnd(18)} would ${already ? 're-point' : 'create'}`);
      continue;
    }

    if (already) {
      const data = await shopifyGraphQL(
        `mutation Upd($id: ID!, $sub: WebhookSubscriptionInput!) {
           webhookSubscriptionUpdate(id: $id, webhookSubscription: $sub) {
             webhookSubscription { id } userErrors { field message } } }`,
        { id: already.id, sub: { uri } }, creds
      );
      const errs = data.webhookSubscriptionUpdate.userErrors;
      if (errs?.length) throw new Error(`${topic}: ${errs.map(e => e.message).join('; ')}`);
      console.log(`  ${topic.padEnd(18)} re-pointed`);
    } else {
      const data = await shopifyGraphQL(
        `mutation Create($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
           webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
             webhookSubscription { id } userErrors { field message } } }`,
        { topic, sub: { uri } }, creds
      );
      const errs = data.webhookSubscriptionCreate.userErrors;
      if (errs?.length) throw new Error(`${topic}: ${errs.map(e => e.message).join('; ')}`);
      console.log(`  ${topic.padEnd(18)} created`);
    }
  }

  console.log('\nDone. Remember SHOPIFY_WEBHOOK_SECRET must be set in the deployment env,');
  console.log('or every delivery will be rejected with a 401.');
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
