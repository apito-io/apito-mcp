---
type: feature
title: MCP data plane
description: get_data, where filters, and search limitations
tags: [apito-mcp, get_data, where, search]
timestamp: 2026-07-11T00:00:00Z
---

# MCP data plane

## `get_data` / `list_data`

Query **published** project model documents via system GraphQL `getModelData`.

### Prefer `where` over `search`

`search` is legacy and **unreliable** for JSON document fields — it may return the full collection unchanged.

```json
{
  "model_name": "vendor_profile",
  "where": { "email": { "contains": "bdcoder" } },
  "limit": 20
}
```

### Wrong tool for catalog / users

| Mistake | Correct tool |
|---------|--------------|
| `get_data({ model_name: "tenant", search: "bdcoder" })` expecting SaaS catalog | `search_tenants({ project_id, q: "bdcoder" })` |
| `get_data` on user model for auth user counts | `search_app_users({ project_id, q: "..." })` |

Secured **`tenant`** / **`vendor_profile`** rows are **project documents**, not the SaaS **tenant catalog** (`search_tenants`).

## SaaS `tenant_id`

Pass `tenant_id` on data tools (or `TENANT_ID` env) for per-tenant DB or shared-DB scope.

Last Updated: 2026-07-11
