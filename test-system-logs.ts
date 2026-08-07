#!/usr/bin/env npx tsx

import { filterToolsByEdition } from './src/mcp-edition.js';
import {
  MAX_LOG_FIELD_BYTES,
  MAX_LOG_ROWS,
  boundLogEvent,
  boundLogEvents,
  clampLogLimit,
} from './src/graphql/system-logs.js';
import { PLATFORM_TOOL_DEFINITIONS } from './src/platform-tools.js';
import { PLATFORM_TOOL_NAMES } from './src/platform-handlers.js';
import { applyProjectScopeSchema, getToolAccessMetadata } from './src/project-scope.js';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const LOG_TOOL_NAMES = [
  'search_system_logs',
  'get_system_log',
  'get_system_trace',
  'summarize_system_logs',
  'get_log_store_health',
] as const;

function testDefinitions() {
  for (const name of LOG_TOOL_NAMES) {
    const tool = PLATFORM_TOOL_DEFINITIONS.find((t) => t.name === name);
    assert(tool != null, `${name} defined`);
    assert(tool!.proOnly === true, `${name} is pro-only`);
    assert(PLATFORM_TOOL_NAMES.has(name), `${name} registered in handlers`);
  }
}

function testEditionFiltering() {
  const openTools = filterToolsByEdition(PLATFORM_TOOL_DEFINITIONS, 'open');
  for (const name of LOG_TOOL_NAMES) {
    assert(!openTools.some((t) => t.name === name), `${name} hidden in open edition`);
  }
}

function testSystemScopedReadMetadata() {
  for (const name of LOG_TOOL_NAMES) {
    const metadata = getToolAccessMetadata(name);
    assert(metadata.access === 'read', `${name} is read access`);
    assert(metadata.projectRequired === false, `${name} is system-scoped (no project required)`);
    assert(metadata.secret === false, `${name} is not secret`);
  }
}

function testPublishedSchemas() {
  const search = applyProjectScopeSchema(
    PLATFORM_TOOL_DEFINITIONS.find((t) => t.name === 'search_system_logs')!
  );
  const schema = search.inputSchema as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  assert(schema.properties?.project_id != null, 'search_system_logs exposes optional project_id');
  assert(!schema.required?.includes('project_id'), 'search_system_logs does not require project_id');
  assert(!schema.properties?.scope_lease, 'search_system_logs does not require scope_lease');

  const getLog = applyProjectScopeSchema(
    PLATFORM_TOOL_DEFINITIONS.find((t) => t.name === 'get_system_log')!
  );
  const getLogSchema = getLog.inputSchema as { required?: string[] };
  assert(getLogSchema.required?.includes('id'), 'get_system_log requires id');
}

function testClampAndBound() {
  assert(clampLogLimit(undefined) === MAX_LOG_ROWS, 'default limit is max rows');
  assert(clampLogLimit(10) === 10, 'limit below cap unchanged');
  assert(clampLogLimit(999) === MAX_LOG_ROWS, 'limit above cap clamped');

  const long = 'x'.repeat(MAX_LOG_FIELD_BYTES + 500);
  const bounded = boundLogEvent({ id: '1', request_payload: long });
  assert(
    Buffer.from(String(bounded.request_payload), 'utf8').length <= MAX_LOG_FIELD_BYTES + 32,
    'payload field truncated'
  );
  assert(String(bounded.request_payload).includes('[truncated]'), 'truncation marker present');

  const events = Array.from({ length: 80 }, (_, i) => ({ id: String(i) }));
  assert(boundLogEvents(events).length === MAX_LOG_ROWS, 'row cap enforced');
}

function main() {
  testDefinitions();
  console.log('✅ log tool definitions + registry');

  testEditionFiltering();
  console.log('✅ pro-only edition filtering');

  testSystemScopedReadMetadata();
  console.log('✅ system-scoped read metadata');

  testPublishedSchemas();
  console.log('✅ project scope schema decoration');

  testClampAndBound();
  console.log('✅ row and payload bounds');

  console.log('\nSystem log platform tool tests passed');
}

main();
