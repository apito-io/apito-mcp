/**
 * Protiva multi-tier SaaS plans (matrix product): Free + Pro + Pro+ + Ultra.
 * Not used for Kisti / other single-Pro products.
 *
 * Usage:
 *   APITO_GRAPHQL_ENDPOINT=... APITO_API_KEY=... \
 *   PROTIVA_PROJECT_ID=protiva_bqyu3 deno run -A scripts/upsert-protiva-plans.ts
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
    projectId: process.env.PROTIVA_PROJECT_ID || process.env.APITO_PROJECT_ID || "protiva_bqyu3",
  };

  const plans = [
    {
      id: "free",
      name: "Free",
      description:
        "Free: student cap 100; no CSV/Excel import-export; no ledger/tabulation; staff/grade/mark writes blocked",
      logic_executions: ["*"],
      quotas: { "max_records.student": 100 },
      api_permissions: { "*": all, staff: ro, grade_config: ro, mark_config: ro },
      prices: price(0),
      provider_products: [],
      currency: "BDT",
      price_monthly: 0,
    },
    {
      id: "paid",
      name: "Pro",
      description:
        "Pro: student cap 500; CSV import/export only (soft UI); no Excel; no ledger/tabulation UI; grade/mark still Pro+",
      logic_executions: ["*"],
      quotas: { "max_records.student": 500 },
      api_permissions: { "*": all, grade_config: ro, mark_config: ro },
      prices: price(299),
      provider_products: playSku("protiva_pro_monthly"),
      currency: "BDT",
      price_monthly: 299,
    },
    {
      id: "paid_plus",
      name: "Pro Plus",
      description:
        "Pro+: student cap 1000; CSV+Excel import/export; ledger + tabulation access; grade/mark/certificates unlocked",
      logic_executions: ["*"],
      quotas: { "max_records.student": 1000 },
      api_permissions: { "*": all },
      prices: price(799),
      provider_products: playSku("protiva_pro_plus_monthly"),
      currency: "BDT",
      price_monthly: 799,
    },
    {
      id: "ultra",
      name: "Ultra",
      description:
        "Ultra: unlimited student quota; full CSV/Excel + ledger/tabulation + all features",
      logic_executions: ["*"],
      quotas: {},
      api_permissions: { "*": all },
      prices: price(1499),
      provider_products: playSku("protiva_ultra_monthly"),
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
