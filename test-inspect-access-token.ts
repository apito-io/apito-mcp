#!/usr/bin/env npx tsx

/**
 * Unit coverage for access-token inspect client path (mocked fetch).
 * Never echoes apt_ secrets.
 */

import { ApitoGraphQLClient } from './src/graphql-client.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function testInspectAccessTokenMe(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedAuth = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    const headers = init?.headers as Record<string, string>;
    capturedAuth = headers?.Authorization ?? '';
    return new Response(
      JSON.stringify({
        code: 200,
        token: {
          id: 'tok_1',
          secret_prefix: 'apt_user_tok_',
          name: 'MCP',
          preset: 'mcp_assistant',
          status: 'active',
          capabilities: ['data.read', 'schema.read'],
          capability_count: 2,
          project_grant_mode: 'selected',
          project_ids: ['proj_a'],
        },
        operation_hint: {
          operation: 'queryDocuments',
          required: 'data.read',
          present: true,
          known: true,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const client = new ApitoGraphQLClient(
      'https://example.test/system/graphql',
      'apt_secret_never_echo'
    );
    const body = await client.inspectAccessTokenMe({
      operation: 'queryDocuments',
      projectId: 'proj_a',
    });
    assert(capturedUrl.includes('/system/access-tokens/me'), 'hits /me');
    assert(capturedUrl.includes('operation=queryDocuments'), 'passes operation');
    assert(capturedAuth === 'Bearer apt_secret_never_echo', 'sends bearer');
    assert((body.token as { id?: string })?.id === 'tok_1', 'returns public token');
    const serialized = JSON.stringify(body);
    assert(!serialized.includes('apt_secret_never_echo'), 'never echoes raw secret in body');
    assert(!serialized.includes('secret_hash'), 'no secret_hash');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testPublicEndpointDerivation(): Promise<void> {
  const client = new ApitoGraphQLClient(
    'https://api.example.test/system/graphql',
    'apt_x'
  );
  assert(
    client.publicGraphqlEndpoint() === 'https://api.example.test/secured/graphql',
    'derives /secured/graphql from system URL'
  );
}

await testInspectAccessTokenMe();
await testPublicEndpointDerivation();
console.log('test-inspect-access-token: ok');
