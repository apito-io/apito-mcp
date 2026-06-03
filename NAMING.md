# Apito canonical model names

When MCP tools accept a model name, normalize with the same rules as the Apito Engine (`utility.CanonicalizeModelName` in `github.com/apito-io/engine/open-core/utility/apito_naming.go`): **snake_case**, singular, ASCII, with word-boundary requirements for multi-word input.

**GraphQL on the project (public) endpoint** uses **camelCase** operation names derived from the model (e.g. model `Task` → `taskList`, `createTask`). MCP tool arguments stay **canonical snake_case singular** (e.g. `task`) to match the engine; do not pass GraphQL list suffixes like `workList` as a model name for tools.
