---
type: feature
title: MCP project scope
description: Fail-closed project routing and project-bound write leases
tags: [apito-mcp, security, project-scope, graphql]
timestamp: 2026-07-21T00:00:00Z
---

# MCP project scope

## Contract

- Canonical project header only: `X-Apito-Project-Id`.
- `APITO_ALLOWED_PROJECT_IDS` is an exact, fail-closed allowlist.
- Optional `APITO_DEFAULT_PROJECT_ID` applies only to reads.
- Optional `APITO_ALLOWED_TENANTS_BY_PROJECT` restricts tenant IDs exactly.
- Every project-scoped GraphQL request carries the resolved project header.
- An explicit GraphQL `project_id` variable must equal the resolved header.

## Write confirmation

`prepare_project_scope` → `confirm_project_scope` produces a cryptographically random,
TTL-bound lease tied to one project and optional tenant. Writes require that lease;
destructive tools also require `confirm_destructive: true`.

There is no mutable current-project selector. Each tool call runs with a call-isolated
GraphQL client and schema context. The Worker cache key includes project and tenant;
the lease store contains project-bound records only.

## Code map

- Policy, metadata, leases, schema decoration: `src/project-scope.ts`
- Call isolation and central resolution: `src/index.ts`
- Canonical request headers: `src/graphql-client.ts`
- Worker forwarding/isolation: `src/worker.ts`
- Tests: `test-project-scope.ts`

Last Updated: 2026-07-21
