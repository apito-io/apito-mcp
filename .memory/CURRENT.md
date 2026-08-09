# apito-mcp — Current

## Now

- **2026-08-09 — v1.7.0 shipped in tree:** Public GraphQL surface tools
  (`get_public_graphql_model_map`, `probe_public_document`), sticky scope
  UX (TTL 1800, sticky lease + default project), `inspect_access_token`
  calling engine `GET /system/access-tokens/me`. Ask before commit/tag/
  deploy worker.

- **Prior:** `rename_model`, `update_field` parent_field, system logs (1.6.0).

## Next

- User confirm → commit mcp + open-core (+ ACCESS_TOKENS.md / consumer doc)
- Restart Cursor MCP after pull; deploy worker if prod lags
- Engine must be rebuilt/deployed for `/me` before inspect works remotely

## Last Updated

2026-08-09
