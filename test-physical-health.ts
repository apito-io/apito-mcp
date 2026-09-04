/**
 * Unit checks for physical-health verdict helpers (no network).
 *   pnpm exec tsx test-physical-health.ts
 */
import {
  formatModelPhysicalHealth,
  physicalHealthVerdict,
  type ModelPhysicalHealth,
} from './src/physical-health.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const stub: ModelPhysicalHealth = {
  model_name: 'app_release_policy',
  table_exists: true,
  physical_columns: ['id'],
  expected_columns: ['id', 'platform', 'force_update'],
  missing_columns: ['force_update', 'platform'],
  extra_columns: [],
  is_common_model: true,
  warnings: ['table exists but only id column — likely stub from runModelMigrations'],
};

assert(physicalHealthVerdict(stub) === 'column_drift', 'stub → column_drift');
assert(physicalHealthVerdict({ ...stub, table_exists: false, missing_columns: [] }) === 'missing_table', 'missing table');
assert(
  physicalHealthVerdict({
    ...stub,
    missing_columns: [],
    physical_columns: ['id', 'platform', 'force_update'],
    warnings: [],
  }) === 'ok',
  'ok'
);

const text = formatModelPhysicalHealth(stub);
assert(text.includes('column_drift'), 'format includes verdict');
assert(text.includes('MCP will not apply DDL'), 'format includes no-DDL note');

console.log('test-physical-health: ok');
