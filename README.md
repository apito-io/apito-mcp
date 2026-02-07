# Apito MCP Server

A Model Context Protocol (MCP) server for [Apito](https://apito.io) - an API builder and headless CMS. This server enables LLMs like Claude to interact with Apito's system GraphQL API to create models, manage fields, and build schemas.

## Features

- **Model Management**: Create, list, query, and delete models in your Apito project
- **Field Management**: Add, update, rename, and delete fields with explicit type specification
- **Relation Management**: Create relations between models (has_one, has_many)
- **Full Field Type Support**: All Apito field types including text, multiline, number, date, boolean, media, object, repeated, list (with sub-types), and geo
- **Resources**: Expose model schemas as MCP resources for easy access
- **Error Handling**: Comprehensive error handling with detailed messages
- **Cloudflare Workers**: Deploy as a remote MCP server for use with any MCP client
- **Project-Dependent API Keys**: API keys are passed per-request, allowing different projects to use the same worker

## Installation

```bash
npm install
```

## Configuration

### Local (STDIO) Mode

Set the following environment variables:

- `APITO_API_KEY` or `APITO_AUTH_TOKEN` (required): Your Apito API key (starts with `ak_`)
- `APITO_GRAPHQL_ENDPOINT` (optional): GraphQL endpoint (defaults to `https://api.apito.io/system/graphql` for system queries)

### Remote (Cloudflare Workers) Mode

The API key is **not** stored as a Cloudflare Worker secret. Instead, it must be passed per-request via:
- `Authorization: Bearer <key>` header
- `X-Apito-Key: <key>` header  
- `?api_key=<key>` query parameter

The `APITO_GRAPHQL_ENDPOINT` is optional and defaults to `https://api.apito.io/system/graphql`. It can be set as a Cloudflare Worker secret if you need to override the default.

## Usage

### STDIO Mode (Local)

Run the server locally using stdio transport:

```bash
APITO_API_KEY=your-api-key-here npx tsx src/index.ts
```

Or with environment file:

```bash
# Create .env file
echo "APITO_API_KEY=your-api-key-here" > .env
echo "APITO_GRAPHQL_ENDPOINT=https://api.apito.io/secured/graphql" >> .env

# Run
npx tsx src/index.ts
```

### Cloudflare Workers (Remote)

Deploy to Cloudflare Workers for remote access:

```bash
# Deploy (API key is passed per-request, not stored as secret)
npm run deploy

# Optional: Set GraphQL endpoint secret if you need to override the default
npx wrangler secret put APITO_GRAPHQL_ENDPOINT --env production
```

**Important**: The `APITO_API_KEY` is **not** stored as a Cloudflare Worker secret. It must be provided by the MCP client in each request via headers or query parameters. This allows the same worker to serve multiple projects with different API keys.

### MCP Client Configuration (Cursor / mcp-remote)

Add the apito-mcp server to your MCP client config (e.g. Cursor `~/.cursor/mcp.json` or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "apito-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://apito-mcp.apito.workers.dev/sse",
        "--header",
        "X-Apito-Key:${APITO_API_KEY}"
      ],
      "env": {
        "APITO_API_KEY": "ak_your-api-key-here"
      }
    }
  }
}
```

Replace `ak_your-api-key-here` with your Apito API key. The `X-Apito-Key` header is sent with each request to the remote worker.

## MCP Tools

### `create_model`

Create a new model in Apito.

**Arguments:**

- `model_name` (required): Name of the model
- `single_record` (optional): Whether this is a single-record model

### `add_field`

Add a field to an existing model. You must specify `field_type` and `input_type` explicitly.

**Arguments:**

- `model_name` (required): Name of the model
- `field_label` (required): Label/name of the field
- `field_type` (required): Field type (see valid combinations below)
- `input_type` (required): Input type (see valid combinations below)
- `field_sub_type` (optional): Required for `list` fields. Valid values: `dynamicList`, `dropdown`, `multiSelect`
- `parent_field` (optional): Parent field name for nested fields
- `is_object_field` (optional): Whether this field can contain nested fields (auto-set for `object` and `repeated` types)
- `field_description` (optional): Field description
- `validation` (optional): Validation rules (see below for requirements)
- `serial` (optional): Serial number for field ordering

**Valid Field Type Combinations:**

- **Text Field**: `field_type="text"`, `input_type="string"` - Single line text input
- **Rich Text Field**: `field_type="multiline"`, `input_type="string"` - Multiline editor with formatting
- **DateTime Field**: `field_type="date"`, `input_type="string"` - Date & Time input
- **Dynamic Array**: `field_type="list"`, `field_sub_type="dynamicList"`, `input_type="string"` - Flexible list allowing multiple items
- **Dropdown Menu**: `field_type="list"`, `field_sub_type="dropdown"`, `input_type="string"` - Predefined list for single selection
  - **REQUIRES**: `validation.fixed_list_elements` (array of strings) and `validation.fixed_list_element_type="string"`
- **Multi-Checkbox Selector**: `field_type="list"`, `field_sub_type="multiSelect"`, `input_type="string"` - Allows selecting multiple options
  - **REQUIRES**: `validation.fixed_list_elements` (array of strings) and `validation.fixed_list_element_type="string"`
- **Boolean Field**: `field_type="boolean"`, `input_type="bool"` - True or False toggle
- **File Upload**: `field_type="media"`, `input_type="string"` - Upload images or files
- **Integer Field**: `field_type="number"`, `input_type="int"` - Whole numbers only
- **Decimal Field**: `field_type="number"`, `input_type="double"` - Decimal numbers
- **GeoPoint Field**: `field_type="geo"`, `input_type="geo"` - Latitude & Longitude
- **Object Schema**: `field_type="object"`, `input_type="object"`, `is_object_field=true` - Single object with multiple fields
- **Array Schema**: `field_type="repeated"`, `input_type="repeated"`, `is_object_field=true` - List of objects with multiple fields

**Example - Simple Field:**

```json
{
  "model_name": "dentalAssessment",
  "field_label": "Date",
  "field_type": "date",
  "input_type": "string"
}
```

**Example - Dropdown Field:**

```json
{
  "model_name": "dentalAssessment",
  "field_label": "Status",
  "field_type": "list",
  "field_sub_type": "dropdown",
  "input_type": "string",
  "validation": {
    "fixed_list_elements": ["active", "inactive", "pending"],
    "fixed_list_element_type": "string"
  }
}
```

**Example - Nested Object Field:**

```json
{
  "model_name": "dentalAssessment",
  "field_label": "Chief Complaint",
  "field_type": "object",
  "input_type": "object",
  "is_object_field": true
}
```

Then add nested fields with `parent_field="chief_complaint"`:

```json
{
  "model_name": "dentalAssessment",
  "field_label": "Complaint",
  "field_type": "text",
  "input_type": "string",
  "parent_field": "chief_complaint"
}
```

### `update_field`

Update an existing field in a model.

**Arguments:**

- `model_name` (required): Name of the model
- `field_name` (required): Identifier of the field to update
- `field_label` (required): New label for the field
- `field_type` (optional): New field type
- `input_type` (optional): New input type
- `field_description` (optional): New description
- `validation` (optional): Updated validation rules

### `rename_field`

Rename a field in a model.

**Arguments:**

- `model_name` (required): Name of the model
- `field_name` (required): Current field identifier
- `new_name` (required): New field identifier
- `parent_field` (optional): Parent field name if this is a nested field

### `delete_field`

Delete a field from a model.

**Arguments:**

- `model_name` (required): Name of the model
- `field_name` (required): Field identifier to delete
- `parent_field` (optional): Parent field name if this is a nested field

### `delete_model`

Delete a model from the project. This will also delete all data in the model.

**Arguments:**

- `model_name` (required): Name of the model to delete

### `list_models`

List all models in the current project.

**Arguments:** None

### `get_model_schema`

Get the complete schema for a model including all fields and their types.

**Arguments:**

- `model_name` (required): Name of the model to get schema for

### `get_project_query_structure`

Get the Apito project GraphQL query structure: which operations exist for each model. Apito uses a consistent naming convention: for model `Task` you get `task(_id)`, `taskList`, `taskListCount`, `createTask`, `updateTask`, `deleteTask`, `upsertTaskList`. **CamelCase matters** — model names are converted to camelCase for operation names.

Use this tool when you need to know what GraphQL operations to call for querying or mutating project data. The schema is dynamic per project, so call this early to discover available operations.

**Arguments:** None

**Returns:** A mapping of each model to its operations:
- **Queries:** `{singular}(_id)` (single by ID), `{singular}List` (paginated list), `{singular}ListCount` (count)
- **Mutations:** `create{Model}`, `update{Model}`, `delete{Model}`, `upsert{Model}List`

### `add_relation`

Create a relation between two models. Relations define how models are connected (e.g., a Patient has many DentalAssessments, or a DentalAssessment belongs to one Patient).

**Arguments:**

- `from_model` (required): Source model name (the model that will have the relation field)
- `to_model` (required): Target model name (the model being related to)
- `forward_connection_type` (required): Forward relation type from source to target. Valid values: `"has_many"` (one-to-many) or `"has_one"` (one-to-one)
- `reverse_connection_type` (required): Reverse relation type from target back to source. Valid values: `"has_many"` (one-to-many) or `"has_one"` (one-to-one)
- `known_as` (optional): Optional alternate identifier for this relation (custom name for the relation field)

**Example:**

```json
{
  "tool": "add_relation",
  "arguments": {
    "from_model": "dentalAssessment",
    "to_model": "patient",
    "forward_connection_type": "has_many",
    "reverse_connection_type": "has_one",
    "known_as": "assessments"
  }
}
```

This creates:
- Forward: `dentalAssessment` has many `patient`
- Reverse: `patient` has one `dentalAssessment`

## MCP Resources

Model schemas and the query structure guide are exposed as resources with URIs:

- `apito://project-query-guide` - Apito query structure: naming, `where` filters, connections (relations), pagination, mutations, and what is possible vs not
- `apito://model/{modelName}` - Access model schema as JSON

## Field Type Reference

### Available Field Types

- `text` - Single line text input
- `multiline` - Multiline editor with formatting
- `number` - Number field (use `int` or `double` input_type)
- `date` - Date & Time input
- `boolean` - True or False toggle
- `media` - File upload
- `object` - Single object with multiple fields
- `repeated` - Array of objects with multiple fields
- `list` - List field (requires `field_sub_type`)
- `geo` - GeoPoint (latitude & longitude)

### Available Input Types

- `string` - String value
- `int` - Integer number
- `double` - Decimal number
- `bool` - Boolean value
- `geo` - Geographic coordinates
- `object` - Object structure
- `repeated` - Array structure

### List Field Sub Types

When using `field_type="list"`, you must specify `field_sub_type`:

- `dynamicList` - Dynamic Array (flexible list allowing multiple items)
- `dropdown` - Dropdown Menu (predefined list for single selection)
  - Requires: `validation.fixed_list_elements` and `validation.fixed_list_element_type="string"`
- `multiSelect` - Multi-Checkbox Selector (allows selecting multiple options)
  - Requires: `validation.fixed_list_elements` and `validation.fixed_list_element_type="string"`

## Example: Creating a Dental Assessment Model

The MCP server provides basic CRUD operations. The LLM should parse schema definitions and call the appropriate tools. Here's how an LLM would create a dental assessment model:

1. **Create the model:**

```json
{
  "tool": "create_model",
  "arguments": {
    "model_name": "dentalAssessment"
  }
}
```

2. **Add fields one by one:**

```json
{
  "tool": "add_field",
  "arguments": {
    "model_name": "dentalAssessment",
    "field_label": "Date",
    "field_type": "date",
    "input_type": "string"
  }
}
```

3. **Add object field:**

```json
{
  "tool": "add_field",
  "arguments": {
    "model_name": "dentalAssessment",
    "field_label": "Chief Complaint",
    "field_type": "object",
    "input_type": "object",
    "is_object_field": true
  }
}
```

4. **Add nested fields:**

```json
{
  "tool": "add_field",
  "arguments": {
    "model_name": "dentalAssessment",
    "field_label": "Complaint",
    "field_type": "text",
    "input_type": "string",
    "parent_field": "chief_complaint"
  }
}
```

## Development

```bash
# Type check
npm run typecheck

# Build
npm run build

# Development mode (Cloudflare)
npm run dev
```

## Error Handling

The server provides detailed error messages including:

- GraphQL error codes and paths
- Validation errors
- Network errors
- Field type ambiguity warnings

All errors are logged to stderr (important for STDIO servers).

## Best Practices

1. **Model Names**: Avoid reserved names (`list`, `user`, `system`, `function`)
2. **Explicit Types**: Always specify `field_type` and `input_type` explicitly - don't rely on automatic detection
3. **List Fields**: For dropdown and multiSelect, always provide `validation.fixed_list_elements` and `validation.fixed_list_element_type`
4. **Nested Fields**: Set `is_object_field=true` for `object` and `repeated` field types
5. **Parent Fields**: Use `parent_field` parameter when adding nested fields to object or repeated fields
6. **API Keys**: For remote deployments, API keys are project-dependent and must be provided per-request, not stored as Cloudflare secrets
7. **Relations**: Use `add_relation` to create bidirectional relationships between models

## Using with MCP Clients

### Cursor IDE

Add to `~/.cursor/mcp.json`:

**Local (STDIO):**

```json
{
  "mcpServers": {
    "apito": {
      "command": "npx",
      "args": [
        "tsx",
        "/Users/your-username/Projects/apito/apito-mcp/src/index.ts"
      ],
      "env": {
        "APITO_API_KEY": "your-api-key-here",
        "APITO_GRAPHQL_ENDPOINT": "https://api.apito.io/system/graphql"
      }
    }
  }
}
```

**Remote (Cloudflare Workers):**

```json
{
  "mcpServers": {
    "apito-production": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://apito-mcp.apito.workers.dev/sse",
        "--header",
        "X-Apito-Key:${APITO_API_KEY}"
      ],
      "env": {
        "APITO_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Note**: The API key is passed via the `X-Apito-Key` header using the `--header` flag. The `env.APITO_API_KEY` environment variable is automatically substituted by `mcp-remote`.

Restart Cursor after configuration.

### VS Code

Install the [MCP extension](https://marketplace.visualstudio.com/items?itemName=modelcontextprotocol) and configure in settings:

```json
{
  "mcp.servers": {
    "apito": {
      "command": "npx",
      "args": ["tsx", "/path/to/apito-mcp/src/index.ts"],
      "env": {
        "APITO_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "apito": {
      "command": "npx",
      "args": ["tsx", "/path/to/apito-mcp/src/index.ts"],
      "env": {
        "APITO_API_KEY": "your-api-key-here",
        "APITO_GRAPHQL_ENDPOINT": "https://api.apito.io/system/graphql"
      }
    }
  }
}
```

### ChatGPT / OpenAI

ChatGPT doesn't directly support MCP, but you can use the remote Cloudflare Workers endpoint via HTTP/SSE. You'll need to use an MCP proxy or client library.

### Other MCP Clients

Any MCP-compatible client can connect to:

- **Local**: STDIO transport via `npx tsx src/index.ts`
- **Remote**: SSE transport via `https://apito-mcp.apito.workers.dev/sse` (requires `mcp-remote` proxy)

### Environment Variables

**For Remote Deployments (Cloudflare Workers):**

The API key is **not** stored as a Cloudflare Worker secret. It must be provided by the MCP client in each request. This allows the same worker to serve multiple projects.

Optional: Set GraphQL endpoint secret if you need to override the default:

```bash
# Set GraphQL endpoint (optional, defaults to https://api.apito.io/system/graphql)
npx wrangler secret put APITO_GRAPHQL_ENDPOINT --env production
```

**For Local Deployments (STDIO):**

Set environment variables in your MCP client configuration (see examples above).

### Testing the Connection

You can test the MCP server connection using the MCP Inspector or by checking if tools are available in your client. The server should expose:

- `create_model`
- `add_field`
- `update_field`
- `rename_field`
- `delete_field`
- `delete_model`
- `list_models`
- `get_model_schema`
- `get_project_query_structure`
- `add_relation`

## License

MIT
