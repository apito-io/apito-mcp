---
type: feature
title: MCP Logic functions lifecycle
description: Author, test, deploy, and invoke Deno/TS Logic functions over system GraphQL + REST callable
tags: [apito-mcp, functions, logic, deno, deploy, graphql, rest]
timestamp: 2026-07-16T00:00:00Z
---

# MCP Logic functions lifecycle

Full author → test → deploy → invoke loop for the Logic Functions Workspace, reusing the engine ops shipped in open-core. No new engine GraphQL. See the ecosystem doc [`apito/.knowledge/features/logic-functions-workspace.md`](../../../.knowledge/features/logic-functions-workspace.md) for the platform design.

## Tool matrix

| MCP tool | Engine op | Notes |
|----------|-----------|-------|
| `list_functions` | `projectFunctionsInfo` | Returns `source`, `capabilities`, `active_revision_id`, `trigger_type`, `runtime_config`, `rest_api_secret_url_key`. Optional `name` filter. |
| `upsert_function` | `upsertFunctionToProject` | Saves **draft**. Args: `source`, `capabilities[]`, `language`, `trigger_type`, `runtime`, `graphql_schema_type`, `update`. |
| `delete_function` | `deleteFunctionFromProject` | |
| `test_function_draft` | `testFunctionDraft` | Admin draft test (project admin). Optional admin-selected `tenant_id` validated server-side. No `X-Fn-Hash` / app-user JWT. |
| `deploy_function` | `deployFunctionToProject` | Publishes draft as immutable revision; sets `active_revision_id`. |
| `execute_function` | REST `POST /function/:project/:name` | Runs **active revision**. Sends `X-Fn-Hash` + SaaS `Authorization: Bearer` app-user JWT. Tenant from JWT claims only. |
| `list_function_revisions` | `listFunctionRevisions` | |
| `list_function_deployments` | `listFunctionDeployments` | |
| `rollback_function` | `rollbackFunctionDeployment` | Re-activates a prior revision by `revision_id`. |

All tools are `[core]` — Logic is open-core.

## Draft vs deployed

- `upsert_function` + `test_function_draft` operate on the **draft** source (live edits, no revision created).
- `deploy_function` creates a new immutable revision from the draft and marks it active.
- `execute_function` always runs the **active (deployed)** revision — not the draft. It errors if the function was never deployed (`active_revision_id` empty).

## execute_function specifics

- Project id resolved via `currentProject`.
- Secret resolved from the `list_functions` row (`rest_api_secret_url_key`) unless `fn_hash` is passed.
- The secret is **masked** in the tool response (`****abcd`) unless `reveal_secret: true`.
- Sends `X-Fn-Hash` and, when `app_user_token` is set, `Authorization: Bearer <token>`.
- Does **not** send `X-Apito-Tenant-ID`. Caller-supplied `tenant_id` is rejected — use `test_function_draft` for admin draft testing with an explicit tenant.
- `app_user_token` is never echoed in tool output.
- REST base derives from `APITO_GRAPHQL_ENDPOINT` (strips `/system/graphql`); override with `APITO_REST_ENDPOINT`.

## SaaS / tenant context

| Path | Auth | Tenant source |
|------|------|---------------|
| `test_function_draft` | MCP/CLI project admin token | Admin-selected `tenant_id` (validated server-side) |
| `execute_function` (live SaaS) | `X-Fn-Hash` + app-user Bearer JWT | Verified JWT `tenant:<id>` claims only |

## Parity checklist (engine release)

When engine changes function GraphQL/REST, update:

1. `src/graphql/functions.ts`
2. `src/platform-tools.ts` + `src/platform-handlers.ts`
3. `CHANGELOG.md`, this doc, and the features README
4. `test-functions.ts`

Last Updated: 2026-07-18
