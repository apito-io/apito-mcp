#!/usr/bin/env npx tsx

/**
 * Schema versioning adoption tests for apito-mcp.
 * Runs unit tests always; optional live integration when APITO_API_KEY is set.
 */

import { ApitoGraphQLClient } from './src/graphql-client.js';
import {
  SchemaVersioningContext,
  buildEffectiveModels,
  detectStagingResponse,
  formatUserPublishReminder,
} from './src/schema-versioning.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testDetectStagingResponse() {
  assert(detectStagingResponse({ staged: true, model_name: 'Movie' }).staged === true, 'object staged');
  assert(
    detectStagingResponse([{ name: 'Movie', staged: true, model_name: 'Movie' }]).staged === true,
    'array item staged'
  );
  assert(detectStagingResponse([{ name: 'Existing' }]).staged === false, 'live model list');
  assert(detectStagingResponse(null).staged === false, 'null');
}

function testFormatUserPublishReminder() {
  assert(formatUserPublishReminder({ enabled: false, active_version: 1, has_draft: false, pending_operations: 0 }) === '', 'disabled');
  const text = formatUserPublishReminder({
    enabled: true,
    active_version: 3,
    has_draft: true,
    changeset_id: 'cs_test',
    pending_operations: 2,
  });
  assert(text.includes('cs_test'), 'changeset id in reminder');
  assert(text.includes('Publish manually'), 'publish instruction');
  assert(text.includes('MCP does not publish'), 'no auto publish');
}

function testBuildEffectiveModels() {
  const live = JSON.stringify({
    models: [{ name: 'Article', fields: [{ identifier: 'title' }], connections: [] }],
  });
  const draft = JSON.stringify({
    models: [
      { name: 'Article', fields: [{ identifier: 'title' }, { identifier: 'slug' }], connections: [] },
      { name: 'Movie', fields: [], connections: [] },
    ],
  });
  const diff = JSON.stringify({ model_changes: [] });
  const merged = buildEffectiveModels(live, draft, diff);
  assert(merged.some((m) => m.name === 'Movie'), 'draft-only model included');
  const article = merged.find((m) => m.name === 'Article');
  assert(article?.fields?.some((f) => f.identifier === 'slug'), 'draft field overlay');
}

async function testLiveIntegration(endpoint: string, apiKey: string) {
  console.log('\n--- Live integration (optional) ---\n');
  const client = new ApitoGraphQLClient(endpoint, apiKey);
  const ctx = new SchemaVersioningContext(client);

  const status = await ctx.getStatus(true);
  console.log('schemaVersioningStatus:', JSON.stringify(status, null, 2));

  const { models: effective, sourceUsed } = await ctx.resolveModels('effective');
  console.log(`resolveModels(effective): ${effective.length} model(s), source=${sourceUsed}`);

  if (status.enabled && status.has_draft) {
    const summary = await ctx.getEffectiveSchemaSummary();
    assert(Array.isArray(summary.effective_models), 'effective_models array');
    console.log('draft_only_models:', summary.draft_only_models);
    console.log(formatUserPublishReminder(status));

    const draftOnly = (summary.draft_only_models as string[]) ?? [];
    if (draftOnly.length > 0) {
      try {
        await ctx.assertModelPublished(draftOnly[0]!);
        console.warn('WARN: assertModelPublished did not block draft-only model');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        assert(msg.includes('draft'), 'upsert blocked for draft-only model');
        console.log(`✅ assertModelPublished blocked draft-only model "${draftOnly[0]}"`);
      }
    }
  } else {
    console.log('No active draft — skipping draft-only upsert gate test.');
  }
}

async function main() {
  console.log('Apito MCP schema versioning tests\n');

  testDetectStagingResponse();
  console.log('✅ detectStagingResponse');

  testFormatUserPublishReminder();
  console.log('✅ formatUserPublishReminder');

  testBuildEffectiveModels();
  console.log('✅ buildEffectiveModels');

  const endpoint = process.env.APITO_GRAPHQL_ENDPOINT || 'http://localhost:5050/system/graphql';
  const apiKey = process.env.APITO_API_KEY || process.env.APITO_AUTH_TOKEN || '';

  if (apiKey) {
    if (endpoint.includes('/secured/graphql')) {
      process.env.APITO_GRAPHQL_ENDPOINT = endpoint.replace('/secured/graphql', '/system/graphql');
    }
    await testLiveIntegration(
      endpoint.includes('/secured/graphql')
        ? endpoint.replace('/secured/graphql', '/system/graphql')
        : endpoint,
      apiKey
    );
    console.log('✅ live integration');
  } else {
    console.log('\nSkipping live integration (set APITO_API_KEY to enable).');
  }

  console.log('\nAll schema versioning tests passed.');
}

main().catch((err) => {
  console.error('\n❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
