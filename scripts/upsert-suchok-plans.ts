/**
 * Suchok multi-tier SaaS plans (matrix product): Free + Pro + Pro+ + Ultra.
 *
 * Usage:
 *   APITO_GRAPHQL_ENDPOINT=... APITO_API_KEY=... \
 *   SUCHOK_PROJECT_ID=suchok_wb8ed deno run -A scripts/upsert-suchok-plans.ts
 */
import { ApitoGraphQLClient } from "../src/graphql-client.ts";
import { listPlans, upsertPlan } from "../src/graphql/project-admin.ts";

const all = { read: "all", create: "all", update: "all", delete: "all" };
const ro = { read: "all", create: "none", update: "none", delete: "none" };

function price(amount: number) {
  return [{ currency: "BDT", amount, default: true }];
}

function playSku(productId: string) {
  return productId
    ? [{ provider: "google_play", product_id: productId, variant_id: "monthly" }]
    : [];
}

async function main() {
  const client = new ApitoGraphQLClient(
    process.env.APITO_GRAPHQL_ENDPOINT!,
    process.env.APITO_API_KEY!,
  );
  const roOpts = {
    projectId: process.env.SUCHOK_PROJECT_ID || process.env.APITO_PROJECT_ID || "suchok_wb8ed",
  };

  const plans = [
    {
      id: "free",
      name: "Free",
      description:
        "Free: order cap 100; no CSV/Excel; no ledger/reports UI; employee writes blocked",
      logic_executions: ["*"],
      quotas: { "max_records.order": 100 },
      api_permissions: { "*": all, employee: ro },
      prices: price(0),
      provider_products: [],
      currency: "BDT",
      price_monthly: 0,
    },
    {
      id: "paid",
      name: "Pro",
      description:
        "Pro: order cap 500; CSV import/export only (soft UI); no Excel; no ledger/reports UI; employee unlocked",
      logic_executions: ["*"],
      quotas: { "max_records.order": 500 },
      api_permissions: { "*": all },
      prices: price(299),
      provider_products: playSku("suchok_pro_monthly"),
      currency: "BDT",
      price_monthly: 299,
    },
    {
      id: "paid_plus",
      name: "Pro Plus",
      description:
        "Pro+: order cap 1000; CSV+Excel; ledger/reports; full features",
      logic_executions: ["*"],
      quotas: { "max_records.order": 1000 },
      api_permissions: { "*": all },
      prices: price(799),
      provider_products: playSku("suchok_pro_plus_monthly"),
      currency: "BDT",
      price_monthly: 799,
    },
    {
      id: "ultra",
      name: "Ultra",
      description: "Ultra: unlimited order quota; all features",
      logic_executions: ["*"],
      quotas: {},
      api_permissions: { "*": all },
      prices: price(1499),
      provider_products: playSku("suchok_ultra_monthly"),
      currency: "BDT",
      price_monthly: 1499,
    },
  ];

  for (const p of plans) {
    const out = await upsertPlan(client, p, roOpts);
    console.log(
      "UPSERTED",
      out?.id,
      "prices",
      JSON.stringify(out?.prices ?? out?.price_monthly),
      "provider_products",
      JSON.stringify(out?.provider_products ?? out?.play_product_id),
    );
  }
  const listed = await listPlans(client, roOpts);
  for (const p of listed) {
    console.log(
      "LIST",
      p.id,
      "prices=",
      JSON.stringify(p.prices ?? `${p.currency} ${p.price_monthly}`),
      "pp=",
      JSON.stringify(p.provider_products ?? p.play_product_id),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
