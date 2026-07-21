# apito-mcp — Architecture

## Entry points

| File | Role |
|------|------|
| `src/index.ts` | MCP stdio server: schema + data tools, merges platform tools |
| `src/worker.ts` | Cloudflare Workers SSE transport |
| `src/platform-tools.ts` | Platform tool definitions |
| `src/platform-handlers.ts` | Dispatch platform tools → `src/graphql/*` |
| `src/graphql-client.ts` | System GraphQL HTTP client (Bearer `apt_`, canonical project/tenant headers) |
| `src/project-scope.ts` | Exact allowlists, access metadata, confirmation leases, tool schema decoration |
| `src/mcp-edition.ts` | `APITO_MCP_EDITION=open` hides pro-only tools |

## GraphQL clients (`src/graphql/`)

- `tenants.ts` — SaaS catalog (`getTenants`, `searchTenants`, CRUD, domain lookup)
- `app-users.ts` — project auth users (`searchUsers`, CRUD, login)
- `project-admin.ts`, `integrations.ts`, `data-plane.ts` — roles, media, reorder

## Tool routing (see DECISIONS.md)

- **Tenant catalog** → platform tools (`search_tenants`, not `get_data` on tenant model)
- **App auth users** → `search_app_users` (not `get_data` on user model)
- **Project documents** → `get_data` / `list_data` with **`where`** filters

## Config (env)

- `APITO_GRAPHQL_ENDPOINT` — default `http://localhost:5050/system/graphql`
- `APITO_API_KEY` / `APITO_AUTH_TOKEN`
- `TENANT_ID` / `APITO_TENANT_ID` — SaaS scope header
- `APITO_MCP_EDITION` — `pro` (default) or `open`
- `APITO_ALLOWED_PROJECT_IDS` — required exact project allowlist
- `APITO_DEFAULT_PROJECT_ID` — optional read-only default
- `APITO_ALLOWED_TENANTS_BY_PROJECT` — optional exact tenant map
- `APITO_PROJECT_SCOPE_TTL_SECONDS` — confirmation/lease TTL

## Project isolation

Tool calls resolve project scope centrally before dispatch. Each scoped call gets a
fresh server/client/schema context with immutable project defaults; no shared current
project is mutated. The shared lease manager stores only random, TTL-bound,
project/tenant-bound confirmation records.

Last Updated: 2026-07-21
