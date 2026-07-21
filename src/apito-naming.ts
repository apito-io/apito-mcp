/**
 * Field identifier rules aligned with Apito Engine utility.IsValidIdentifier
 * (splitIntoWordSegments from apito_naming.go).
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
