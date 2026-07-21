# apito-mcp — Decisions

## Explicit project scope; no mutable current project

All project-scoped tools resolve through an exact environment allowlist. Reads require
an explicit project unless a read default is configured. Writes use random,
project-bound confirmation leases; destructive calls add a literal confirmation.
Each call receives an isolated client/schema context and sends only
`X-Apito-Project-Id`.

**Reason:** A multi-project `apt_` token must not inherit project selection from a
previous/concurrent tool call or from alternate header spellings.

**Status:** Adopted 2026-07-21

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

Last Updated: 2026-07-21
