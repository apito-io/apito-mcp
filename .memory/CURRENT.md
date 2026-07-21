# apito-mcp — Current

## Now

- **Project-scope safety (2026-07-21):** Canonical `X-Apito-Project-Id`,
  exact env allowlists, project/tenant-bound write leases, central access
  metadata/schema decoration, call-isolated clients, Worker project forwarding,
  and focused tests implemented. Gap fix: immutable Worker scope config,
  tenant-only options keep default project, response `Vary`. Typecheck +
  project-scope tests pass.
- **Logic functions lifecycle (2026-07-18):** Full author→test→deploy→invoke
  tools shipped (`graphql/functions.ts`, expanded list/upsert, REST
  `execute_function` with secret masking). Verified against Rosna
  `listFoodNames`. Uncommitted — ask before save.
- Earlier: v1.4.1 soft-delete tenant docs; v1.4.0 search_tenants / search_app_users

## Next

- Review/commit project-scope + earlier function changes when user confirms;
  configure allowlist env before restarting/deploying
- Optional Workers deploy / tag bump
- Restart Cursor MCP after pull so tools reload

## Last Updated
2026-07-21
