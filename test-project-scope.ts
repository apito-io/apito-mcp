#!/usr/bin/env npx tsx

import { ApitoGraphQLClient } from './src/graphql-client.js';
import { ApitoMCPServer } from './src/index.js';
import {
  ProjectScopeManager,
  applyProjectScopeSchema,
  getToolAccessMetadata,
  projectScopeConfigFromEnv,
} from './src/project-scope.js';
import { PLATFORM_TOOL_DEFINITIONS } from './src/platform-tools.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectThrow(fn: () => unknown, includes: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(includes), `expected "${message}" to include "${includes}"`);
    return;
  }
  throw new Error(`expected error containing "${includes}"`);
}

function testHeaders(): void {
  const client = new ApitoGraphQLClient('https://example.test/system/graphql', 'apt_test', {
    projectId: 'project-a',
    tenantId: 'tenant-a',
    sendTempTenantCookie: true,
  });
  const headers = client.buildHeaders();
  assert(headers['X-Apito-Project-Id'] === 'project-a', 'canonical project header is sent');
  assert(headers['X-Apito-Tenant-ID'] === 'tenant-a', 'canonical tenant header is sent');
  assert(!('X-Project-ID' in headers), 'legacy project header is absent');
  assert(!('Cookie' in headers), 'apt_ requests never send temp tenant cookie');

  const tenantOnly = client.buildHeaders({ tenantId: 'tenant-b' });
  assert(
    tenantOnly['X-Apito-Project-Id'] === 'project-a',
    'tenant-only request override keeps default project header'
  );
  assert(tenantOnly['X-Apito-Tenant-ID'] === 'tenant-b', 'tenant-only override applies');

  const legacy = new ApitoGraphQLClient('https://example.test/system/graphql', 'legacy-token', {
    tenantId: 'tenant-a',
    sendTempTenantCookie: true,
  });
  assert(
    legacy.buildHeaders()['Cookie']?.includes('temp_tenant_id=tenant-a'),
    'non-apt_ may still send temp tenant cookie'
  );
}

function testConfiguration(): void {
  expectThrow(
    () => projectScopeConfigFromEnv({ APITO_DEFAULT_PROJECT_ID: 'project-a' }),
    'must be present'
  );
  const config = projectScopeConfigFromEnv({
    APITO_ALLOWED_PROJECT_IDS: 'project-a,project-b',
    APITO_DEFAULT_PROJECT_ID: 'project-a',
    APITO_ALLOWED_TENANTS_BY_PROJECT: JSON.stringify({
      'project-a': ['tenant-a'],
      'project-b': ['tenant-b'],
    }),
    APITO_PROJECT_SCOPE_TTL_SECONDS: '2',
  });
  assert(config.allowedProjectIds.size === 2, 'project allowlist parses exactly');
  assert(config.defaultProjectId === 'project-a', 'default project parses');
  assert(config.ttlMs === 2000, 'custom TTL parses');

  const defaultTtl = projectScopeConfigFromEnv({
    APITO_ALLOWED_PROJECT_IDS: 'project-a',
  });
  assert(defaultTtl.ttlMs === 1_800_000, 'default TTL is 1800 seconds');

  // Worker binds request project via copy, not mutation of env-derived config.
  const bound = { ...config, defaultProjectId: 'project-b' };
  assert(config.defaultProjectId === 'project-a', 'env-derived scope config stays immutable');
  assert(bound.defaultProjectId === 'project-b', 'request-bound scope overrides default');
}

function testLeasesAndReads(): void {
  let now = 1_000;
  const config = projectScopeConfigFromEnv({
    APITO_ALLOWED_PROJECT_IDS: 'project-a,project-b',
    APITO_DEFAULT_PROJECT_ID: 'project-a',
    APITO_PROJECT_SCOPE_TTL_SECONDS: '1',
  });
  const manager = new ProjectScopeManager(config, () => now);

  const prepared = manager.prepare({ project_id: 'project-a' });
  expectThrow(
    () =>
      manager.confirm({
        project_id: 'project-b',
        preparation_id: prepared.preparation_id,
      }),
    'MISMATCH'
  );
  const confirmed = manager.confirm({
    project_id: 'project-a',
    preparation_id: prepared.preparation_id,
  });
  const lease = String(confirmed.scope_lease);
  assert(confirmed.sticky_lease === true, 'confirm enables sticky lease');

  // Sticky lease allows omit scope_lease for same project/tenant.
  const stickyWrite = manager.resolve('upsert_data', { project_id: 'project-a' });
  assert(stickyWrite?.projectId === 'project-a', 'sticky lease satisfies write without scope_lease');

  const inspected = manager.inspect();
  assert(
    (inspected.sticky_lease as { present?: boolean })?.present === true,
    'inspect shows sticky lease present without token'
  );
  assert(
    !JSON.stringify(inspected).includes(lease),
    'inspect never echoes scope_lease token'
  );

  const a = manager.resolve('upsert_data', {
    project_id: 'project-a',
    scope_lease: lease,
  });
  assert(a?.projectId === 'project-a', 'write lease resolves its project');
  expectThrow(
    () =>
      manager.resolve('upsert_data', {
        project_id: 'project-b',
        scope_lease: lease,
      }),
    'MISMATCH'
  );
  expectThrow(
    () =>
      manager.resolve('delete_data', {
        project_id: 'project-a',
        scope_lease: lease,
      }),
    'confirm_destructive'
  );
  const destructive = manager.resolve('delete_data', {
    project_id: 'project-a',
    scope_lease: lease,
    confirm_destructive: true,
  });
  assert(destructive?.projectId === 'project-a', 'destructive confirmation resolves');

  const readA = manager.resolve('get_data', { project_id: 'project-a' });
  assert(readA?.projectId === 'project-a', 'first read stays in project A');
  assert(
    manager.resolve('get_data', {})?.projectId === 'project-a',
    'read uses sticky default from last scoped read (or env)'
  );
  const readB = manager.resolve('get_data', { project_id: 'project-b' });
  assert(readB?.projectId === 'project-b', 'second read independently scopes project B');
  assert(
    manager.resolve('get_data', {})?.projectId === 'project-b',
    'sticky default follows last successful scoped project'
  );

  now += 1_001;
  expectThrow(
    () =>
      manager.resolve('upsert_data', {
        project_id: 'project-a',
        scope_lease: lease,
      }),
    'INVALID_OR_EXPIRED'
  );
  expectThrow(() => manager.resolve('get_data', { project_id: 'project-c' }), 'DENIED');
}

function testToolSchemasAndMetadata(): void {
  const write = PLATFORM_TOOL_DEFINITIONS.find((tool) => tool.name === 'upsert_function');
  const read = PLATFORM_TOOL_DEFINITIONS.find((tool) => tool.name === 'list_functions');
  const destructive = PLATFORM_TOOL_DEFINITIONS.find((tool) => tool.name === 'delete_function');
  assert(write && read && destructive, 'representative tools exist');
  const writeSchema = applyProjectScopeSchema(write).inputSchema;
  const readSchema = applyProjectScopeSchema(read).inputSchema;
  const destructiveSchema = applyProjectScopeSchema(destructive).inputSchema;
  assert(writeSchema.properties?.project_id, 'write exposes project_id');
  assert(writeSchema.properties?.scope_lease, 'write exposes scope_lease');
  assert(
    !(writeSchema.required as string[] | undefined)?.includes('scope_lease'),
    'scope_lease is optional when sticky lease may apply'
  );
  assert(readSchema.properties?.project_id, 'read exposes project_id');
  assert(!readSchema.properties?.scope_lease, 'read does not require a lease');
  assert(destructiveSchema.properties?.confirm_destructive, 'destructive exposes confirmation');
  assert(getToolAccessMetadata('execute_function').secret, 'secret metadata is authoritative');
  assert(getToolAccessMetadata('inspect_access_token').access === 'unscoped', 'inspect is unscoped');
  assert(getToolAccessMetadata('probe_public_document').access === 'read', 'probe is read');
  assert(getToolAccessMetadata('get_public_graphql_model_map').access === 'read', 'map is read');
}

async function testPublishedToolSchemas(): Promise<void> {
  const scopeConfig = projectScopeConfigFromEnv({
    APITO_ALLOWED_PROJECT_IDS: 'project-a',
    APITO_DEFAULT_PROJECT_ID: 'project-a',
  });
  const server = new ApitoMCPServer(
    'https://example.test/system/graphql',
    'apt_test',
    {},
    scopeConfig
  );
  const response = await server.handleMCPRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  for (const tool of response.result.tools as Array<{
    name: string;
    inputSchema: { properties?: Record<string, unknown> };
  }>) {
    const metadata = getToolAccessMetadata(tool.name);
    if (!metadata.projectRequired) continue;
    assert(tool.inputSchema.properties?.project_id, `${tool.name} exposes project_id`);
    if (metadata.access !== 'read') {
      assert(tool.inputSchema.properties?.scope_lease, `${tool.name} exposes scope_lease`);
    }
  }
}

testHeaders();
testConfiguration();
testLeasesAndReads();
testToolSchemasAndMetadata();
await testPublishedToolSchemas();
console.log('Project scope tests passed');
