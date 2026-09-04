/**
 * Read-only physical schema health helpers (MCP layer).
 * Engine GraphQL modelPhysicalHealth / projectPhysicalHealth supply the data;
 * MCP never applies DDL.
 */

export type ModelPhysicalHealth = {
  model_name: string;
  table_exists: boolean;
  physical_columns: string[];
  expected_columns: string[];
  missing_columns: string[];
  extra_columns: string[];
  is_common_model: boolean;
  warnings: string[];
};

export type PhysicalHealthVerdict = 'ok' | 'missing_table' | 'column_drift';

export function physicalHealthVerdict(h: ModelPhysicalHealth): PhysicalHealthVerdict {
  if (!h.table_exists) return 'missing_table';
  if ((h.missing_columns?.length ?? 0) > 0) return 'column_drift';
  return 'ok';
}

export function formatModelPhysicalHealth(h: ModelPhysicalHealth): string {
  const verdict = physicalHealthVerdict(h);
  const lines = [
    `## ${h.model_name}`,
    `- verdict: **${verdict}**`,
    `- table_exists: ${h.table_exists}`,
    `- is_common_model: ${h.is_common_model}`,
    `- expected_columns (${h.expected_columns?.length ?? 0}): ${JSON.stringify(h.expected_columns ?? [])}`,
    `- physical_columns (${h.physical_columns?.length ?? 0}): ${JSON.stringify(h.physical_columns ?? [])}`,
    `- missing_columns: ${JSON.stringify(h.missing_columns ?? [])}`,
    `- extra_columns: ${JSON.stringify(h.extra_columns ?? [])}`,
  ];
  if (h.warnings?.length) {
    lines.push(`- warnings:`);
    for (const w of h.warnings) {
      lines.push(`  - ${w}`);
    }
  }
  if (verdict !== 'ok') {
    lines.push('');
    lines.push(
      '**MCP will not apply DDL.** Repair via Console Schema publish / Studio ops, then re-check with `get_model_physical_health`.'
    );
  }
  return lines.join('\n');
}

export function formatProjectPhysicalHealth(rows: ModelPhysicalHealth[]): string {
  const drifting = rows.filter((r) => physicalHealthVerdict(r) !== 'ok');
  const ok = rows.length - drifting.length;
  const lines = [
    `# Project physical health`,
    `- models checked: ${rows.length}`,
    `- ok: ${ok}`,
    `- drifting: ${drifting.length}`,
    '',
  ];
  if (drifting.length) {
    lines.push('## Drifting models');
    for (const h of drifting) {
      lines.push(formatModelPhysicalHealth(h));
      lines.push('');
    }
  } else {
    lines.push('All checked models match physical columns (base project DB).');
  }
  lines.push('');
  lines.push(
    'Note: SaaS common models are inspected on the **base project DB** only (not every tenant DB).'
  );
  lines.push(
    '**MCP never runs remote DDL** (`ALTER` / `DROP` / `runModelMigrations`). Escalate repairs to Console or Studio ops.'
  );
  return lines.join('\n');
}
