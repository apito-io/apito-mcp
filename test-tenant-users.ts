#!/usr/bin/env npx tsx

/**
 * Tenant catalog + app user platform tool smoke tests.
 * Unit tests always; optional live integration when APITO_API_KEY is set.
 */

import { ApitoGraphQLClient } from './src/graphql-client.js';
import { listTenants } from './src/graphql/tenants.js';
import { searchAppUsers } from './src/graphql/app-users.js';
import { filterToolsByEdition } from './src/mcp-edition.js';
import { PLATFORM_TOOL_DEFINITIONS } from './src/platform-tools.js';
import { PLATFORM_TOOL_NAMES } from './src/platform-handlers.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testEditionFiltering() {
  const proTools = filterToolsByEdition(PLATFORM_TOOL_DEFINITIONS, 'pro');
  const openTools = filterToolsByEdition(PLATFORM_TOOL_DEFINITIONS, 'open');
  assert(proTools.length === PLATFORM_TOOL_DEFINITIONS.length, 'pro edition exposes all platform tools');
  assert(openTools.length < proTools.length, 'open edition hides some pro-only tools');
  assert(
    !openTools.some((t) => t.name === 'list_tenants'),
    'list_tenants hidden in open edition'
  );
  assert(
    proTools.some((t) => t.name === 'search_tenants'),
    'search_tenants visible in pro edition'
  );
  assert(
    !openTools.some((t) => t.name === 'search_tenants'),
    'search_tenants hidden in open edition'
  );
  assert(openTools.some((t) => t.name === 'search_app_users'), 'search_app_users visible in open edition');
}

function testSearchAppUsersSchema() {
  const tool = PLATFORM_TOOL_DEFINITIONS.find((t) => t.name === 'search_app_users');
  assert(tool != null, 'search_app_users defined');
  const props = tool!.inputSchema as { properties?: Record<string, unknown> };
  assert(props.properties?.q != null, 'search_app_users input includes q');
}

function testSearchTenantsSchema() {
  const tool = PLATFORM_TOOL_DEFINITIONS.find((t) => t.name === 'search_tenants');
  assert(tool != null, 'search_tenants defined');
  assert(tool!.proOnly === true, 'search_tenants is pro-only');
  const props = tool!.inputSchema as { properties?: Record<string, unknown> };
  assert(props.properties?.q != null, 'search_tenants input includes q');
  assert(props.properties?.project_id != null, 'search_tenants requires project_id');
}

function testPlatformToolRegistry() {
  assert(PLATFORM_TOOL_NAMES.size === PLATFORM_TOOL_DEFINITIONS.length, 'handler registry matches definitions');
  for (const t of PLATFORM_TOOL_DEFINITIONS) {
    assert(PLATFORM_TOOL_NAMES.has(t.name), `handler registered for ${t.name}`);
  }
}

async function testLiveIntegration(endpoint: string, apiKey: string, projectId: string, tenantId?: string) {
  console.log('\n--- Live integration (optional) ---\n');
  const client = new ApitoGraphQLClient(endpoint, apiKey);
  const reqOpts = tenantId ? { tenantId } : undefined;

  try {
    const tenants = await listTenants(client, reqOpts);
    console.log(`listTenants: ${tenants.length} tenant(s)`);
    if (tenants.length > 0) {
      console.log('  first:', tenants[0]!.id, tenants[0]!.name);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('getTenants') || msg.includes('Cannot query field')) {
      console.log('listTenants skipped (not a pro SaaS project or field unavailable)');
    } else {
      throw e;
    }
  }

  const users = await searchAppUsers(
    client,
    { project_id: projectId, limit: 5, offset: 0, q: process.env.APITO_SEARCH_Q || undefined },
    reqOpts
  );
  console.log(`searchAppUsers: count=${users.count}, returned=${users.users.length}`);
}

async function main() {
  console.log('Apito MCP tenant + app user tests\n');

  testEditionFiltering();
  console.log('✅ filterToolsByEdition');

  testSearchAppUsersSchema();
  console.log('✅ search_app_users schema (q)');

  testSearchTenantsSchema();
  console.log('✅ search_tenants schema');

  testPlatformToolRegistry();
  console.log('✅ PLATFORM_TOOL_NAMES registry');

  const endpoint = process.env.APITO_GRAPHQL_ENDPOINT || 'http://localhost:5050/system/graphql';
  const apiKey = process.env.APITO_API_KEY || process.env.APITO_AUTH_TOKEN || '';
  const projectId = process.env.APITO_PROJECT_ID || '';
  const tenantId = process.env.TENANT_ID || process.env.APITO_TENANT_ID || '';

  if (apiKey && projectId) {
    const gqlEndpoint = endpoint.includes('/secured/graphql')
      ? endpoint.replace('/secured/graphql', '/system/graphql')
      : endpoint;
    await testLiveIntegration(gqlEndpoint, apiKey, projectId, tenantId || undefined);
    console.log('✅ live integration');
  } else {
    console.log('\nSkipping live integration (set APITO_API_KEY and APITO_PROJECT_ID to enable).');
  }

  console.log('\nAll tenant + app user tests passed.');
}

main().catch((err) => {
  console.error('\n❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
