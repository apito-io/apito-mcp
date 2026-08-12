---
type: feature
title: MCP platform tools
description: Tenant catalog and app user tools vs engine system GraphQL
tags: [apito-mcp, graphql, saas, tenants, users]
timestamp: 2026-07-11T00:00:00Z
---

# MCP platform tools

## Tenant catalog (pro SaaS)

**Lifecycle boundary:** SaaS tenant create/update/delete must use these platform tools only. The engine no longer exposes dynamic public roots (`tenantList`, generated `createTenant`, etc.) on the tenant model — same pattern as hidden app users.

| MCP tool | Engine GraphQL | Notes |
|----------|----------------|-------|
| `list_tenants` | `getTenants` | Unbounded full list — avoid on large catalogs |
| **`search_tenants`** | **`searchTenants`** | Paginated + optional `q` (name, id, domain, data) + optional `status` (`active`, `deleted`, `all`) — **primary catalog search** |
| `create_tenant` | `createTenant` | Creates `pro_tenants` + mirrored project tenant row |
| `update_tenant` | `updateTenant` | Catalog row only |
| `delete_tenant` | `deleteTenant` | **Soft delete** (`status=deleted`); content and mirror remain. Hard delete is Console-only (`hardDeleteTenant` + impact preview) — **not** an MCP tool |
| `generate_tenant_token` | `generateTenantToken` | Sensitive |
| `search_tenant_by_domain` | `searchTenantsByDomain` | Exact domain match |

**Do not** use `get_data` / `list_data` for tenant lifecycle (create, update, delete, or catalog counts). Mirror rows via `get_data` are for debugging/legacy inspection only.

## App auth users (core + pro)

| MCP tool | Engine GraphQL | Notes |
|----------|----------------|-------|
| **`search_app_users`** | **`searchUsers`** | Optional `tenant_id`, **`q`** (email, username, phone, id) |
| `create_app_user` | `createUser` | |
| `update_app_user` | `updateUser` | |
| `delete_app_user` | `deleteUser` | |
| `login_app_user` | `loginUser` | Returns JWT — sensitive |

Console **Users** tab uses the same `searchUsers` API as `search_app_users`.

## Tenant SaaS plans (core)

Permission ceiling + quotas assigned to tenants via `plan_tier` slug. Same GraphQL as Console Plans settings.

| MCP tool | Engine GraphQL | Notes |
|----------|----------------|-------|
| `list_plans` | `getProjectPlans` | Requires `plans.read` |
| `upsert_plan` | `upsertPlanToProject` | Requires `plans.write`; `id` = slug (`free` / `paid` / `paid_plus` / `ultra`) |

`api_permissions` intersect with the app-user role at request time. `quotas.max_records.<model>` is enforced on create.

## Parity checklist (engine release)

When engine adds/changes system GraphQL ops, update:

1. `src/graphql/*.ts`
2. `src/platform-tools.ts` + `platform-handlers.ts`
3. `CHANGELOG.md`, `.knowledge/features/mcp-platform-tools.md`
4. `test-tenant-users.ts`

Last Updated: 2026-08-10
