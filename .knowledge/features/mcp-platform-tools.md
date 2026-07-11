---
type: feature
title: MCP platform tools
description: Tenant catalog and app user tools vs engine system GraphQL
tags: [apito-mcp, graphql, saas, tenants, users]
timestamp: 2026-07-11T00:00:00Z
---

# MCP platform tools

## Tenant catalog (pro SaaS)

| MCP tool | Engine GraphQL | Notes |
|----------|----------------|-------|
| `list_tenants` | `getTenants` | Unbounded full list — avoid on large catalogs |
| **`search_tenants`** | **`searchTenants`** | Paginated + optional `q` (name, id, domain, data) |
| `create_tenant` | `createTenant` | |
| `update_tenant` | `updateTenant` | |
| `delete_tenant` | `deleteTenant` | |
| `generate_tenant_token` | `generateTenantToken` | Sensitive |
| `search_tenant_by_domain` | `searchTenantsByDomain` | Exact domain match |

## App auth users (core + pro)

| MCP tool | Engine GraphQL | Notes |
|----------|----------------|-------|
| **`search_app_users`** | **`searchUsers`** | Optional `tenant_id`, **`q`** (email, username, phone, id) |
| `create_app_user` | `createUser` | |
| `update_app_user` | `updateUser` | |
| `delete_app_user` | `deleteUser` | |
| `login_app_user` | `loginUser` | Returns JWT — sensitive |

Console **Users** tab uses the same `searchUsers` API as `search_app_users`.

## Parity checklist (engine release)

When engine adds/changes system GraphQL ops, update:

1. `src/graphql/*.ts`
2. `src/platform-tools.ts` + `platform-handlers.ts`
3. `CHANGELOG.md`, `.knowledge/features/mcp-platform-tools.md`
4. `test-tenant-users.ts`

Last Updated: 2026-07-11
