# apito-mcp — Handoff

**Branch:** `master` | last tagged **v1.4.1** (functions work untagged)

## Done (2026-07-21 — Explicit project scope)

- Exact `APITO_ALLOWED_PROJECT_IDS`; optional read default, tenant map, TTL
- Canonical `X-Apito-Project-Id` on scoped GraphQL; variable/header mismatch guard
- Random project/tenant-bound confirmation leases for writes; destructive gate
- Central tool access metadata + automatic input schema/annotation decoration
- Call-isolated server/client/schema context; no mutable current-project selector
- Worker forwards project header and isolates cache/CORS by project + tenant
- `execute_function` uses resolved project; `apt_` omits temp tenant cookie
- `pnpm run typecheck` and `pnpm run test:project-scope` pass

## Done (2026-07-18 — Logic functions lifecycle)

- `src/graphql/functions.ts` — projectFunctionsInfo + upsert/test/deploy/rollback
  + list revisions/deployments
- Expanded `list_functions` / `upsert_function`; new tools:
  `test_function_draft`, `deploy_function`, `execute_function`,
  `list_function_revisions`, `list_function_deployments`, `rollback_function`
- REST base from GraphQL endpoint; optional `APITO_REST_ENDPOINT`; secret masking
- Feature doc `mcp-functions-lifecycle.md`; README/CHANGELOG; `test-functions.ts`
- **Verified:** Rosna `execute_function` `listFoodNames` → HTTP 200

## Next

- Configure `APITO_ALLOWED_PROJECT_IDS` (and optional default/tenant map), then
  restart local MCP before smoke use
- User confirm → commit; optional version bump / Workers deploy
- Restart MCP in Cursor after pull

## Do not touch

- `APITO_MCP_EDITION=open` pro tool hiding without updating tests
- Plan file `.cursor/plans/mcp_cli_functions_74d67203.plan.md` unless user asks

## Last Updated
2026-07-21
