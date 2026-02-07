# Plan: Apito Dynamic Query Structure for MCP Users

## Problem

Apito's **project GraphQL API** is dynamically generated from models. For each model (e.g. `Task`), the engine creates specific query and mutation operations. MCP users have no way to discover or understand this structure—what to call, what arguments to pass, or how operation names are derived.

## Apito Query Structure Convention

For a model named `ModelName` (PascalCase):

| Operation Type | GraphQL Name | Description |
|----------------|--------------|-------------|
| **Get by ID** | `modelName(_id)` | Single record by ID |
| **List** | `modelNameList` | Paginated list with `where`, `sort`, `page`, `limit`, etc. |
| **Count** | `modelNameListCount` | Count with filters |
| **Create** | `createModelName` | Create one record |
| **Update** | `updateModelName` | Update one record |
| **Delete** | `deleteModelName` | Delete one or more records |
| **Upsert** | `upsertModelNameList` | Bulk create/update |

**CamelCase matters.** The model `Task` becomes `task`, `taskList`, `createTask`, `updateTask`, `deleteTask`, `upsertTaskList`.

---

## 0. Response Structure (CRITICAL)

**Every Apito document has a fixed shape.** User-defined fields are **never** at the root—they live under `data`.

### Document Shape

| Field | Type | Description |
|-------|------|--------------|
| `id` | String | Document ID (at root level) |
| `data` | Object | **All user-defined fields go here** (title, slug, name, etc.) |
| `meta` | Object | System metadata (created_at, updated_at, created_by, etc.) |
| `relation_doc_id` | String | (optional) Related document ID |

### Correct Query Shape

```graphql
query {
  categoryList(where: {}, sort: {}, relation: {}, page: 1, limit: 10) {
    id
    data {
      name
      slug
    }
    meta {
      created_at
      updated_at
    }
    # has_many: list of related records
    taskList {
      id
      data { name }
    }
    # has_one: single related record
    parentCategory {
      id
      data { name }
    }
  }
}
```

### WRONG (do not use)

```graphql
# ❌ User fields at root - Apito does NOT work this way
articleList {
  id
  title
  slug
  excerpt
  category { id name }
  author { id name }
}
```

### RIGHT (always use)

```graphql
# ✅ User fields under data, relations have id + data
articleList(limit: 20) {
  id
  data {
    title
    slug
    excerpt
    content
    publishedat
    seotitle
    seodescription
  }
  meta {
    created_at
    updated_at
  }
  category {
    id
    data { name slug }
  }
  author {
    id
    data { name bio }
  }
  commentList(limit: 20) {
    id
    data { commnet }
    meta { created_at }
  }
}
```

---

## 1. The `where` Parameter (Filtering)

The `where` argument on list and count queries accepts an object keyed by **field names**. Each field can use filter operators (schema-specific; available operators depend on the field type).

### General Structure

```graphql
modelNameList(where: {
  fieldName: { eq: "value" }
  anotherField: { in: ["a", "b"] }
  OR: [
    { fieldA: { eq: "x" } }
    { fieldB: { ne: "y" } }
  ]
})
```

### Field-Level Filter Operators (by Input Type)

| Input Type | Operators | Example |
|------------|-----------|---------|
| **string** (text, multiline) | `eq`, `ne`, `in`, `not_in`, `contains` | `{ name: { contains: "foo" } }` |
| **string** (date) | `eq`, `ne`, `before`, `after`, `between` | `{ dueDate: { after: "2024-01-01" } }` |
| **string** (list/dropdown) | `eq`, `ne`, `in` or `in`, `not_in` | `{ status: { eq: "active" } }` |
| **int** | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `between`, `in`, `not_in` | `{ progress: { gte: 50 } }` |
| **double** | `eq`, `ne`, `lt`, `lte`, `gt`, `gte` | `{ price: { gt: 10.5 } }` |
| **bool** | `eq`, `ne` | `{ isActive: { eq: true } }` |
| **geo** | `geo_within` | `{ location: { geo_within: { lat: 0, lon: 0, km_radius: 10 } } }` |
| **object** / **repeated** | Nested subfields (same operators per subfield type) | `{ address: { city: { eq: "NYC" } } }` |

### Logical Operators

- **OR**: Array of where conditions; any match returns the record.
- **AND** (implicit): Multiple top-level field conditions are ANDed together.

### Special Top-Level Filters

- **`_key`**: Filter by document `_key` IDs. When used, the rest of `where` is ignored.
  - `eq`, `ne`, `in` (list of strings)

```graphql
taskList(_key: { in: ["key1", "key2"] })
```

### What Is NOT Possible

- Arbitrary SQL-like expressions
- Full-text search across all fields (only `contains` on string fields)
- Cross-model filters in a single `where` (use `relation` for that)

---

## 2. Connection Queries (Relations)

Relations are **bidirectional**. Each model declares connections to other models. The schema exposes:

- **has_one**: One related record (e.g. author → profile)
- **has_many**: Multiple related records (e.g. author → books)

### How to Query Connections

**In a query**, you select related fields by name. The name comes from the connection's `model` or `known_as`:

- **has_one**: Field name is the related model (or `known_as`). Returns a single object.
- **has_many**: Field name is plural (e.g. `categoryList`, `taskCategoryList`). Returns a list and supports **list args** (`where`, `page`, `limit`, `sort`, `relation`, `connection`).

### Example: Author ↔ Book

If `Author` has many `Book` and `Book` has one `Author`:

```graphql
query {
  authorList {
    id
    data { name }
    # has_one: single related record
    profile { id data { ... } }
    # has_many: list of related records, with list args
    bookList(where: { title: { contains: "API" } }, page: 1, limit: 10) {
      id
      data { title }
    }
  }
}
```

From the other side (Book):

```graphql
query {
  bookList {
    id
    data { title }
    # has_one back to Author
    author { id data { name } }
  }
}
```

### Relation Filter (`relation`)

To filter a list by conditions on **related** models, use `relation`:

```graphql
taskList(relation: {
  category: { name: { eq: "urgent" } }
})
```

This returns tasks whose related category has `name = "urgent"`. The keys under `relation` are the **related model names** (or `known_as`).

### Connection Filter (`connection`)

Use `connection` when you want to constrain the query by connection metadata:

- `connection_type`: `forward` | `backward`
- `_id`: ID of the document to start from
- `to_model`: Target model (enum of connected models)
- `relation_type`: `has_one` | `has_many`

```graphql
taskList(connection: {
  _id: "author_id_here"
  connection_type: backward
  to_model: task
  relation_type: has_many
})
```

This returns tasks connected to the given author via the specified relation.

### What Is Possible

- Traverse relations in queries (nested selection)
- Filter list by related model conditions (`relation`)
- Filter by connection metadata (`connection`)
- Paginate and sort on `has_many` lists

### What Is NOT Possible

- Many-to-many relations without an intermediate model
- Arbitrary joins across unrelated models
- Filtering by nested relation depth beyond one level in a single `relation` block

---

## 3. Pagination Parameters

List queries (`modelNameList` and `has_many` connection fields) support:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | Int | 1 | Page number (1-based). |
| `limit` | Int | 10 | Items per page. Use `-1` to skip pagination (return all). |
| `start` | Int | 0 | Alternative offset (used when `page` is not set). |

### How It Works

- `page: 1, limit: 10` → first 10 items
- `page: 2, limit: 10` → items 11–20
- `limit: -1` → no limit (all matching items; use with care)

### Sort

```graphql
modelNameList(sort: { fieldName: ASC, anotherField: DESC })
```

- Keys: field names
- Values: `ASC` or `DESC`
- Default sort when none given: `meta.updated_at DESC`

---

## 4. Full Query Reference

### `modelName(_id: String!)`

Single record by ID.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `_id` | String | Yes | Document ID |

### `modelNameList`

Paginated list.

| Arg | Type | Description |
|-----|------|-------------|
| `where` | `{Model}LIST_INPUT_WHERE_PAYLOAD` | Field filters, `OR`, `_key` |
| `page` | Int | Page number |
| `limit` | Int | Page size |
| `local` | Enum | Locale (e.g. `en`) |
| `status` | Enum | `all`, `draft`, `published` |
| `_key` | Object | Direct key filter (`eq`, `ne`, `in`) |
| `connection` | Object | Connection filter |
| `relation` | Object | Filter by related model conditions |
| `sort` | Object | Sort by field |
| `groupBy` | List | Aggregation (key/value pairs) |

### `modelNameListCount`

Count with same filters as list (no `page`/`limit`).

---

## 5. Full Mutation Reference

### `createModelName`

| Arg | Type | Description |
|-----|------|-------------|
| `payload` | Object | Field values for the new record |
| `local` | Enum | Locale |
| `status` | Enum | `draft` or `published` |
| `connect` | Object | Relation IDs, e.g. `{ category_id: "…", tag_ids: ["…"] }` |

### `updateModelName`

| Arg | Type | Description |
|-----|------|-------------|
| `_id` | String | Document ID |
| `payload` | Object | Fields to update |
| `local` | Enum | Locale |
| `status` | Enum | `draft` or `published` |
| `connect` | Object | IDs to connect |
| `disconnect` | Object | IDs to disconnect |
| `keepRevision` | Boolean | Keep revision history |
| `deltaUpdate` | Boolean | Partial update behavior |

### `deleteModelName`

| Arg | Type | Description |
|-----|------|-------------|
| `_ids` | [String] | List of document IDs to delete |

### `upsertModelNameList`

| Arg | Type | Description |
|-----|------|-------------|
| `payloads` | [Object] | Array of records (create/update by ID) |
| `local` | Enum | Locale |
| `status` | Enum | `draft` or `published` |

---

## 6. Apito System: What Is Possible vs Not

### Possible

- CRUD on all models with role permissions
- Filter by any scalar field with type-appropriate operators
- `OR` / `AND` logic in `where`
- Pagination with `page`, `limit`; `limit: -1` for no limit
- Sorting by any sortable field
- Aggregation via `groupBy` on list queries
- Querying relations (has_one, has_many) via nested selection
- Filtering by related model (`relation`) or connection (`connection`)
- Locale-aware content (`local`)
- Draft/published status (`status`: `all`, `draft`, `published`)
- Direct key filtering (`_key`)
- Connect/disconnect relations in create/update
- Bulk upsert via `upsertModelNameList`

### Not Possible

- Arbitrary raw queries or SQL
- Cross-model filters without a defined relation
- Recursive or unbounded graph traversal
- Full-text search across all fields (only `contains` per field)
- Custom aggregation functions beyond `groupBy`
- Transactions spanning multiple mutations
- Querying system/internal tables directly
- Changing schema via project API (use system API / apito-mcp)

---

## Implementation Plan

### Phase 1: Static Documentation (Done)

1. **Resource `apito://project-query-guide`** – Static MCP resource describing the convention.
2. **README section** – Add "Apito Project Query Structure" to README.

### Phase 2: Dynamic Tool (Done)

3. **Tool `get_project_query_structure`** – Uses `list_models` / `getProjectModelsInfo` to derive operations per model and return a mapping.

### Phase 3: Optional Enhancements (Future)

4. **Project GraphQL introspection** – If the project endpoint is available, introspect `__schema` and return actual operations (validates convention).
5. **`query_project` / `mutate_project` tools** – Execute project queries/mutations (requires project endpoint and auth).

---

## Naming Rules

- **Model name** (PascalCase): `Task`, `DentalAssessment`, `Category`
- **Singular camelCase**: First letter lowercase → `task`, `dentalAssessment`, `category`
- **List**: Append `List` → `taskList`, `dentalAssessmentList`, `categoryList`
- **Count**: Append `ListCount` → `taskListCount`, `dentalAssessmentListCount`
- **Mutations**: Prefix `create`, `update`, `delete`, `upsert` + ModelName → `createTask`, `updateTask`, `deleteTask`, `upsertTaskList`

## Where to Call Project API

- **Endpoint**: `https://api.apito.io/secured/graphql` (or project-specific URL)
- **Auth**: Same API key as system (project-scoped)
- **Note**: apito-mcp currently uses `/system/graphql` for schema management. Project queries/mutations use `/secured/graphql`.
