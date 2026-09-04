import { ApitoGraphQLClient } from "../src/graphql-client.ts";

async function main() {
  const tier = process.argv[2] || "free";
  const c = new ApitoGraphQLClient(
    process.env.APITO_GRAPHQL_ENDPOINT!,
    process.env.APITO_API_KEY!,
  );
  const out = await c.request(
    `mutation($tenant_id:String!,$plan_tier:String){updateTenant(tenant_id:$tenant_id,plan_tier:$plan_tier){id plan_tier}}`,
    { tenant_id: "01KQMVSQPKZDZAP7T4WXQ1JVWV", plan_tier: tier },
    { projectId: "rosna_v2_jpn6o" },
  );
  console.log(JSON.stringify(out.updateTenant));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
