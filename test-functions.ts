import assert from 'node:assert/strict';
import { ApitoGraphQLClient } from './src/graphql-client.js';
import * as functions from './src/graphql/functions.js';
import { handlePlatformTool } from './src/platform-handlers.js';

/** Minimal stub that records GraphQL requests and fakes REST calls. */
class StubClient {
  public calls: Array<{ query: string; variables?: Record<string, unknown> }> = [];
  public restCalls: Array<Record<string, unknown>> = [];
  private readonly rows: Record<string, unknown>[];

  constructor(rows: Record<string, unknown>[] = []) {
    this.rows = rows;
  }

  async request<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    this.calls.push({ query, variables });
    if (query.includes('projectFunctionsInfo')) {
      return { projectFunctionsInfo: this.rows } as T;
    }
    return {} as T;
  }

  async executeFunctionREST(args: Record<string, unknown>) {
    this.restCalls.push(args);
    return { status: 200, ok: true, body: { echoed: args.payload } };
  }
}

function asClient(stub: StubClient): ApitoGraphQLClient {
  return stub as unknown as ApitoGraphQLClient;
}

// --- REST base URL derivation ---
assert.equal(
  new ApitoGraphQLClient('https://api.apito.io/system/graphql', 'tok').restBaseUrl(),
  'https://api.apito.io'
);
assert.equal(
  new ApitoGraphQLClient('https://api.apito.io/secured/graphql', 'tok').restBaseUrl(),
  'https://api.apito.io'
);
assert.equal(
  new ApitoGraphQLClient('http://localhost:5050/system/graphql/', 'tok').restBaseUrl(),
  'http://localhost:5050'
);

const prevRest = process.env.APITO_REST_ENDPOINT;
process.env.APITO_REST_ENDPOINT = 'https://studio.example.com/engine/';
assert.equal(
  new ApitoGraphQLClient('https://api.apito.io/system/graphql', 'tok').restBaseUrl(),
  'https://studio.example.com/engine'
);
if (prevRest === undefined) delete process.env.APITO_REST_ENDPOINT;
else process.env.APITO_REST_ENDPOINT = prevRest;

// --- upsert_function variable shape: only defined keys are sent ---
{
  const stub = new StubClient();
  await functions.upsertFunction(asClient(stub), {
    name: 'listFoodNames',
    source: 'export default async () => ({})',
    capabilities: ['data.read'],
    runtime_config: { runtime: 'apito-deno' },
    update: true,
  });
  const vars = stub.calls[0].variables ?? {};
  assert.equal(vars.name, 'listFoodNames');
  assert.deepEqual(vars.capabilities, ['data.read']);
  assert.deepEqual(vars.runtime_config, { runtime: 'apito-deno' });
  assert.equal(vars.update, true);
  // Undefined optional args must be omitted, not sent as null/undefined.
  assert.equal('description' in vars, false);
  assert.equal('env_vars' in vars, false);
}

// --- test_function_draft passes payload + tenant through ---
{
  const stub = new StubClient();
  await functions.testFunctionDraft(asClient(stub), {
    name: 'listFoodNames',
    payload: { limit: 5 },
    tenant_id: 'tenant_a',
  });
  const vars = stub.calls[0].variables ?? {};
  assert.deepEqual(vars.payload, { limit: 5 });
  assert.equal(vars.tenant_id, 'tenant_a');
}

// --- execute_function: resolves secret, masks by default; uses app_user_token ---
{
  const stub = new StubClient([
    { name: 'listFoodNames', active_revision_id: 'rev_1', rest_api_secret_url_key: 'supersecret9999' },
  ]);
  const res = await handlePlatformTool(
    'execute_function',
    {
      name: 'listFoodNames',
      project_id: 'proj_123',
      payload: { limit: 5 },
      app_user_token: 'ak_app_user_jwt_example',
    },
    asClient(stub)
  );
  const body = JSON.parse(res.content[0].text);
  assert.equal(body.project_id, 'proj_123');
  assert.equal(body.active_revision_id, 'rev_1');
  assert.equal(body.fn_hash, '****9999'); // masked
  assert.equal(body.ok, true);
  assert.equal(body.used_app_user_token, true);
  assert.equal('app_user_token' in body, false); // never echoed
  assert.equal(stub.restCalls[0].secret, 'supersecret9999');
  assert.equal(stub.restCalls[0].appUserToken, 'ak_app_user_jwt_example');
  assert.equal(stub.restCalls[0].tenantId, undefined);
}

// --- execute_function: rejects authoritative tenant_id ---
{
  const stub = new StubClient([
    { name: 'f', active_revision_id: 'rev_1', rest_api_secret_url_key: 'x' },
  ]);
  await assert.rejects(
    () =>
      handlePlatformTool(
        'execute_function',
        { name: 'f', project_id: 'proj_123', tenant_id: 'tenant_a' },
        asClient(stub)
      ),
    /tenant_id is not accepted/
  );
}

// --- execute_function: reveal_secret returns raw secret ---
{
  const stub = new StubClient([
    { name: 'f', active_revision_id: 'rev_1', rest_api_secret_url_key: 'supersecret9999' },
  ]);
  const res = await handlePlatformTool(
    'execute_function',
    { name: 'f', project_id: 'proj_123', reveal_secret: true },
    asClient(stub)
  );
  const body = JSON.parse(res.content[0].text);
  assert.equal(body.fn_hash, 'supersecret9999');
}

// --- execute_function: errors when never deployed ---
{
  const stub = new StubClient([{ name: 'f', rest_api_secret_url_key: 'x' }]);
  await assert.rejects(
    () =>
      handlePlatformTool(
        'execute_function',
        { name: 'f', project_id: 'proj_123' },
        asClient(stub)
      ),
    /no active revision/
  );
}

console.log('test-functions: ok');
