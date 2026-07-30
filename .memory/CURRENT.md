# apito-mcp — Current

## Now

- **2026-07-28/29:** `update_field` accepts `parent_field` / `field_sub_type`
  (nested dropdown updates; used for Suchok import/order measure units).
  `rename_model` tool (stages via `updateModel(type: rename)`; never
  publishes). Used for Suchok product→category / tag→variant.

- **Planned (not coded):** v1.6 GraphQL surface —
  `get_public_graphql_model_map`, `probe_public_document`, scope sticky
  lease + TTL 1800. Plan:
  `.cursor/plans/improve_apito_mcp_gaps_62f8ec7c.plan.md`.

- **Released v1.5.1 (2026-07-22):** Deep nested `projectModelsInfo` /
  `sub_field_info` + validation fields — parity with CLI sync.

## Next

- User confirm → commit `update_field` / `rename_model` if dirty
- Implement MCP gaps plan when user okays (bump toward 1.6.0)
- Restart Cursor MCP after pull if tools missing

## Last Updated

2026-07-29
