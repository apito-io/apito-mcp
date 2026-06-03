# Changelog

All notable changes to this project are documented in this file.

## [1.1.0] - 2026-06-03

### Added

- **Pro schema versioning**: stage mutations into a draft; MCP never publishes
- Tools: `get_schema_versioning_status`, `get_schema_preview`, `get_effective_schema`, `get_schema_change_plan`, `summarize_schema_draft_for_review`
- `source` parameter on `list_models`, `get_model_schema`, `get_relation_graph` (`live` | `draft` | `effective`)
- `schema-versioning.ts` overlay merge and draft-only model guards for data tools
- Resource `apito://schema-versioning-guide`
- SaaS: `X-Apito-Tenant-ID` on worker requests; stdio `TENANT_ID` / `APITO_TENANT_ID`
- `playground-mcp.ts` and `pnpm playground:mcp` for local MCP tool testing
- `test-schema-versioning.ts` and `pnpm test:versioning`

### Changed

- Schema mutations return staging-aware responses with publish reminders
- `upsert_data` / `get_data` / `delete_data` / `duplicate_data` require published (live) models
- Stdio server only auto-starts when run as main module (playground can import `ApitoMCPServer`)

## [1.0.0] - Initial release

- Model, field, relation, and data CRUD via system GraphQL
- Cloudflare Workers remote MCP deployment
- Content insert / query structure documentation
