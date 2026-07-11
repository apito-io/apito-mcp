# apito-mcp — Handoff

**Branch:** `master` | **Tag:** v1.4.0

## Done (2026-07-11)

- Registered as monorepo submodule `apito/apito-mcp`
- Knowledge scaffold (`.knowledge/`, `.memory/`, AGENTS.md)
- **`search_tenants`** — `searchTenants` with `q` pagination
- **`search_app_users`** — added `q` param (engine v2.4.13 parity)
- Hardened `get_data` / `list_data` descriptions; data-plane feature doc
- MCP config paths → `monorepo/apito/apito-mcp`
- Tagged **v1.4.0**; monorepo pointer at `d161f19`

## Next

- **Restart MCP** in Cursor after pull (path change)
- Verify `search_tenants` / `search_app_users` against engine v2.4.13 on `:5050`

## Do not touch

- `APITO_MCP_EDITION=open` pro tool hiding without updating tests
- Untracked `src/apito-naming.ts` / `test-naming.ts` — review before committing

## Last Updated
2026-07-11
