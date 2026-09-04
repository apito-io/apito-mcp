/**
 * Seed android/ios/web app_release_policy rows after Console publishes the draft.
 *
 * Usage (from apito-mcp):
 *   APITO_GRAPHQL_ENDPOINT=... APITO_API_KEY=... npx tsx scripts/seed-rosna-app-release-policy.ts
 *
 * Project: rosna_v2_jpn6o
 */
import { ApitoGraphQLClient } from "../src/graphql-client.ts";

const PROJECT = "rosna_v2_jpn6o";
const MODEL = "app_release_policy";

const msg = (text: string) => ({ text });

const rows = [
  {
    platform: "android",
    min_version_name: "0.1.0",
    min_build_number: 1,
    force_update: false,
    system_maintenance: false,
    maintenance_hours: 0,
    store_url:
      "https://play.google.com/store/apps/details?id=com.udbhabon.rosna",
    message_en: msg("A new version of Rosna is available."),
    message_bn: msg("রসনার নতুন সংস্করণ পাওয়া যাচ্ছে।"),
  },
  {
    platform: "ios",
    min_version_name: "0.1.0",
    min_build_number: 1,
    force_update: false,
    system_maintenance: false,
    maintenance_hours: 0,
    store_url: "https://apps.apple.com/app/id0000000000",
    message_en: msg("A new version of Rosna is available."),
    message_bn: msg("রসনার নতুন সংস্করণ পাওয়া যাচ্ছে।"),
  },
  {
    platform: "web",
    min_version_name: "0.1.0",
    min_build_number: 1,
    force_update: false,
    system_maintenance: false,
    maintenance_hours: 0,
    store_url: "https://rosna.app",
    message_en: msg("Scheduled maintenance."),
    message_bn: msg("নির্ধারিত রক্ষণাবেক্ষণ।"),
  },
];

async function main() {
  const client = new ApitoGraphQLClient(
    process.env.APITO_GRAPHQL_ENDPOINT!,
    process.env.APITO_API_KEY!,
  );

  const list = await client.request(
    `query($model:String!){getModelData(model:$model,limit:50){data{_id platform}}}`,
    { model: MODEL },
    { projectId: PROJECT },
  );
  const existing = (list?.getModelData?.data ?? []) as Array<{
    _id: string;
    platform?: string;
  }>;
  const byPlatform = new Map(
    existing.map((r) => [String(r.platform || "").toLowerCase(), r._id]),
  );

  for (const row of rows) {
    const id = byPlatform.get(row.platform);
    const mutation = id
      ? `mutation($model:String!,$id:String!,$payload:JSON!){upsertModelData(model:$model,_id:$id,payload:$payload){_id platform}}`
      : `mutation($model:String!,$payload:JSON!){upsertModelData(model:$model,payload:$payload){_id platform}}`;
    const variables: Record<string, unknown> = {
      model: MODEL,
      payload: row,
    };
    if (id) variables.id = id;
    const out = await client.request(mutation, variables, {
      projectId: PROJECT,
    });
    console.log("UPSERT", row.platform, JSON.stringify(out));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
