/**
 * Kisti Free + Pro (paid) SaaS plans with Google Play SKU binding.
 *
 * Usage:
 *   APITO_GRAPHQL_ENDPOINT=... APITO_API_KEY=... \
 *   KISTI_PROJECT_ID=kisti_mvtgi deno run -A scripts/upsert-kisti-plans.ts
 */
import { ApitoGraphQLClient } from "../src/graphql-client.ts";
import { listPlans, upsertPlan } from "../src/graphql/project-admin.ts";

const all = { read: "all", create: "all", update: "all", delete: "all" };

function prices(bdt: number, usd: number) {
  return [
    { currency: "BDT", amount: bdt, default: true },
    { currency: "USD", amount: usd },
  ];
}

function playSku(productId: string, variantId = "kisti-pro-plan") {
  return productId
    ? [{ provider: "google_play", product_id: productId, variant_id: variantId }]
    : [];
}

async function main() {
  const client = new ApitoGraphQLClient(
    process.env.APITO_GRAPHQL_ENDPOINT!,
    process.env.APITO_API_KEY!,
  );
  const opts = {
    projectId:
      process.env.KISTI_PROJECT_ID ||
      process.env.APITO_PROJECT_ID ||
      "kisti_mvtgi",
  };

  const plans = [
    {
      id: "free",
      name: "Free",
      description:
        "Free with ads: 25 customers, 50 active loans, 1 business; Drive backup yes, restore no.",
      logic_executions: ["*"],
      quotas: {
        "max_records.customer": 25,
        "max_records.loan": 50,
      },
      api_permissions: { "*": all },
      prices: prices(0, 0),
      provider_products: [],
      currency: "BDT",
      price_monthly: 0,
    },
    {
      id: "paid",
      name: "Pro",
      description:
        "Pro — ৳200/month · USD $1.99/month. Ad-free; multi-business; Drive restore; advanced reports.",
      logic_executions: ["*"],
      quotas: {},
      api_permissions: { "*": all },
      prices: prices(200, 1.99),
      provider_products: playSku("kisti_pro_user", "kisti-pro-plan"),
      currency: "BDT",
      price_monthly: 200,
    },
  ];

  for (const p of plans) {
    const out = await upsertPlan(client, p, opts);
    console.log(
      "UPSERTED",
      out?.id,
      "prices",
      JSON.stringify(out?.prices ?? out?.price_monthly),
      "provider_products",
      JSON.stringify(out?.provider_products ?? out?.play_product_id),
    );
  }
  const listed = await listPlans(client, opts);
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
