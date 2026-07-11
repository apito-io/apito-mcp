# apito-mcp — Knowledge

Part of the **apito** ecosystem. See `/.knowledge/projects/apito.md` for blast radius.

## Read order

1. This file
2. `ARCHITECTURE.md`
3. `features/README.md` → `mcp-platform-tools.md`, `mcp-data-plane.md`
4. `DECISIONS.md`
5. `../.memory/CURRENT.md` and `../.memory/HANDOFF.md`

## Purpose

**apito-mcp** is the Model Context Protocol server for Apito: schema migration, project data plane, and platform admin (tenants, app users, roles, media) via **system GraphQL** (`X-Apito-Key`).

Transports: stdio (Cursor local), Cloudflare Workers SSE (remote).

## Responsibilities

- Schema tools: `create_model`, `add_field`, publish-aware reads (`get_effective_schema`, …)
- Data tools: `get_data`, `upsert_data`, … on **published** models
- Platform tools: tenant catalog, app user CRUD, project admin (`platform-tools.ts`)
- Guides: SaaS auth, schema migration, query structure

## Consumers / blast radius

| Consumer | Impact |
|----------|--------|
| Monorepo `.cursor/mcp.json` | Per-project MCP server configs |
| udbhabon app `.cursor/mcp.json` | kisti, protiva, prottoy, … |
| apito-console-v4 MCP page | Setup docs for tokens + endpoint |
| Engine system GraphQL | MCP must track resolver parity (searchTenants, searchUsers q, …) |

## Related

- Engine: `apito/engine` system GraphQL resolvers
- Admin SDKs: same GraphQL ops as `js-admin-sdk` / `go-admin-sdk`
- Feature: `apito/.knowledge/features/admin-sdk-contract.md`

Last Updated: 2026-07-11
