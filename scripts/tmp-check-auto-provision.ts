import { ApitoGraphQLClient } from "../src/graphql-client.ts";

async function check(c: ApitoGraphQLClient, projectId: string) {
  const q = `query {
    getProject {
      id
      name
      per_tenant_separate_database
      auto_provision_tenant_on_signup
      auto_provision_on_providers
      tenant_base_domain
      authentication_settings {
        auto_provision_tenant_on_signup
        auto_provision_on_providers
        tenant_base_domain
        enable_google_auth
      }
    }
  }`;
  try {
    const out = await c.request(q, {}, { projectId });
    console.log("\n===", projectId, "===");
    console.log(JSON.stringify(out.getProject, null, 2));
  } catch (e) {
    console.log(projectId, "ERR", String(e).slice(0, 800));
  }
}

async function main() {
  const c = new ApitoGraphQLClient(
    process.env.APITO_GRAPHQL_ENDPOINT!,
    process.env.APITO_API_KEY!,
  );
  await check(c, "rosna_v2_jpn6o");
  await check(c, "protiva_xtg4d");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
