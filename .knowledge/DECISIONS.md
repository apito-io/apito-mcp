# apito-mcp — Decisions

## Tool routing: catalog and users vs documents

| Need | Use | Do not use |
|------|-----|------------|
| SaaS tenant catalog search | `search_tenants` (system `searchTenants`) | `get_data` + `search` on secured `tenant` model |
| App auth user list/search | `search_app_users` (system `searchUsers`) | `get_data` on `user` model |
| Project document filter | `get_data` / `list_data` with **`where`** | `search` alone on JSON fields (unreliable) |

**Reason:** `getModelData.search` is a generic document filter; catalog rows live on system GraphQL, not secured model queries.

**Status:** Adopted 2026-07-11 (v1.4.0)

## Edition split (open vs pro)

Pro-only tools (`list_tenants`, `search_tenants`, tenant CRUD, …) hidden when `APITO_MCP_EDITION=open`.

**Status:** Adopted v1.3.0

Last Updated: 2026-07-11
