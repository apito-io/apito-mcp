/**
 * Build and execute public project GraphQL probes (document + nested relations).
 */

import type { ApitoGraphQLClient, GraphQLRequestOptions } from './graphql-client.js';
import type { PublicGraphqlModelMap, PublicGraphqlRelationMap } from './apito-naming.js';

export function derivePublicGraphqlEndpoint(systemEndpoint: string): string {
  const override =
    typeof process !== 'undefined'
      ? process.env?.APITO_PUBLIC_GRAPHQL_ENDPOINT?.trim()
      : undefined;
  if (override) return override.replace(/\/+$/, '');
  return systemEndpoint
    .replace(/\/system\/graphql\/?$/, '/secured/graphql')
    .replace(/\/+$/, '');
}

function scalarSelection(fields: string[]): string {
  if (fields.length === 0) return '__typename';
  return fields.join('\n      ');
}

function relationSelection(rel: PublicGraphqlRelationMap, peerScalars: string[]): string {
  const inner = `id\n        data {\n          ${scalarSelection(peerScalars)}\n        }`;
  if (rel.relation === 'has_many') {
    return `${rel.selection_key} {\n      ${inner}\n    }`;
  }
  return `${rel.selection_key} {\n      ${inner}\n    }`;
}

export type ProbePublicDocumentArgs = {
  modelMap: PublicGraphqlModelMap;
  id: string;
  /** Selection keys to include; default = all forward relations. */
  relations?: string[];
  /** Peer model → scalar field identifiers for nested data { }. */
  peerDataFields?: Record<string, string[]>;
};

export type ProbeBuildResult = {
  query: string;
  rootField: string;
  selectedRelations: PublicGraphqlRelationMap[];
  skippedRelations: Array<{ selection_key: string; reason: string }>;
};

export function buildProbePublicDocumentQuery(args: {
  modelMap: PublicGraphqlModelMap;
  relations?: string[];
  peerDataFields?: Record<string, string[]>;
}): ProbeBuildResult {
  const { modelMap, relations: requested, peerDataFields = {} } = args;
  const rootField = modelMap.root_operations.get_one;
  const wanted = requested?.map((r) => r.trim()).filter(Boolean);
  const selected: PublicGraphqlRelationMap[] = [];
  const skipped: ProbeBuildResult['skippedRelations'] = [];

  for (const rel of modelMap.relations) {
    if (wanted && wanted.length > 0 && !wanted.includes(rel.selection_key)) {
      continue;
    }
    selected.push(rel);
  }
  if (wanted) {
    for (const key of wanted) {
      if (!modelMap.relations.some((r) => r.selection_key === key)) {
        skipped.push({
          selection_key: key,
          reason: 'absent from schema — not queried',
        });
      }
    }
  }

  const relBlocks = selected
    .map((rel) => {
      const peerScalars =
        peerDataFields[rel.peer_model] ?? peerDataFields[rel.selection_key] ?? [];
      return relationSelection(rel, peerScalars);
    })
    .join('\n    ');

  const query = `query ProbePublicDocument($_id: String!) {
  ${rootField}(_id: $_id) {
    id
    data {
      ${scalarSelection(modelMap.data_fields)}
    }
    meta {
      created_at
      updated_at
      status
    }
    ${relBlocks}
  }
}`.replace(/\n{3,}/g, '\n\n');

  return { query, rootField, selectedRelations: selected, skippedRelations: skipped };
}

export type ProbeRelationReport = {
  selection_key: string;
  status: 'present' | 'null' | 'empty_list' | 'skipped';
  detail?: string;
};

export function summarizeProbeRelations(
  data: unknown,
  rootField: string,
  selected: PublicGraphqlRelationMap[],
  skipped: ProbeBuildResult['skippedRelations']
): ProbeRelationReport[] {
  const reports: ProbeRelationReport[] = skipped.map((s) => ({
    selection_key: s.selection_key,
    status: 'skipped' as const,
    detail: s.reason,
  }));
  const root =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)[rootField]
      : undefined;
  if (root == null || typeof root !== 'object') {
    for (const rel of selected) {
      reports.push({
        selection_key: rel.selection_key,
        status: 'null',
        detail: 'document missing or null',
      });
    }
    return reports;
  }
  const doc = root as Record<string, unknown>;
  for (const rel of selected) {
    const val = doc[rel.selection_key];
    if (val == null) {
      reports.push({ selection_key: rel.selection_key, status: 'null' });
    } else if (Array.isArray(val)) {
      reports.push({
        selection_key: rel.selection_key,
        status: val.length === 0 ? 'empty_list' : 'present',
        detail: val.length === 0 ? undefined : `${val.length} item(s)`,
      });
    } else {
      reports.push({ selection_key: rel.selection_key, status: 'present' });
    }
  }
  return reports;
}

export async function executeProbePublicDocument(
  client: ApitoGraphQLClient,
  args: ProbePublicDocumentArgs & { tenantId?: string; projectId?: string }
): Promise<{
  endpoint: string;
  query: string;
  variables: { _id: string };
  data: unknown;
  errors?: unknown;
  relation_report: ProbeRelationReport[];
}> {
  const built = buildProbePublicDocumentQuery({
    modelMap: args.modelMap,
    relations: args.relations,
    peerDataFields: args.peerDataFields,
  });
  const variables = { _id: args.id };
  const reqOpts: GraphQLRequestOptions = {
    projectId: args.projectId,
    tenantId: args.tenantId,
  };
  try {
    const data = await client.executePublicGraphQL<Record<string, unknown>>(
      built.query,
      variables,
      reqOpts
    );
    return {
      endpoint: client.publicGraphqlEndpoint(),
      query: built.query,
      variables,
      data,
      relation_report: summarizeProbeRelations(
        data,
        built.rootField,
        built.selectedRelations,
        built.skippedRelations
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint =
      /CAPABILITY_DENIED|401|403|unauthorized|forbidden/i.test(message)
        ? ' Public `/secured/graphql` may require a user `ak_` / app JWT + tenant — call `inspect_access_token` to confirm apt_ caps/grants. Do not fall back to flat get_data.'
        : '';
    throw new Error(`${message}${hint}`);
  }
}
