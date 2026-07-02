import type {
  ApitoConnection,
  ApitoField,
  ApitoModel,
  SchemaChangeExecutionRecord,
  SchemaPreviewSource,
  SchemaVersioningStatus,
} from './types.js';
import type { ApitoGraphQLClient } from './graphql-client.js';

export type SchemaSource = 'live' | 'draft' | 'effective';

type RawModel = {
  name?: string;
  single_page?: boolean;
  is_common_model?: boolean;
  system_generated?: boolean;
  fields?: ApitoField[];
  connections?: ApitoConnection[];
};

type SchemaDiffPayload = {
  model_changes?: Array<{
    model_name?: string;
    added?: boolean;
    removed?: boolean;
    fields_added?: ApitoField[];
    fields_removed?: ApitoField[];
    fields_modified?: Array<{ identifier?: string; label?: string }>;
    connections_added?: ApitoConnection[];
    connections_removed?: ApitoConnection[];
  }>;
};

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') {
    return fallback;
  }
  if (typeof raw === 'object') {
    return raw as T;
  }
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function connectionKey(connection: ApitoConnection): string {
  return `${connection.model ?? ''}|${connection.relation ?? ''}|${connection.type ?? ''}|${connection.known_as ?? ''}`;
}

function isProjectAuthUserModel(m: RawModel): boolean {
  if (!m?.name) {
    return false;
  }
  const ext = m.ext as Record<string, unknown> | undefined;
  if (ext?.is_project_auth_user_model === true) {
    return true;
  }
  return m.name.toLowerCase() === 'users' && !!m.system_generated;
}

function modelsFromSchema(schema: { models?: RawModel[] } | null): RawModel[] {
  return (schema?.models ?? []).filter((m) => {
    if (!m?.name) {
      return false;
    }
    if (isProjectAuthUserModel(m)) {
      return true;
    }
    return !m.system_generated;
  }) as RawModel[];
}

function toApitoModel(raw: RawModel): ApitoModel {
  return {
    name: raw.name!,
    fields: raw.fields ?? [],
    connections: raw.connections ?? [],
    single_page: raw.single_page,
    is_common_model: raw.is_common_model,
  };
}

/** Console-parity merge: draft models + removed live models marked for deletion. */
export function buildEffectiveModels(
  livePreviewJson: string | null | undefined,
  draftPreviewJson: string | null | undefined,
  diffJson?: string | null
): ApitoModel[] {
  const liveSchema = parseJson<{ models?: RawModel[] }>(livePreviewJson, { models: [] });
  const draftSchema = parseJson<{ models?: RawModel[] }>(draftPreviewJson, { models: [] });
  const diff = parseJson<SchemaDiffPayload>(diffJson, {});

  const liveModels = modelsFromSchema(liveSchema);
  const draftModels = modelsFromSchema(draftSchema);
  const liveByName = new Map(liveModels.map((m) => [m.name ?? '', m]));
  const draftByName = new Map(draftModels.map((m) => [m.name ?? '', m]));

  const removedModels = new Map<string, RawModel>();
  for (const change of diff.model_changes ?? []) {
    const modelName = change.model_name ?? '';
    if (!modelName || !change.removed) {
      continue;
    }
    const liveModel = liveByName.get(modelName);
    if (liveModel) {
      removedModels.set(modelName, liveModel);
    }
  }

  const merged: ApitoModel[] = [];
  for (const draftModel of draftModels) {
    if (!draftModel.name) {
      continue;
    }
    const overlay = toApitoModel(draftModel);

    const removedFields =
      diff.model_changes
        ?.find((mc) => mc.model_name === draftModel.name)
        ?.fields_removed?.filter((f) => f?.identifier) ?? [];

    if (removedFields.length > 0) {
      const existingIds = new Set((overlay.fields ?? []).map((f) => f.identifier).filter(Boolean));
      for (const removed of removedFields) {
        if (!removed.identifier || existingIds.has(removed.identifier)) {
          continue;
        }
        overlay.fields = [...(overlay.fields ?? []), removed];
      }
    }

    merged.push(overlay);
  }

  for (const [removedName, liveModel] of removedModels) {
    if (merged.some((m) => m.name === removedName)) {
      continue;
    }
    merged.push(toApitoModel(liveModel));
  }

  // Include unchanged live models not present in draft preview
  for (const liveModel of liveModels) {
    if (!liveModel.name || draftByName.has(liveModel.name)) {
      continue;
    }
    if (removedModels.has(liveModel.name)) {
      continue;
    }
    merged.push(toApitoModel(liveModel));
  }

  merged.sort((a, b) => a.name.localeCompare(b.name));
  return merged;
}

export function detectStagingResponse(raw: unknown): {
  staged: boolean;
  message?: string;
  modelName?: string;
} {
  if (raw == null) {
    return { staged: false };
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        if (obj.staged === true) {
          return {
            staged: true,
            message: typeof obj.message === 'string' ? obj.message : undefined,
            modelName:
              typeof obj.model_name === 'string'
                ? obj.model_name
                : typeof obj.name === 'string'
                  ? obj.name
                  : undefined,
          };
        }
      }
    }
    return { staged: false };
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (obj.staged === true) {
      return {
        staged: true,
        message: typeof obj.message === 'string' ? obj.message : undefined,
        modelName: typeof obj.model_name === 'string' ? obj.model_name : undefined,
      };
    }
  }
  return { staged: false };
}

export function formatUserPublishReminder(status: SchemaVersioningStatus): string {
  if (!status.enabled) {
    return '';
  }
  if (!status.has_draft) {
    return '';
  }
  const id = status.changeset_id ?? '(unknown)';
  const n = status.pending_operations ?? 0;
  return (
    `\n\n---\n**Draft staged** (changeset \`${id}\`, ${n} operation(s)). **Not published.** ` +
    `Open Apito Console → Project Settings → Schema Changes → review the timeline → **Publish manually**. ` +
    `Public API and physical tables update only after publish. MCP does not publish schema changes.`
  );
}

export function buildRelationGraphFromModels(models: ApitoModel[]): Record<string, unknown> {
  const modelNames = models.map((m) => m.name);
  const edges: Array<Record<string, string>> = [];
  for (const model of models) {
    for (const conn of model.connections ?? []) {
      if (!conn.model) {
        continue;
      }
      edges.push({
        from: model.name,
        to: conn.model,
        relation: conn.relation ?? '',
        known_as: conn.known_as ?? '',
      });
    }
  }
  return {
    models: modelNames,
    edges,
    note: 'Built from schema preview; use live/effective source when versioning is enabled.',
  };
}

export class SchemaVersioningContext {
  private statusCache: SchemaVersioningStatus | null = null;

  constructor(private client: ApitoGraphQLClient) { }

  async getStatus(refresh = false): Promise<SchemaVersioningStatus> {
    if (!refresh && this.statusCache) {
      return this.statusCache;
    }
    try {
      this.statusCache = await this.client.getSchemaVersioningStatus();
    } catch {
      this.statusCache = {
        enabled: false,
        active_version: 0,
        has_draft: false,
        pending_operations: 0,
      };
    }
    return this.statusCache;
  }

  async resolveModels(source: SchemaSource = 'effective'): Promise<{
    models: ApitoModel[];
    status: SchemaVersioningStatus;
    sourceUsed: SchemaSource;
  }> {
    const status = await this.getStatus(true);

    if (source === 'live' || !status.enabled) {
      const models = await this.client.getProjectModelsInfo();
      return { models, status, sourceUsed: 'live' };
    }

    if (source === 'draft') {
      if (!status.has_draft) {
        const models = await this.client.getProjectModelsInfo();
        return { models, status, sourceUsed: 'live' };
      }
      const draftJson = await this.client.getSchemaPreview('draft');
      const draftSchema = parseJson<{ models?: RawModel[] }>(draftJson, { models: [] });
      return {
        models: modelsFromSchema(draftSchema).map(toApitoModel),
        status,
        sourceUsed: 'draft',
      };
    }

    // effective
    if (!status.enabled || !status.has_draft) {
      const models = await this.client.getProjectModelsInfo();
      return { models, status, sourceUsed: 'live' };
    }

    const [liveJson, draftJson, diffJson] = await Promise.all([
      this.client.getSchemaPreview('live'),
      this.client.getSchemaPreview('draft'),
      this.client.getSchemaDiff(status.changeset_id),
    ]);

    return {
      models: buildEffectiveModels(liveJson, draftJson, diffJson),
      status,
      sourceUsed: 'effective',
    };
  }

  async getEffectiveSchemaSummary(): Promise<Record<string, unknown>> {
    const status = await this.getStatus(true);
    const { models, sourceUsed } = await this.resolveModels('effective');
    const liveNames = new Set(
      modelsFromSchema(parseJson<{ models?: RawModel[] }>(await this.client.getSchemaPreview('live').catch(() => null), { models: [] })).map(
        (m) => m.name
      )
    );
    const effectiveNames = models.map((m) => m.name);
    const draftOnly = status.has_draft
      ? effectiveNames.filter((n) => !liveNames.has(n))
      : [];

    return {
      versioning: status,
      source_used: sourceUsed,
      live_model_count: liveNames.size,
      effective_model_count: effectiveNames.length,
      draft_only_models: draftOnly,
      effective_models: models,
      publish_reminder: formatUserPublishReminder(status),
    };
  }

  async assertModelPublished(modelName: string): Promise<void> {
    const status = await this.getStatus(true);
    if (!status.enabled || !status.has_draft) {
      return;
    }
    const liveModels = await this.client.getProjectModelsInfo();
    const liveNames = new Set(liveModels.map((m) => m.name.toLowerCase()));
    if (!liveNames.has(modelName.toLowerCase())) {
      throw new Error(
        `Model "${modelName}" exists only in the schema draft (not published). ` +
        `Publish from Apito Console → Project Settings → Schema Changes before using upsert_data/get_data. ` +
        `Use get_effective_schema to inspect the draft.`
      );
    }
  }

  async getChangePlan(changesetId?: string): Promise<SchemaChangeExecutionRecord[]> {
    return this.client.getSchemaChangeExecutionRecords(changesetId);
  }

  async getPreview(source: SchemaPreviewSource, version?: number): Promise<ApitoModel[]> {
    const json = await this.client.getSchemaPreview(source, version);
    return modelsFromSchema(parseJson<{ models?: RawModel[] }>(json, { models: [] })).map(toApitoModel);
  }
}
