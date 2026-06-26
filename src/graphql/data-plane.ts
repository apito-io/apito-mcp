import type { ApitoGraphQLClient, GraphQLRequestOptions } from '../graphql-client.js';

const MODEL_DOCUMENT_COUNTS = `
  query ModelDocumentCounts($models: [String!]) {
    modelDocumentCounts(models: $models) {
      model
      count
    }
  }
`;

const LIST_REVISIONS = `
  query ListDocumentRevisions($_id: String!, $model: String) {
    listAllRevisionDataOfADocument(_id: $_id, model: $model) {
      count
      results {
        id
        revision
        created_at
        updated_at
      }
    }
  }
`;

const REARRANGE_FIELD_SERIAL = `
  mutation RearrangeFieldSerial($model_name: String!, $field_name: String!, $serial: Int!) {
    rearrangeSerialOfFieldType(model_name: $model_name, field_name: $field_name, serial: $serial) {
      identifier
      serial
    }
  }
`;

export async function getModelDocumentCounts(
  client: ApitoGraphQLClient,
  models?: string[],
  reqOpts?: GraphQLRequestOptions
): Promise<Array<{ model: string; count: number }>> {
  const variables: Record<string, unknown> = {};
  if (models?.length) {
    variables.models = models;
  }
  const result = await client.request<{
    modelDocumentCounts: Array<{ model: string; count: number }>;
  }>(MODEL_DOCUMENT_COUNTS, variables, reqOpts);
  return result.modelDocumentCounts ?? [];
}

export async function listDocumentRevisions(
  client: ApitoGraphQLClient,
  args: { _id: string; model?: string },
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{
    listAllRevisionDataOfADocument: { count: number; results: unknown[] };
  }>(LIST_REVISIONS, args, reqOpts);
  return result.listAllRevisionDataOfADocument;
}

export async function reorderFields(
  client: ApitoGraphQLClient,
  args: { model_name: string; field_name: string; serial: number },
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{
    rearrangeSerialOfFieldType: { identifier: string; serial: number };
  }>(REARRANGE_FIELD_SERIAL, args, reqOpts);
  return result.rearrangeSerialOfFieldType;
}

/** connect/disconnect via upsertModelData — exposed as helper for MCP list_data alias */
export async function queryDataList(
  client: ApitoGraphQLClient,
  args: {
    model_name: string;
    page?: number;
    limit?: number;
    where?: Record<string, unknown>;
    status?: string;
    search?: string;
    tenant_id?: string;
  }
) {
  const { tenant_id, model_name, ...opts } = args;
  const reqOpts = tenant_id?.trim() ? { tenantId: tenant_id.trim() } : undefined;
  return client.getModelData(model_name, opts, reqOpts);
}
