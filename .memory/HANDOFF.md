# apito-mcp — Handoff

## Branch

- `master` — dirty with v1.7.0 GraphQL-surface + inspect tools. Ask before
  commit/tag. Engine open-core also has `/system/access-tokens/me`.

## Done

- **2026-08-09 v1.7.0:**
  - Naming helpers + `get_public_graphql_model_map`
  - `probe_public_document` → `/secured/graphql`
  - Scope sticky lease / TTL 1800 / sticky default project
  - `inspect_access_token` + client `inspectAccessTokenMe`
  - Tests: naming, project-scope sticky, inspect mock
  - README debug sections; CHANGELOG 1.7.0; admin-sdk-consumers note
- Engine: `GetAccessTokenMe` + `PublicForPrincipal` (apt_ only; no secret)

## Next

1. Confirm commit mcp + open-core + engine ACCESS_TOKENS.md
2. Deploy engine then reload MCP worker
3. Smoke: map → probe → inspect on a real project

## Do not touch

- Don’t publish schema from MCP
- Don’t accept pasted apt_/ak_ as inspect tool args
- Don’t parse app hooks.ts / useTable in MCP (documented non-goal)

## Last Updated

2026-08-09
