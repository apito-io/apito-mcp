import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export type ToolAccess = 'unscoped' | 'read' | 'write' | 'destructive';

export type ToolAccessMetadata = {
  access: ToolAccess;
  projectRequired: boolean;
  secret: boolean;
};

export type ProjectScopeConfig = {
  allowedProjectIds: ReadonlySet<string>;
  defaultProjectId?: string;
  allowedTenantsByProject?: ReadonlyMap<string, ReadonlySet<string>>;
  ttlMs: number;
};

export type ProjectScopeInput = {
  project_id?: unknown;
  tenant_id?: unknown;
  scope_lease?: unknown;
  confirm_destructive?: unknown;
};

export type ResolvedProjectScope = {
  projectId: string;
  tenantId?: string;
};

type Preparation = {
  projectId: string;
  tenantId?: string;
  expiresAt: number;
};

type Lease = Preparation & {
  createdAt: number;
};

const READ_PREFIXES = ['get_', 'list_', 'search_', 'summarize_'];
const READ_TOOLS = new Set([
  'google_oauth_state',
  'login_app_user',
  'login_app_user_google',
]);
const DESTRUCTIVE_PREFIXES = ['delete_', 'remove_', 'discard_', 'rollback_', 'disconnect_'];
const SECRET_TOOLS = new Set([
  'create_api_key',
  'generate_tenant_token',
  'login_app_user',
  'login_app_user_google',
  'execute_function',
  'list_functions',
  'configure_plugin',
  'get_auth_settings',
  'get_storage_settings',
  'update_auth_settings',
  'update_storage_settings',
]);
const UNSCOPED_TOOLS = new Set([
  'prepare_project_scope',
  'confirm_project_scope',
  'get_project_scope',
  'get_schema_migration_guide',
  'get_saas_model_guide',
  'get_saas_auth_guide',
  'get_field_design_guide',
]);
const SYSTEM_SCOPED_READ_TOOLS = new Set([
  'search_system_logs',
  'get_system_log',
  'get_system_trace',
  'summarize_system_logs',
  'get_log_store_health',
]);

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parsePositiveSeconds(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('APITO_PROJECT_SCOPE_TTL_SECONDS must be a positive number');
  }
  return parsed;
}

function parseTenantAllowlist(raw: string | undefined): ReadonlyMap<string, ReadonlySet<string>> | undefined {
  if (!raw?.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('APITO_ALLOWED_TENANTS_BY_PROJECT must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('APITO_ALLOWED_TENANTS_BY_PROJECT must be a JSON object');
  }
  const result = new Map<string, ReadonlySet<string>>();
  for (const [projectId, tenants] of Object.entries(parsed)) {
    if (!projectId.trim() || !Array.isArray(tenants) || tenants.some((tenant) => typeof tenant !== 'string')) {
      throw new Error('APITO_ALLOWED_TENANTS_BY_PROJECT values must be arrays of tenant IDs');
    }
    result.set(projectId, new Set(tenants.map((tenant) => tenant.trim()).filter(Boolean)));
  }
  return result;
}

export function projectScopeConfigFromEnv(
  env: Record<string, string | undefined>
): ProjectScopeConfig {
  const allowedProjectIds = new Set(
    (env.APITO_ALLOWED_PROJECT_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
  const defaultProjectId = cleanString(env.APITO_DEFAULT_PROJECT_ID);
  if (defaultProjectId && !allowedProjectIds.has(defaultProjectId)) {
    throw new Error('APITO_DEFAULT_PROJECT_ID must be present in APITO_ALLOWED_PROJECT_IDS');
  }
  const allowedTenantsByProject = parseTenantAllowlist(env.APITO_ALLOWED_TENANTS_BY_PROJECT);
  for (const projectId of allowedTenantsByProject?.keys() ?? []) {
    if (!allowedProjectIds.has(projectId)) {
      throw new Error(
        `APITO_ALLOWED_TENANTS_BY_PROJECT contains project "${projectId}" outside APITO_ALLOWED_PROJECT_IDS`
      );
    }
  }
  return {
    allowedProjectIds,
    defaultProjectId,
    allowedTenantsByProject,
    ttlMs: parsePositiveSeconds(env.APITO_PROJECT_SCOPE_TTL_SECONDS, 300) * 1000,
  };
}

export function getToolAccessMetadata(name: string): ToolAccessMetadata {
  if (UNSCOPED_TOOLS.has(name)) {
    return { access: 'unscoped', projectRequired: false, secret: false };
  }
  if (SYSTEM_SCOPED_READ_TOOLS.has(name)) {
    return { access: 'read', projectRequired: false, secret: false };
  }
  const destructive = DESTRUCTIVE_PREFIXES.some((prefix) => name.startsWith(prefix));
  const read = READ_TOOLS.has(name) || READ_PREFIXES.some((prefix) => name.startsWith(prefix));
  return {
    access: destructive ? 'destructive' : read ? 'read' : 'write',
    projectRequired: true,
    secret: SECRET_TOOLS.has(name),
  };
}

export const TOOL_ACCESS_METADATA = new Proxy({} as Record<string, ToolAccessMetadata>, {
  get: (_target, property) =>
    typeof property === 'string' ? getToolAccessMetadata(property) : undefined,
});

export const PROJECT_SCOPE_TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'prepare_project_scope',
    description: 'Prepare an explicit, short-lived project/tenant scope confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Exact allowed Apito project ID.' },
        tenant_id: { type: 'string', description: 'Optional exact allowed tenant ID.' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'confirm_project_scope',
    description: 'Confirm a prepared scope and mint a random, project-bound write lease.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        tenant_id: { type: 'string' },
        preparation_id: { type: 'string' },
      },
      required: ['project_id', 'preparation_id'],
    },
  },
  {
    name: 'get_project_scope',
    description: 'Inspect configured project scope and active leases without revealing lease tokens.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
    },
  },
];

const PROJECT_ID_SCHEMA = {
  type: 'string',
  description: 'Exact project ID. Required unless a configured default is used for a read.',
} as const;
const LEASE_SCHEMA = {
  type: 'string',
  description: 'Short-lived project-bound lease returned by confirm_project_scope.',
} as const;

export function applyProjectScopeSchema<T extends Tool>(tool: T): T {
  const metadata = getToolAccessMetadata(tool.name);
  if (metadata.access === 'unscoped') return tool;
  const schema = tool.inputSchema as {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const properties: Record<string, unknown> = {
    ...(schema.properties ?? {}),
    project_id: PROJECT_ID_SCHEMA,
  };
  const required = new Set(schema.required ?? []);
  if (metadata.access !== 'read') {
    properties.scope_lease = LEASE_SCHEMA;
    required.add('project_id');
    required.add('scope_lease');
  }
  if (metadata.access === 'destructive') {
    properties.confirm_destructive = {
      type: 'boolean',
      const: true,
      description: 'Must be literal true after explicit destructive-operation confirmation.',
    };
    required.add('confirm_destructive');
  }
  return {
    ...tool,
    inputSchema: {
      ...schema,
      properties,
      ...(required.size ? { required: [...required] } : {}),
    },
    annotations: {
      ...(tool.annotations ?? {}),
      readOnlyHint: metadata.access === 'read',
      destructiveHint: metadata.access === 'destructive',
    },
  };
}

export class ProjectScopeManager {
  private readonly preparations = new Map<string, Preparation>();
  private readonly leases = new Map<string, Lease>();

  constructor(
    readonly config: ProjectScopeConfig,
    private readonly now: () => number = Date.now
  ) {}

  private randomToken(): string {
    return crypto.randomUUID();
  }

  private assertAllowed(projectId: string, tenantId?: string): void {
    if (!this.config.allowedProjectIds.has(projectId)) {
      throw new Error(`PROJECT_SCOPE_DENIED: project "${projectId}" is not explicitly allowed`);
    }
    if (tenantId && this.config.allowedTenantsByProject) {
      const allowed = this.config.allowedTenantsByProject.get(projectId);
      if (!allowed?.has(tenantId)) {
        throw new Error(
          `PROJECT_SCOPE_DENIED: tenant "${tenantId}" is not allowed for project "${projectId}"`
        );
      }
    }
  }

  private prune(): void {
    const now = this.now();
    for (const [id, item] of this.preparations) {
      if (item.expiresAt <= now) this.preparations.delete(id);
    }
    for (const [id, item] of this.leases) {
      if (item.expiresAt <= now) this.leases.delete(id);
    }
  }

  prepare(input: ProjectScopeInput): Record<string, unknown> {
    this.prune();
    const projectId = cleanString(input.project_id);
    if (!projectId) throw new Error('prepare_project_scope requires project_id');
    const tenantId = cleanString(input.tenant_id);
    this.assertAllowed(projectId, tenantId);
    const preparationId = this.randomToken();
    const expiresAt = this.now() + this.config.ttlMs;
    this.preparations.set(preparationId, { projectId, tenantId, expiresAt });
    return {
      preparation_id: preparationId,
      project_id: projectId,
      tenant_id: tenantId,
      expires_at: new Date(expiresAt).toISOString(),
    };
  }

  confirm(input: ProjectScopeInput & { preparation_id?: unknown }): Record<string, unknown> {
    this.prune();
    const projectId = cleanString(input.project_id);
    const tenantId = cleanString(input.tenant_id);
    const preparationId = cleanString(input.preparation_id);
    if (!projectId || !preparationId) {
      throw new Error('confirm_project_scope requires explicit project_id and preparation_id');
    }
    const prepared = this.preparations.get(preparationId);
    if (!prepared) throw new Error('PROJECT_SCOPE_PREPARATION_INVALID_OR_EXPIRED');
    if (prepared.projectId !== projectId || prepared.tenantId !== tenantId) {
      throw new Error('PROJECT_SCOPE_PREPARATION_MISMATCH');
    }
    this.preparations.delete(preparationId);
    this.assertAllowed(projectId, tenantId);
    const scopeLease = this.randomToken();
    const createdAt = this.now();
    const expiresAt = createdAt + this.config.ttlMs;
    this.leases.set(scopeLease, { projectId, tenantId, createdAt, expiresAt });
    return {
      scope_lease: scopeLease,
      project_id: projectId,
      tenant_id: tenantId,
      expires_at: new Date(expiresAt).toISOString(),
    };
  }

  resolve(toolName: string, input: ProjectScopeInput): ResolvedProjectScope | undefined {
    this.prune();
    const metadata = getToolAccessMetadata(toolName);
    if (metadata.access === 'unscoped') return undefined;
    const projectId = cleanString(input.project_id) ?? (
      metadata.access === 'read' && metadata.projectRequired
        ? this.config.defaultProjectId
        : undefined
    );
    const tenantId = cleanString(input.tenant_id);
    if (!metadata.projectRequired) {
      if (projectId) {
        this.assertAllowed(projectId, tenantId);
        return { projectId, tenantId };
      }
      return undefined;
    }
    if (!projectId) {
      throw new Error(`${toolName} requires project_id (no APITO_DEFAULT_PROJECT_ID configured)`);
    }
    this.assertAllowed(projectId, tenantId);
    if (metadata.access === 'read') return { projectId, tenantId };
    const scopeLease = cleanString(input.scope_lease);
    if (!scopeLease) throw new Error(`${toolName} requires scope_lease`);
    const lease = this.leases.get(scopeLease);
    if (!lease) throw new Error('PROJECT_SCOPE_LEASE_INVALID_OR_EXPIRED');
    if (lease.projectId !== projectId || lease.tenantId !== tenantId) {
      throw new Error('PROJECT_SCOPE_LEASE_MISMATCH');
    }
    if (metadata.access === 'destructive' && input.confirm_destructive !== true) {
      throw new Error(`${toolName} requires confirm_destructive: true`);
    }
    return { projectId, tenantId };
  }

  inspect(projectId?: unknown): Record<string, unknown> {
    this.prune();
    const requested = cleanString(projectId);
    if (requested) this.assertAllowed(requested);
    const activeLeases = [...this.leases.values()]
      .filter((lease) => !requested || lease.projectId === requested)
      .map((lease) => ({
        project_id: lease.projectId,
        tenant_id: lease.tenantId,
        created_at: new Date(lease.createdAt).toISOString(),
        expires_at: new Date(lease.expiresAt).toISOString(),
      }));
    return {
      allowed_project_ids: [...this.config.allowedProjectIds],
      default_project_id: this.config.defaultProjectId,
      ttl_seconds: this.config.ttlMs / 1000,
      active_leases: activeLeases,
    };
  }
}
