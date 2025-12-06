# Apito MCP Server

A Model Context Protocol (MCP) server for [Apito](https://apito.io) - an API builder and headless CMS. This server enables LLMs like Claude to interact with Apito's system GraphQL API to create models, manage fields, and build schemas.

## Features

- **Model Management**: Create, list, and query models in your Apito project
- **Field Management**: Add, update, and rename fields with intelligent type detection
- **Schema Creation**: Parse and create complete schemas from field definitions
- **Resources**: Expose model schemas as MCP resources for easy access
- **Prompts**: Interactive prompts for handling ambiguous field types
- **Error Handling**: Comprehensive error handling with detailed messages

## Installation

```bash
npm install
```

## Configuration

Set the following environment variables:

- `APITO_API_KEY` or `APITO_AUTH_TOKEN` (required): Your Apito API key (starts with `ak_`)
- `APITO_GRAPHQL_ENDPOINT` (optional): GraphQL endpoint (defaults to `https://api.apito.io/secured/graphql`)

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
# Set secrets
wrangler secret put APITO_AUTH_TOKEN
# Or use APITO_API_KEY
wrangler secret put APITO_API_KEY

# Deploy
npm run deploy
```

## MCP Tools

### `create_model`

Create a new model in Apito.

**Arguments:**

- `model_name` (required): Name of the model
- `single_record` (optional): Whether this is a single-record model

### `add_field`

Add a field to an existing model.

**Arguments:**

- `model_name` (required): Name of the model
- `field_definition` (required): Field definition string
  - Simple: `"date"`
  - Object: `"chief_complaint { complaint duration unit location }"`
  - Array: `"items[]"` or `"repeated items"`
- `field_type` (optional): Override detected field type
- `input_type` (optional): Override detected input type
- `parent_field` (optional): For nested fields
- `field_description` (optional): Field description
- `validation` (optional): Validation rules

### `create_schema_from_definition`

Create a complete model with all fields from a schema definition.

**Arguments:**

- `model_name` (required): Name of the model
- `field_definitions` (required): Array of field definition strings
- `single_record` (optional): Whether this is a single-record model

**Example:**

```javascript
{
  "model_name": "dentalAssessment",
  "field_definitions": [
    "date",
    "chief_complaint { complaint duration unit location }",
    "medical_dental_history { past_diseases medications allergies }",
    "medicine { unit name instruction duration frequency strength }"
  ]
}
```

### `update_field`

Update an existing field.

### `rename_field`

Rename a field in a model.

### `list_models`

List all models in the current project.

### `get_model_schema`

Get the complete schema for a model.

## MCP Resources

Model schemas are exposed as resources with URIs:

- `apito://model/{modelName}` - Access model schema as JSON

## Field Type Detection

The server intelligently detects field types from field names:

- **Date fields**: `date`, `time`, `created_at`, `updated_at`, `timestamp`
- **Number fields**: `count`, `number`, `quantity`, `amount`, `price`, `duration`, `frequency`
- **Boolean fields**: `is_*`, `has_*`, `can_*`, `active`, `enabled`
- **Multiline fields**: `description`, `content`, `body`, `text`, `notes`
- **Media fields**: `image`, `photo`, `logo`, `file`, `media`
- **URL fields**: `url`, `link`, `website`

For ambiguous cases, the server will prompt for clarification.

## Example: Creating a Dental Assessment Model

```javascript
{
  "tool": "create_schema_from_definition",
  "arguments": {
    "model_name": "dentalAssessment",
    "field_definitions": [
      "date",
      "chief_complaint { complaint duration unit location }",
      "medical_dental_history { past_diseases medications allergies habits previous_dental_treatments family_dental_history other_medical_conditions }",
      "extra_oral_examination { face_symmetry jaw_joint swelling lymph_nodes tmj notes }",
      "intra_oral_soft_tissue { gums tongue cheeks lips soft_palate pharynx oral_mucosa notes }",
      "hard_tissue_examination { cavities fractures alignment bite occlusion missing_teeth restorations mobility notes }",
      "periodontal_assessment { pocket_depth bleeding plaque bone_loss gingival_recession mobility notes }",
      "radiographic_assessment { bitewing periapical opg cbct findings date recommendations }",
      "diagnostic_tests { vitality percussion mobility occlusion other_tests notes }",
      "diagnosis { primary_diagnosis secondary_diagnosis }",
      "treatment_planning { scaling filling rct extraction braces implants other notes }",
      "medicine { unit name instruction duration frequency strength }",
      "advice",
      "investigations",
      "prescription_diagnosis"
    ]
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
2. **Field Definitions**: Use clear, descriptive names for better type detection
3. **Object Fields**: Use `{ nested fields }` syntax for nested objects
4. **Arrays**: Mark arrays with `[]` suffix or `repeated` keyword
5. **Validation**: Specify validation rules when creating fields

## License

MIT
