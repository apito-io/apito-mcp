/**
 * Field + public GraphQL naming helpers aligned with Apito Engine
 * (utility.IsValidIdentifier / RelationFilterGraphQLKey) and js-admin-sdk
 * `apitoGraphqlNames.ts`. Nested relation keys are snake; root ops stay camel.
 */

const CAMEL_SPLIT = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g;

export function splitIntoWordSegments(raw: string): string[] {
  const trimmed = raw.trim().replace(/-/g, '_');
  const parts = trimmed.split(/[\s_]+/).filter(Boolean);
  const segments: string[] = [];

  for (const part of parts) {
    const pieces = part.match(CAMEL_SPLIT);
    if (!pieces) continue;
    for (const piece of pieces) {
      const s = piece.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (s) segments.push(s);
    }
  }
  return segments;
}

/** Derive canonical snake_case field identifier from a label or raw name. */
export function canonicalizeFieldIdentifier(raw: string): string {
  const work = raw.trim().replace(/\(([^)]+)\)/g, ' $1 ');
  const segments = splitIntoWordSegments(work);
  return segments.join('_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/** True when legacy lower-only normalization would differ from canonical (camelCase input). */
export function fieldIdentifierNeedsCanonicalization(raw: string): boolean {
  const label = raw.trim();
  if (!label) return false;
  const legacy = label
    .toLowerCase()
    .replace(/\(([^)]+)\)/g, '_$1')
    .replace(/[\s\-._]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const canonical = canonicalizeFieldIdentifier(label);
  return legacy !== canonical && legacy.length > 0;
}

function splitCamelPieces(piece: string): string[] {
  const spaced = piece.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter(Boolean);
}

/** lowerCamel from canonical snake (`food_order` → `foodOrder`). */
export function camelFromCanonical(canonical: string): string {
  const parts = canonical.split('_').filter(Boolean);
  return parts
    .map((p, i) =>
      i === 0
        ? p.toLowerCase()
        : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    )
    .join('');
}

/** PascalCase without underscores (`food_order` → `FoodOrder`). */
export function pascalFromCanonical(canonical: string): string {
  return canonical
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

/** Legacy camel / Pascal id → Pascal (`foodCategory` → `FoodCategory`). */
export function pascalFromAnyModelId(modelId: string): string {
  if (!modelId) return '';
  if (modelId.includes('_')) return pascalFromCanonical(modelId);
  const segs = splitCamelPieces(modelId);
  return segs
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

/**
 * lowerCamel root field id — trim `List` / `ListCount`, camel-case remainder.
 * Matches Go `utility.SingularResourceName` (no English plural inflection).
 */
export function apitoSingularResourceName(name: string): string {
  let t = name.trim();
  if (t.endsWith('ListCount')) t = t.slice(0, -'ListCount'.length);
  else if (t.endsWith('List')) t = t.slice(0, -'List'.length);
  t = t.trim();
  if (!t) return '';
  if (t.includes('_')) return camelFromCanonical(t);
  const segs = splitCamelPieces(t);
  if (segs.length === 0) return t.toLowerCase();
  return segs
    .map((s, i) =>
      i === 0
        ? s.toLowerCase()
        : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    )
    .join('');
}

export function apitoMultipleResourceName(name: string): string {
  return `${apitoSingularResourceName(name)}List`;
}

/** Stored model id as snake_case (connection.model / filter keys). */
export function apitoStoredSnakeModelId(resource: string): string {
  const singular = apitoSingularResourceName(resource);
  if (singular.includes('_')) return singular;
  return splitCamelPieces(singular).join('_');
}

/**
 * Nested relation selection key on document types:
 * has_many → `{id}_list`; has_one → `{id}`.
 */
export function apitoConnectionFieldNameForRelation(
  relatedModelRef: string,
  relation: 'has_one' | 'has_many'
): string {
  const key = apitoStoredSnakeModelId(relatedModelRef);
  if (relation === 'has_many') return `${key}_list`;
  return key;
}

/** GraphQL `relation: { … }` filter key — always singular (never `*_list`). */
export function apitoRelationFilterGraphQLKey(
  relatedModelRef: string,
  knownAs?: string | null
): string {
  const alias = knownAs?.trim();
  if (alias) return alias;
  return apitoStoredSnakeModelId(relatedModelRef);
}

export function apitoMutationConnectHasOneIdField(relatedModelRef: string): string {
  return `${apitoStoredSnakeModelId(relatedModelRef)}_id`;
}

export function apitoMutationConnectHasManyIdsField(relatedModelRef: string): string {
  return `${apitoStoredSnakeModelId(relatedModelRef)}_ids`;
}

export type RelationCardinality = 'has_one' | 'has_many';

export type PublicGraphqlRelationMap = {
  peer_model: string;
  relation: RelationCardinality;
  known_as?: string;
  selection_key: string;
  connect_key: string;
  filter_key: string;
};

export type PublicGraphqlRootOperations = {
  get_one: string;
  list: string;
  count: string;
  create: string;
  update: string;
  delete: string;
  upsert_list: string;
};

export type PublicGraphqlModelMap = {
  model: string;
  root_operations: PublicGraphqlRootOperations;
  data_fields: string[];
  relations: PublicGraphqlRelationMap[];
  missing_notes: string[];
};

export type ModelLikeForMap = {
  name: string;
  fields?: Array<{ identifier?: string; field_type?: string }>;
  connections?: Array<{
    model?: string;
    relation?: string;
    type?: string;
    known_as?: string;
  }>;
};

function normalizeRelation(raw?: string): RelationCardinality {
  const r = (raw ?? '').toLowerCase().trim();
  if (r === 'has_one' || r === 'belongs_to' || r === 'one') return 'has_one';
  return 'has_many';
}

export function rootOperationsForModel(modelName: string): PublicGraphqlRootOperations {
  const singular = apitoSingularResourceName(modelName);
  const pascal = pascalFromAnyModelId(modelName);
  return {
    get_one: singular,
    list: `${singular}List`,
    count: `${singular}ListCount`,
    create: `create${pascal}`,
    update: `update${pascal}`,
    delete: `delete${pascal}`,
    upsert_list: `upsert${pascal}List`,
  };
}

/**
 * Build the public GraphQL surface map for one model from schema connections.
 * Does not invent camel nested keys.
 */
export function buildPublicGraphqlModelMap(
  model: ModelLikeForMap,
  allModelNames: string[] = []
): PublicGraphqlModelMap {
  const relations: PublicGraphqlRelationMap[] = [];
  for (const conn of model.connections ?? []) {
    const peer = (conn.model ?? '').trim();
    if (!peer) continue;
    const relation = normalizeRelation(conn.relation ?? conn.type);
    const knownAs = conn.known_as?.trim() || undefined;
    const selectionBase = knownAs || peer;
    relations.push({
      peer_model: peer,
      relation,
      known_as: knownAs,
      selection_key: apitoConnectionFieldNameForRelation(selectionBase, relation),
      connect_key:
        relation === 'has_many'
          ? apitoMutationConnectHasManyIdsField(selectionBase)
          : apitoMutationConnectHasOneIdField(selectionBase),
      filter_key: apitoRelationFilterGraphQLKey(peer, knownAs),
    });
  }

  const data_fields = (model.fields ?? [])
    .filter((f) => f.identifier?.trim() && (f.field_type ?? '') !== 'relation')
    .map((f) => f.identifier!.trim());

  const missing_notes: string[] = [];
  if (relations.length === 0) {
    missing_notes.push(
      'no forward connections — no nested relation selection keys on this type'
    );
  } else if (allModelNames.length > 0) {
    // Optional hints for peers the caller cares about (passed as interest set).
    const linked = new Set(relations.map((r) => apitoStoredSnakeModelId(r.peer_model)));
    for (const name of allModelNames) {
      if (name.toLowerCase() === model.name.toLowerCase()) continue;
      const snake = apitoStoredSnakeModelId(name);
      if (!linked.has(snake)) {
        missing_notes.push(
          `no edge to \`${name}\` → no \`${snake}\` / \`${snake}_list\` on this type`
        );
      }
    }
  }

  return {
    model: model.name,
    root_operations: rootOperationsForModel(model.name),
    data_fields,
    relations,
    missing_notes,
  };
}
