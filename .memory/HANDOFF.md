# apito-mcp — Handoff

## Branch

- `master` — may be dirty with `rename_model` + `update_field` parent_field;
  ask before commit/tag. MCP GraphQL-map plan **not** implemented yet.

## Done

- **2026-07-28/29:** `update_field` forwards `parent_field` /
  `field_sub_type` so nested field updates don’t stage as root fields.
- **2026-07-28:** `rename_model` MCP tool (stages only; Console publish)
- Deep nested GraphQL selection for schema tooling (v1.5.1)
- Project-scope safety + functions lifecycle (v1.5.0)

## Planned

- `get_public_graphql_model_map` — root camel ops + nested snake /
  `_list` / connect keys
- `probe_public_document` — one-shot public GraphQL hydrate check
- Scope UX: TTL 1800, sticky lease + default project in-process

## Next

- Confirm commit + version bump if shipping rename/update_field
- Confirm implement of improve_apito_mcp_gaps plan
- Reload Cursor MCP after pull; deploy worker if prod lags

## Do not touch

- Don’t publish schema from MCP — Console only
- Don’t add app codegen / hooks.ts parsers (explicit non-goal of v1.6 plan)

## Last Updated

2026-07-29
