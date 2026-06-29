import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ApitoGraphQLClient, type ApitoGraphQLClientOptions, type GraphQLRequestOptions } from './graphql-client.js';
import {
    SchemaVersioningContext,
    detectStagingResponse,
    formatUserPublishReminder,
    buildRelationGraphFromModels,
    type SchemaSource,
} from './schema-versioning.js';
import { getSchemaMigrationGuideContent } from './schema-migration-guide.js';
import { SchemaParser } from './schema-parser.js';
import { FieldResolver } from './field-resolver.js';
import type { ParsedField, ValidationInput, SchemaPreviewSource, ApitoModel } from './types.js';
import { filterToolsByEdition } from './mcp-edition.js';
import { PLATFORM_TOOL_DEFINITIONS } from './platform-tools.js';
import { handlePlatformTool, PLATFORM_TOOL_NAMES } from './platform-handlers.js';
import { getSaasAuthGuideContent } from './guides/saas-auth-guide.js';

const SOURCE_PARAM_SCHEMA = {
    type: 'string',
    description:
        'Schema source: live (published only), draft (staged changeset only), effective (merged live+draft when versioning enabled). Default: effective when versioning has draft, else live.',
    enum: ['live', 'draft', 'effective'],
} as const;

export class ApitoMCPServer {
    private server: Server;
    private client: ApitoGraphQLClient | null = null;
    private graphqlEndpoint: string;
    private authToken: string;
    private graphqlClientOptions: ApitoGraphQLClientOptions;
    private schemaCtx: SchemaVersioningContext | null = null;
    // Store handler references for HTTP transport
    private listToolsHandler?: (request: any) => Promise<any>;
    private callToolHandler?: (request: any) => Promise<any>;
    private listPromptsHandler?: (request: any) => Promise<any>;
    private getPromptHandler?: (request: any) => Promise<any>;
    private listResourcesHandler?: (request: any) => Promise<any>;
    private readResourceHandler?: (request: any) => Promise<any>;

    constructor(
        graphqlEndpoint: string,
        apiKey: string,
        graphqlClientOptions: ApitoGraphQLClientOptions = {}
    ) {
        this.graphqlEndpoint = graphqlEndpoint;
        this.authToken = apiKey;
        this.graphqlClientOptions = graphqlClientOptions;
        this.server = new Server(
            {
                name: 'apito-mcp',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                    prompts: {},
                    resources: {},
                },
            }
        );

        this.setupHandlers();
    }

    getServer(): Server {
        return this.server;
    }

    // Method to manually handle MCP requests (for HTTP transport)
    async handleMCPRequest(request: any): Promise<any> {
        // Handle initialize request
        if (request.method === 'initialize') {
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {},
                        prompts: {},
                        resources: {},
                    },
                    serverInfo: {
                        name: 'apito-mcp',
                        version: '1.0.0',
                    },
                },
            };
        }

        // Route to appropriate handlers based on method
        try {
            if (request.method === 'tools/list') {
                if (this.listToolsHandler) {
                    const result = await this.listToolsHandler({ params: {} } as any);
                    return {
                        jsonrpc: '2.0',
                        id: request.id,
                        result,
                    };
                }
            } else if (request.method === 'tools/call') {
                if (this.callToolHandler) {
                    const result = await this.callToolHandler({ params: request.params } as any);
                    return {
                        jsonrpc: '2.0',
                        id: request.id,
                        result,
                    };
                }
            } else if (request.method === 'prompts/list') {
                if (this.listPromptsHandler) {
                    const result = await this.listPromptsHandler({ params: {} } as any);
                    return {
                        jsonrpc: '2.0',
                        id: request.id,
                        result,
                    };
                }
            } else if (request.method === 'prompts/get') {
                if (this.getPromptHandler) {
                    const result = await this.getPromptHandler({ params: request.params } as any);
                    return {
                        jsonrpc: '2.0',
                        id: request.id,
                        result,
                    };
                }
            } else if (request.method === 'resources/list') {
                if (this.listResourcesHandler) {
                    const result = await this.listResourcesHandler({ params: {} } as any);
                    return {
                        jsonrpc: '2.0',
                        id: request.id,
                        result,
                    };
                }
            } else if (request.method === 'resources/read') {
                if (this.readResourceHandler) {
                    const result = await this.readResourceHandler({ params: request.params } as any);
                    return {
                        jsonrpc: '2.0',
                        id: request.id,
                        result,
                    };
                }
            }

            // Method not found
            return {
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32601,
                    message: `Method not found: ${request.method}`,
                },
            };
        } catch (error: any) {
            return {
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32000,
                    message: error.message || 'Internal error',
                },
            };
        }
    }

    private buildGraphQLClientOptions(): ApitoGraphQLClientOptions {
        if (this.graphqlClientOptions.tenantId || this.graphqlClientOptions.sendTempTenantCookie) {
            return this.graphqlClientOptions;
        }
        const tenantRaw =
            typeof process !== 'undefined'
                ? process.env?.TENANT_ID || process.env?.APITO_TENANT_ID
                : undefined;
        const tenantId = typeof tenantRaw === 'string' ? tenantRaw.trim() : '';
        const sendTemp =
            typeof process !== 'undefined' && process.env?.APITO_MCP_TEMP_TENANT_COOKIE === 'true';
        return {
            tenantId: tenantId || undefined,
            sendTempTenantCookie: sendTemp,
        };
    }

    private getSchemaContext(): SchemaVersioningContext {
        this.ensureClient();
        if (!this.schemaCtx) {
            this.schemaCtx = new SchemaVersioningContext(this.client!);
        }
        return this.schemaCtx;
    }

    private async formatStagingMutationResponse(
        operationLabel: string,
        rawResult: unknown
    ): Promise<string> {
        const staging = detectStagingResponse(rawResult);
        const status = await this.getSchemaContext().getStatus(true);
        if (staging.staged || (status.enabled && status.has_draft)) {
            const reminder = formatUserPublishReminder(status);
            return (
                `**Staged (not published):** ${operationLabel}. ` +
                (staging.message ? staging.message + ' ' : '') +
                `Use get_effective_schema or get_schema_change_plan to verify the draft.` +
                reminder +
                `\n\nEngine response:\n${JSON.stringify(rawResult, null, 2)}`
            );
        }
        return `Successfully applied: ${operationLabel}.\n\n${JSON.stringify(rawResult, null, 2)}`;
    }

    private async resolveSchemaSource(explicit?: string): Promise<SchemaSource> {
        if (explicit === 'live' || explicit === 'draft' || explicit === 'effective') {
            return explicit;
        }
        const status = await this.getSchemaContext().getStatus();
        if (status.enabled && status.has_draft) {
            return 'effective';
        }
        return 'live';
    }

    private ensureClient() {
        if (!this.client) {
            this.client = new ApitoGraphQLClient(
                this.graphqlEndpoint,
                this.authToken,
                this.buildGraphQLClientOptions()
            );
            this.schemaCtx = null;
        }
    }

    private tenantReqOpts(tenantId?: string): GraphQLRequestOptions | undefined {
        const tid = tenantId?.trim();
        return tid ? { tenantId: tid } : undefined;
    }

    private setupHandlers() {
        const platformTools = filterToolsByEdition(PLATFORM_TOOL_DEFINITIONS).map(
            ({ proOnly: _p, ...tool }) => tool
        );

        // List available tools
        this.listToolsHandler = async () => ({
            tools: [
                {
                    name: 'create_model',
                    description:
                        'Create a new model. On pro engines with schema versioning, this **stages** a draft (not published). Verify with get_effective_schema; user must publish in Console → Schema Changes before data tools work. **SaaS:** For project-wide data shared by all tenants (no tenant isolation), set `is_common_model: true` — see `get_saas_model_guide` or resource `apito://saas-model-guide`. Default (omit or false) = tenant-scoped model.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model to create (e.g., "dentalAssessment", "patient", "app_release_policy")',
                            },
                            single_record: {
                                type: 'boolean',
                                description: 'Whether this model should store only a single record (like settings)',
                                default: false,
                            },
                            is_common_model: {
                                type: 'boolean',
                                description:
                                    'SaaS only: when true, this is a **common (project-wide) model** — not tied to any tenant, no tenant_id scoping, all tenants read/write the same rows. Use for shared catalogs, release policies, global reference data. When false/omitted, model is tenant-scoped (each tenant sees only their rows). Call get_saas_model_guide before using.',
                            },
                        },
                        required: ['model_name'],
                    },
                },
                {
                    name: 'add_field',
                    description: `Add a field to an existing model. You must specify field_type and input_type explicitly.

Apito uses the names **object** and **repeated** in schema (not a separate type literally called "array"). To create an **array of structured rows** (line items, nested rows with subfields), use **repeated** first: field_type="repeated", input_type="repeated", is_object_field=true — then add subfields under it. **object** is for a single nested object only.

Valid combinations:
- Text Field: field_type="text", input_type="string" (Single line text input)
- Rich Text Field: field_type="multiline", input_type="string" (Multiline editor with formatting)
- DateTime Field: field_type="date", input_type="string" (Date & Time input)
- Dynamic Array: field_type="list", field_sub_type="dynamicList", input_type="string" (Flexible list of simple values — not typed array-of-object; for that use repeated)
- Dropdown Menu: field_type="list", field_sub_type="dropdown", input_type="string" (Predefined list for single selection). REQUIRES validation.fixed_list_elements (array of strings) and validation.fixed_list_element_type="string"
- Multi-Checkbox Selector: field_type="list", field_sub_type="multiSelect", input_type="string" (Allows selecting multiple options). REQUIRES validation.fixed_list_elements (array of strings) and validation.fixed_list_element_type="string"
- Boolean Field: field_type="boolean", input_type="bool" (True or False toggle)
- File Upload: field_type="media", input_type="string" (Upload images or files)
- Integer Field: field_type="number", input_type="int" (Whole numbers only)
- Decimal Field: field_type="number", input_type="double" (Decimal numbers)
- GeoPoint Field: field_type="geo", input_type="geo" (Latitude & Longitude)
- Object (single nested object): field_type="object", input_type="object" (set is_object_field=true)
- Repeated (array of objects / structured array): field_type="repeated", input_type="repeated" (set is_object_field=true; add child fields after)

For nested subfields, set parent_field (immediate parent only) and is_object_field appropriately. **add_field checks live published schema** — duplicate error means field already exists (skip or use is_update). See get_schema_migration_guide. For GraphQL selection shapes, call get_field_design_guide.`,
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model to add the field to',
                            },
                            field_label: {
                                type: 'string',
                                description: 'Label/name of the field to add',
                            },
                            field_type: {
                                type: 'string',
                                description:
                                    'Apito field_type. Use repeated (not a separate "array" type) for array-of-object / structured rows. Valid values: text, multiline, number, date, boolean, media, object, repeated, list, geo',
                                enum: ['text', 'multiline', 'number', 'date', 'boolean', 'media', 'object', 'repeated', 'list', 'geo'],
                            },
                            input_type: {
                                type: 'string',
                                description: 'Input type. Valid values: string, int, double, bool, geo, object, repeated',
                                enum: ['string', 'int', 'double', 'bool', 'geo', 'object', 'repeated'],
                            },
                            field_sub_type: {
                                type: 'string',
                                description: 'Field sub type (required for list fields). Valid values: dynamicList (for Dynamic Array), dropdown (for Dropdown Menu), multiSelect (for Multi-Checkbox Selector)',
                                enum: ['dynamicList', 'dropdown', 'multiSelect'],
                            },
                            parent_field: {
                                type: 'string',
                                description:
                                    'Parent field identifier when adding a subfield under object or repeated (structured array)',
                            },
                            is_object_field: {
                                type: 'boolean',
                                description:
                                    'Set true when this field is a container: object (single nested object) or repeated (array of objects). Required for object/repeated before adding children.',
                                default: false,
                            },
                            field_description: {
                                type: 'string',
                                description: 'Optional description for the field',
                            },
                            validation: {
                                type: 'object',
                                description: 'Validation rules for the field. For dropdown and multiSelect fields, fixed_list_elements (array of strings) and fixed_list_element_type="string" are REQUIRED.',
                                properties: {
                                    required: { type: 'boolean' },
                                    unique: { type: 'boolean' },
                                    hide: { type: 'boolean' },
                                    is_email: { type: 'boolean' },
                                    is_url: { type: 'boolean' },
                                    fixed_list_elements: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description: 'Array of option strings (REQUIRED for dropdown and multiSelect fields)'
                                    },
                                    fixed_list_element_type: {
                                        type: 'string',
                                        description: 'Type of list elements, typically "string" (REQUIRED for dropdown and multiSelect fields)'
                                    },
                                },
                            },
                            serial: {
                                type: 'number',
                                description: 'Optional serial number for field ordering',
                            },
                        },
                        required: ['model_name', 'field_label', 'field_type', 'input_type'],
                    },
                },
                {
                    name: 'update_field',
                    description: 'Update an existing field in a model',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model',
                            },
                            field_name: {
                                type: 'string',
                                description: 'Identifier of the field to update',
                            },
                            field_label: {
                                type: 'string',
                                description: 'New label for the field',
                            },
                            field_type: {
                                type: 'string',
                                description: 'New field type',
                            },
                            input_type: {
                                type: 'string',
                                description: 'New input type',
                            },
                            field_description: {
                                type: 'string',
                                description: 'New description',
                            },
                            validation: {
                                type: 'object',
                                description: 'Updated validation rules',
                            },
                        },
                        required: ['model_name', 'field_name', 'field_label'],
                    },
                },
                {
                    name: 'rename_field',
                    description: 'Rename a field in a model',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model',
                            },
                            field_name: {
                                type: 'string',
                                description: 'Current field identifier',
                            },
                            new_name: {
                                type: 'string',
                                description: 'New field identifier',
                            },
                            parent_field: {
                                type: 'string',
                                description: 'Parent field name if this is a nested field',
                            },
                        },
                        required: ['model_name', 'field_name', 'new_name'],
                    },
                },
                {
                    name: 'delete_field',
                    description:
                        'Delete a normal (non-relation) field, or a model connection if you set is_relation=true (calls system deleteConnectionFromModel). **Nested fields require parent_field** (immediate parent identifier). Stages remove_field — live schema unchanged until publish. See get_schema_migration_guide before delete+re-add. Prefer delete_relation for removing links. **One call removes the connection on both models** (bidirectional); do not delete again from the peer model. For is_relation: model_name = either endpoint; field_name = connections[].model from get_model_schema(model_name), NOT a document field identifier.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model',
                            },
                            field_name: {
                                type: 'string',
                                description:
                                    'For normal fields: field identifier. For is_relation=true: the peer model name exactly as in get_model_schema → connections[].model (often PascalCase / different from payload field keys).',
                            },
                            parent_field: {
                                type: 'string',
                                description: 'Parent field name if this is a nested field',
                            },
                            is_relation: {
                                type: 'boolean',
                                description:
                                    'True only to drop a schema connection (same as delete_relation). **Call once** — the engine removes forward and reverse edges; do not run a second delete from the other model. False/omit for scalar/object/repeated fields.',
                            },
                            known_as: {
                                type: 'string',
                                description:
                                    'Must match get_model_schema → connections[].known_as for that edge (use empty string \"\" when there is no custom known_as).',
                            },
                        },
                        required: ['model_name', 'field_name'],
                    },
                },
                {
                    name: 'update_model',
                    description:
                        'Update model metadata (not fields). Use `is_common_model` to mark an existing model as project-wide (common) or tenant-scoped on SaaS projects. Metadata-only `is_common_model` updates apply immediately on pro engines (no schema publish required). Also supports `single_page_model`. At least one of is_common_model or single_page_model must be provided.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Canonical model name to update',
                            },
                            is_common_model: {
                                type: 'boolean',
                                description:
                                    'SaaS: true = common/project-wide model (all tenants share rows, no tenant_id). false = tenant-scoped (default SaaS behavior). See get_saas_model_guide.',
                            },
                            single_page_model: {
                                type: 'boolean',
                                description: 'Whether the model stores a single record (settings-style)',
                            },
                        },
                        required: ['model_name'],
                    },
                },
                {
                    name: 'delete_model',
                    description:
                        '**DANGER — IRREVERSIBLE.** Removes the model from the project **schema** and deletes **all** documents in that model. **Hard requirement:** the engine refuses if this model still has schema edges — inspect `get_model_schema(model_name).connections` (must be empty) **and** every other model via `get_model_schema` so no `connections[].model` equals this model; remove each edge with `delete_relation` first (once per edge). Uses system `updateModel(type: delete, model_name)`. **WARNING 1:** You cannot undo this from the MCP. **WARNING 2:** Call only after explicit human confirmation. **Required:** `acknowledge_permanent_deletion` must be `true` or the tool refuses without calling the API.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Canonical model name to delete (e.g. stock_movement)',
                            },
                            acknowledge_permanent_deletion: {
                                type: 'boolean',
                                description:
                                    'MUST be the literal boolean true. Refused if false, omitted, or null. This is an intentional safety gate so agents do not delete models by accident.',
                            },
                        },
                        required: ['model_name', 'acknowledge_permanent_deletion'],
                    },
                },
                {
                    name: 'get_schema_migration_guide',
                    description:
                        '**Read first for any schema migration** (JSON export, live preview, gap diff, or greenfield). Dos and donts: sequential mutations, live vs draft, nested parent_field, delete_field pitfalls, add_field duplicate errors, verification with get_schema_preview, SaaS patterns, publish handoff. Same content as resource apito://schema-migration-guide.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'get_schema_versioning_status',
                    description:
                        'Check whether pro schema versioning is enabled and if a draft changeset exists. Call after get_schema_migration_guide at the start of schema work. MCP stages mutations but never publishes — user must publish in Console → Schema Changes.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'get_schema_preview',
                    description:
                        'Read full project schema JSON from schemaPreview (live, draft, or a published version). Use draft after staging mutations to verify staged work.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            source: {
                                type: 'string',
                                description: 'Preview source: live (published), draft (staged changeset), or version (requires version int).',
                                enum: ['live', 'draft', 'version'],
                            },
                            version: {
                                type: 'number',
                                description: 'Published schema version number when source is version.',
                            },
                        },
                        required: ['source'],
                    },
                },
                {
                    name: 'get_effective_schema',
                    description:
                        'Merged live+draft schema (console overlay parity). Primary verification tool after staging — answers what will exist after the user publishes.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'get_schema_change_plan',
                    description:
                        'Publish plan from schemaChangeExecutionRecords: sequence, action, impact, local/remote status. Pending until user publishes in Console.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            changeset_id: {
                                type: 'string',
                                description: 'Optional changeset id; defaults to active draft.',
                            },
                        },
                    },
                },
                {
                    name: 'summarize_schema_draft_for_review',
                    description:
                        'Markdown summary of effective draft schema + change plan + mandatory user instruction to review and publish in Console. Use at end of schema-building sessions.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'list_models',
                    description:
                        'List models in the project with scope labels (common / tenant-scoped / tenant catalogue). On pro engines with an active draft, defaults to effective (live+draft merge). Use source=live for published-only.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            source: SOURCE_PARAM_SCHEMA,
                        },
                    },
                },
                {
                    name: 'get_model_schema',
                    description:
                        'Get fields, connections, and is_common_model for a model. Defaults to effective schema when a draft exists. Staged models/fields are visible with source=effective or draft. To remove a schema connection: use delete_relation **once** (both models updated automatically). Read connections[].model and known_as from get_model_schema. Do not guess from document field names. For object/repeated GraphQL shapes, call get_field_design_guide.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model to get schema for',
                            },
                            source: SOURCE_PARAM_SCHEMA,
                        },
                        required: ['model_name'],
                    },
                },
                {
                    name: 'get_saas_model_guide',
                    description:
                        'SaaS model classification guide: tenant-scoped vs common (project-wide) models, when to use each, examples (app release policy, hospital medicine catalog), and how is_common_model affects queries and inserts. Read this before create_model on SaaS projects.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'get_project_context',
                    description:
                        'Read current project metadata from system GraphQL (id, name, project_type, and Pro fields tenant_model_name / per_tenant_separate_database when available). Use before data-plane calls to know if tenant scoping is required; pair with TENANT_ID / X-Apito-Tenant-ID env in MCP config. On SaaS projects, also call get_saas_model_guide to choose common vs tenant-scoped models.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'get_relation_graph',
                    description:
                        'Relation overview as JSON edges + Mermaid. For draft/effective sources, built from schema preview (engine graph query is live-only). To remove a connection, use delete_relation **once** per edge.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description:
                                    'Optional; must match the active project id if set (same rule as projectModelsInfo _id). Omit for current project.',
                            },
                            source: SOURCE_PARAM_SCHEMA,
                        },
                    },
                },
                {
                    name: 'get_project_query_structure',
                    description:
                        "Get the Apito project GraphQL query structure: which operations exist for each model. For model 'Task' you get task(_id), taskList, taskListCount, createTask, updateTask, deleteTask, upsertTaskList. CamelCase matters. To filter lists by related models (has_one, has_many, M:N), use the `relation` arg on *List — e.g. studentList(relation: { class: { _id: { eq: '…' } } }); do not use `connection` for that. Full rules: get_project_query_guide / apito://project-query-guide. For field selections (object vs repeated vs relation), get_field_design_guide.",
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'get_field_design_guide',
                    description:
                        'Apito field model: object = single nested object; repeated = structured array (array of objects) — use repeated when creating that kind of array. Also covers GraphQL selections (no inner data on object/repeated), _id on rows, vs document root and relations.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'add_relation',
                    description:
                        'Create a relation between two models. To remove it later, call **delete_relation once** (bidirectional cleanup — do not delete from both models). Same from/to/known_as as add_relation, or delete_field with is_relation=true.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            from_model: {
                                type: 'string',
                                description: 'Source model name (the model that will have the relation field)',
                            },
                            to_model: {
                                type: 'string',
                                description: 'Target model name (the model being related to)',
                            },
                            forward_connection_type: {
                                type: 'string',
                                description: 'Forward relation type from source to target. Valid values: "has_many" (one-to-many) or "has_one" (one-to-one)',
                                enum: ['has_many', 'has_one'],
                            },
                            reverse_connection_type: {
                                type: 'string',
                                description: 'Reverse relation type from target back to source. Valid values: "has_many" (one-to-many) or "has_one" (one-to-one)',
                                enum: ['has_many', 'has_one'],
                            },
                            known_as: {
                                type: 'string',
                                description: 'Optional alternate identifier for this relation (custom name for the relation field)',
                            },
                        },
                        required: ['from_model', 'to_model', 'forward_connection_type', 'reverse_connection_type'],
                    },
                },
                {
                    name: 'delete_relation',
                    description:
                        'Remove one model-to-model **schema** connection (inverse of add_relation). Calls deleteConnectionFromModel(from, to, known_as). **Bidirectional: a single call deletes the link on both models** (e.g. food↔category) — never call delete_relation twice swapping from/to for the same edge. Pick one side as from_model and pass the peer as to_model using get_model_schema(from_model).connections[].model and known_as.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            from_model: {
                                type: 'string',
                                description:
                                    'Either endpoint of the connection (same as one side of add_relation). Must match get_model_schema so you can read connections[].model for the peer.',
                            },
                            to_model: {
                                type: 'string',
                                description:
                                    'The other model — exact connections[]..model from get_model_schema(from_model). Not a second delete target: one delete_relation already clears both sides.',
                            },
                            known_as: {
                                type: 'string',
                                description:
                                    'Must match that connection\'s known_as; omit or use \"\" when the relation had no custom known_as in add_relation.',
                            },
                        },
                        required: ['from_model', 'to_model'],
                    },
                },
                {
                    name: 'upsert_data',
                    description: 'Create or update a record in a model. Use payload for field values. For updates, pass _id. Use connect to link relations (e.g. {"author_id": "uuid"} for has_one, {"tag_ids": ["uuid1","uuid2"]} for has_many).',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model',
                            },
                            payload: {
                                type: 'object',
                                description: 'JSON object of field values to create/update',
                            },
                            _id: {
                                type: 'string',
                                description: 'Document ID for updates (omit for create)',
                            },
                            status: {
                                type: 'string',
                                description: 'Document status: "draft" or "published" (default: "published")',
                                enum: ['draft', 'published'],
                            },
                            local: {
                                type: 'string',
                                description: 'Locale for localized content (default: "en")',
                            },
                            connect: {
                                type: 'object',
                                description: 'JSON for connecting relations: {"author_id": "uuid"} for has_one, {"tag_ids": ["uuid1","uuid2"]} for has_many',
                            },
                            disconnect: {
                                type: 'object',
                                description: 'JSON for disconnecting relations',
                            },
                        },
                        required: ['model_name', 'payload'],
                    },
                },
                {
                    name: 'get_data',
                    description:
                        'Query or list records from a model with optional filters, pagination, and search. When choosing which subfields to request, follow get_field_design_guide: nested object/repeated fields do not use an inner `data { }` wrapper; relations to other models do.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model',
                            },
                            page: {
                                type: 'number',
                                description: 'Page number (default: 1)',
                            },
                            limit: {
                                type: 'number',
                                description: 'Records per page (default: 10)',
                            },
                            where: {
                                type: 'object',
                                description: 'JSON filter object',
                            },
                            status: {
                                type: 'string',
                                description: 'Filter by status: "all", "draft", or "published"',
                                enum: ['all', 'draft', 'published'],
                            },
                            search: {
                                type: 'string',
                                description: 'Text search query',
                            },
                        },
                        required: ['model_name'],
                    },
                },
                {
                    name: 'delete_data',
                    description: 'Delete a record by ID.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model',
                            },
                            _id: {
                                type: 'string',
                                description: 'Document ID to delete',
                            },
                        },
                        required: ['model_name', '_id'],
                    },
                },
                {
                    name: 'duplicate_data',
                    description: 'Duplicate a record by ID. Returns the new record ID.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model',
                            },
                            _id: {
                                type: 'string',
                                description: 'Document ID to duplicate',
                            },
                        },
                        required: ['model_name', '_id'],
                    },
                },
                ...platformTools,
            ],
        });
        this.server.setRequestHandler(ListToolsRequestSchema, this.listToolsHandler);

        // Handle tool calls
        this.callToolHandler = async (request) => {
            this.ensureClient();

            const { name, arguments: args } = request.params;

            try {
                if (PLATFORM_TOOL_NAMES.has(name)) {
                    return await handlePlatformTool(
                        name,
                        (args ?? {}) as Record<string, unknown>,
                        this.client!
                    );
                }

                switch (name) {
                    case 'summarize_schema_draft_for_review':
                        return await this.handleSummarizeSchemaDraftForReview();
                    case 'get_schema_migration_guide':
                        return await this.handleGetSchemaMigrationGuide();
                    case 'get_schema_versioning_status':
                        return await this.handleGetSchemaVersioningStatus();
                    case 'get_schema_preview':
                        return await this.handleGetSchemaPreview(args as any);
                    case 'get_effective_schema':
                        return await this.handleGetEffectiveSchema();
                    case 'get_schema_change_plan':
                        return await this.handleGetSchemaChangePlan(args as any);
                    case 'create_model':
                        return await this.handleCreateModel(args as any);
                    case 'add_field':
                        return await this.handleAddField(args as any);
                    case 'update_field':
                        return await this.handleUpdateField(args as any);
                    case 'rename_field':
                        return await this.handleRenameField(args as any);
                    case 'delete_field':
                        return await this.handleDeleteField(args as any);
                    case 'delete_model':
                        return await this.handleDeleteModel(args as any);
                    case 'update_model':
                        return await this.handleUpdateModel(args as any);
                    case 'list_models':
                        return await this.handleListModels(args as any);
                    case 'get_model_schema':
                        return await this.handleGetModelSchema(args as any);
                    case 'get_project_context':
                        return await this.handleGetProjectContext();
                    case 'get_saas_model_guide':
                        return await this.handleGetSaaSModelGuide();
                    case 'get_relation_graph':
                        return await this.handleGetRelationGraph(args as any);
                    case 'get_project_query_structure':
                        return await this.handleGetProjectQueryStructure();
                    case 'get_field_design_guide':
                        return await this.handleGetFieldDesignGuide();
                    case 'add_relation':
                        return await this.handleAddRelation(args as any);
                    case 'delete_relation':
                        return await this.handleDeleteRelation(args as any);
                    case 'upsert_data':
                        return await this.handleUpsertData(args as any);
                    case 'get_data':
                        return await this.handleGetData(args as any);
                    case 'delete_data':
                        return await this.handleDeleteData(args as any);
                    case 'duplicate_data':
                        return await this.handleDuplicateData(args as any);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error: any) {
                // Log to stderr (important for STDIO servers)
                console.error(`Error in tool ${name}:`, error);

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message || String(error)}${error.stack ? `\n\nStack trace:\n${error.stack}` : ''}`,
                        },
                    ],
                    isError: true,
                };
            }
        };
        this.server.setRequestHandler(CallToolRequestSchema, this.callToolHandler);

        // Prompts (for asking user when field type is ambiguous)
        this.listPromptsHandler = async () => ({
            prompts: [
                {
                    name: 'confirm_field_type',
                    description: 'Confirm the field type when it is ambiguous. Use this when the field definition could be multiple types.',
                    arguments: [
                        {
                            name: 'field_name',
                            description: 'Name of the field',
                            required: true,
                        },
                        {
                            name: 'suggested_types',
                            description: 'Array of suggested field types (e.g., ["text", "number", "date"])',
                            required: true,
                        },
                    ],
                },
            ],
        });
        this.server.setRequestHandler(ListPromptsRequestSchema, this.listPromptsHandler);

        // Handle prompt requests
        this.getPromptHandler = async (request: any) => {
            const { name, arguments: args } = request.params;

            if (name === 'confirm_field_type') {
                const fieldName = (args as any).field_name;
                const suggestedTypes = (args as any).suggested_types || [];

                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: `The field "${fieldName}" could be one of these types: ${suggestedTypes.join(', ')}. Please specify which type to use by providing field_type and input_type in your next request.`,
                            },
                        },
                    ],
                };
            }

            throw new Error(`Unknown prompt: ${name}`);
        };
        this.server.setRequestHandler(GetPromptRequestSchema, this.getPromptHandler);

        // List available resources (model schemas + query guide)
        this.listResourcesHandler = async (_request: any) => {
            this.ensureClient();

            try {
                const { models, sourceUsed } = await this.getSchemaContext().resolveModels('effective');
                const status = await this.getSchemaContext().getStatus();

                const resources: { uri: string; name: string; description: string; mimeType: string }[] = [
                    {
                        uri: 'apito://schema-migration-guide',
                        name: 'Apito schema migration guide',
                        description:
                            'Migration dos/donts: sequential ops, live vs draft, nested parent_field, delete/add pitfalls, verification, SaaS patterns — any source',
                        mimeType: 'text/markdown',
                    },
                    {
                        uri: 'apito://schema-versioning-guide',
                        name: 'Apito schema versioning guide',
                        description: 'Draft vs live schema, verification tools, MCP never publishes, data after publish',
                        mimeType: 'text/markdown',
                    },
                    {
                        uri: 'apito://project-query-guide',
                        name: 'Apito Project Query Structure Guide',
                        description: 'where filters, relation vs connection list filters (use relation for has_one/has_many/M:N), pagination, mutations, and what is possible vs not',
                        mimeType: 'text/markdown',
                    },
                    {
                        uri: 'apito://saas-model-guide',
                        name: 'Apito SaaS model classification guide',
                        description:
                            'Common vs tenant-scoped models, is_common_model usage, examples (release policy, hospital medicine catalog)',
                        mimeType: 'text/markdown',
                    },
                    {
                        uri: 'apito://field-design-guide',
                        name: 'Apito field design & GraphQL selection guide',
                        description:
                            'object vs repeated vs relation; when id/data applies; _id on array rows; no inner data node on nested fields',
                        mimeType: 'text/markdown',
                    },
                    {
                        uri: 'apito://saas-auth-guide',
                        name: 'Apito SaaS app user authentication guide',
                        description:
                            'Local login, Google OAuth flow, tenant_id routing, token sensitivity for MCP auth tools',
                        mimeType: 'text/markdown',
                    },
                    ...models.map(model => ({
                        uri: `apito://model/${model.name}`,
                        name: `Model: ${model.name}`,
                        description: `Schema for ${model.name} (${sourceUsed}${status.has_draft ? ', includes draft' : ''}) with ${model.fields?.length || 0} fields`,
                        mimeType: 'application/json',
                    })),
                ];
                return { resources };
            } catch (error: any) {
                console.error('Error listing resources:', error);
                return {
                    resources: [],
                };
            }
        };
        this.server.setRequestHandler(ListResourcesRequestSchema, this.listResourcesHandler);

        // Read resource (get model schema)
        this.readResourceHandler = async (request: any) => {
            this.ensureClient();

            const { uri } = request.params;

            if (uri === 'apito://schema-migration-guide') {
                const guide = getSchemaMigrationGuideContent();
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'text/markdown',
                            text: guide,
                        },
                    ],
                };
            }

            // Static resource: apito://project-query-guide
            if (uri === 'apito://schema-versioning-guide') {
                const guide = this.getSchemaVersioningGuideContent();
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'text/markdown',
                            text: guide,
                        },
                    ],
                };
            }

            if (uri === 'apito://project-query-guide') {
                const guide = this.getProjectQueryGuideContent();
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'text/markdown',
                            text: guide,
                        },
                    ],
                };
            }

            if (uri === 'apito://saas-model-guide') {
                const guide = this.getSaaSModelClassificationGuideContent();
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'text/markdown',
                            text: guide,
                        },
                    ],
                };
            }

            if (uri === 'apito://field-design-guide') {
                const guide = this.getFieldDesignGuideContent();
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'text/markdown',
                            text: guide,
                        },
                    ],
                };
            }

            if (uri === 'apito://saas-auth-guide') {
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'text/markdown',
                            text: getSaasAuthGuideContent(),
                        },
                    ],
                };
            }

            // Parse URI: apito://model/{modelName}
            const match = uri.match(/^apito:\/\/model\/(.+)$/);
            if (!match) {
                throw new Error(
                    `Invalid resource URI: ${uri}. Expected format: apito://model/{modelName}, apito://schema-migration-guide, apito://project-query-guide, apito://field-design-guide, or apito://schema-versioning-guide`
                );
            }

            const modelName = match[1];

            try {
                const { models } = await this.getSchemaContext().resolveModels('effective');
                const model = models.find((m) => m.name.toLowerCase() === modelName.toLowerCase());

                if (!model) {
                    throw new Error(`Model "${modelName}" not found in effective schema`);
                }

                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(model, null, 2),
                        },
                    ],
                };
            } catch (error: any) {
                console.error(`Error reading resource ${uri}:`, error);
                throw error;
            }
        };
        this.server.setRequestHandler(ReadResourceRequestSchema, this.readResourceHandler);
    }

    private async handleCreateModel(args: {
        model_name: string;
        single_record?: boolean;
        is_common_model?: boolean;
    }) {
        this.validateModelName(args.model_name);

        const rawResult = await this.client!.addModelToProject(
            args.model_name,
            args.single_record,
            args.is_common_model
        );

        const scopeNote =
            args.is_common_model === true
                ? '\n\n**Common model** — project-wide, no tenant scoping. All tenants share this data.'
                : args.is_common_model === false
                  ? '\n\n**Tenant-scoped model** — each tenant sees only their own rows.'
                  : '';

        const text =
            (await this.formatStagingMutationResponse(
                `create model "${args.model_name}"`,
                rawResult
            )) + scopeNote;

        return {
            content: [
                {
                    type: 'text',
                    text,
                },
            ],
        };
    }

    private async handleUpdateModel(args: {
        model_name: string;
        is_common_model?: boolean;
        single_page_model?: boolean;
    }) {
        if (args.is_common_model === undefined && args.single_page_model === undefined) {
            throw new Error(
                'update_model requires at least one of is_common_model or single_page_model'
            );
        }

        const model = await this.client!.updateModel('update', args.model_name, {
            isCommonModel: args.is_common_model,
            singlePageModel: args.single_page_model,
        });

        const scopeNote =
            args.is_common_model === true
                ? '\n\nModel is now **common (project-wide)** — all tenants share rows; no tenant_id scoping.'
                : args.is_common_model === false
                  ? '\n\nModel is now **tenant-scoped** — each tenant sees only their own rows.'
                  : '';

        const text =
            (await this.formatStagingMutationResponse(
                `update model "${args.model_name}" metadata`,
                model
            )) + scopeNote;

        return {
            content: [{ type: 'text', text }],
        };
    }

    private async handleAddField(args: {
        model_name: string;
        field_label: string;
        field_type: string;
        input_type: string;
        field_sub_type?: string;
        parent_field?: string;
        is_object_field?: boolean;
        field_description?: string;
        validation?: ValidationInput;
        serial?: number;
    }) {
        // Validate field_sub_type is provided for list fields
        if (args.field_type === 'list' && !args.field_sub_type) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: field_sub_type is required when field_type is "list". Valid values: "dynamicList" (for Dynamic Array), "dropdown" (for Dropdown Menu), "multiSelect" (for Multi-Checkbox Selector).`,
                    },
                ],
                isError: true,
            };
        }

        // Validate fixed_list_elements and fixed_list_element_type for dropdown and multiSelect
        if (args.field_sub_type === 'dropdown' || args.field_sub_type === 'multiSelect') {
            if (!args.validation?.fixed_list_elements || !Array.isArray(args.validation.fixed_list_elements) || args.validation.fixed_list_elements.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: validation.fixed_list_elements (array of strings) is REQUIRED for ${args.field_sub_type} fields. Example: { "fixed_list_elements": ["option 1", "option 2"], "fixed_list_element_type": "string" }`,
                        },
                    ],
                    isError: true,
                };
            }
            if (!args.validation.fixed_list_element_type) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: validation.fixed_list_element_type is REQUIRED for ${args.field_sub_type} fields. Set it to "string".`,
                        },
                    ],
                    isError: true,
                };
            }
        }

        // Auto-set is_object_field for object and repeated types
        const isObjectField = args.is_object_field !== undefined
            ? args.is_object_field
            : (args.field_type === 'object' || args.field_type === 'repeated');

        const field = await this.client!.upsertFieldToModel(
            args.model_name,
            args.field_label,
            args.field_type,
            args.input_type,
            {
                fieldSubType: args.field_sub_type,
                parentField: args.parent_field,
                isObjectField: isObjectField,
                fieldDescription: args.field_description,
                validation: args.validation,
                serial: args.serial,
            }
        );

        const text = await this.formatStagingMutationResponse(
            `add field "${args.field_label}" to "${args.model_name}"`,
            field
        );

        return {
            content: [
                {
                    type: 'text',
                    text,
                },
            ],
        };
    }


    private async handleUpdateField(args: {
        model_name: string;
        field_name: string;
        field_label: string;
        field_type?: string;
        input_type?: string;
        field_description?: string;
        validation?: ValidationInput;
    }) {
        const field = await this.client!.upsertFieldToModel(
            args.model_name,
            args.field_label,
            args.field_type || 'text',
            args.input_type || 'string',
            {
                isUpdate: true,
                fieldDescription: args.field_description,
                validation: args.validation,
            }
        );

        const text = await this.formatStagingMutationResponse(
            `update field "${args.field_name}" on "${args.model_name}"`,
            field
        );

        return {
            content: [
                {
                    type: 'text',
                    text,
                },
            ],
        };
    }

    private async handleRenameField(args: {
        model_name: string;
        field_name: string;
        new_name: string;
        parent_field?: string;
    }) {
        const field = await this.client!.modelFieldOperation(
            'rename',
            args.model_name,
            args.field_name,
            {
                newName: args.new_name,
                parentField: args.parent_field,
            }
        );

        const text = await this.formatStagingMutationResponse(
            `rename field "${args.field_name}" to "${args.new_name}" on "${args.model_name}"`,
            field
        );

        return {
            content: [
                {
                    type: 'text',
                    text,
                },
            ],
        } as any;
    }

    private async handleDeleteField(args: {
        model_name: string;
        field_name: string;
        parent_field?: string;
        is_relation?: boolean;
        known_as?: string;
    }) {
        if (args.is_relation === true) {
            const knownAs = args.known_as !== undefined ? args.known_as : '';
            const removed = await this.client!.deleteConnectionFromModel(
                args.model_name,
                args.field_name,
                knownAs === '' ? undefined : knownAs
            );
            const text = await this.formatStagingMutationResponse(
                `delete connection from "${args.model_name}" to "${args.field_name}"`,
                removed
            );
            return {
                content: [
                    {
                        type: 'text',
                        text:
                            `Removed connection from "${args.model_name}" to "${args.field_name}" (known_as: ${JSON.stringify(knownAs)}). **Bidirectional:** the peer model is already updated — do not delete again from the other model for this same edge.\n\n` +
                            text,
                    },
                ],
            };
        }

        const field = await this.client!.modelFieldOperation('delete', args.model_name, args.field_name, {
            parentField: args.parent_field,
            knownAs: args.known_as,
        });
        const text = await this.formatStagingMutationResponse(
            `delete field "${args.field_name}" from "${args.model_name}"`,
            field
        );
        return {
            content: [
                {
                    type: 'text',
                    text,
                },
            ],
        };
    }

    private async handleDeleteRelation(args: {
        from_model: string;
        to_model: string;
        known_as?: string;
    }) {
        const knownAs = args.known_as !== undefined ? args.known_as : '';
        const removed = await this.client!.deleteConnectionFromModel(
            args.from_model,
            args.to_model,
            knownAs === '' ? undefined : knownAs
        );
        const text = await this.formatStagingMutationResponse(
            `delete relation ${args.from_model} → ${args.to_model}`,
            removed
        );
        return {
            content: [
                {
                    type: 'text',
                    text:
                        `Removed connection from "${args.from_model}" to "${args.to_model}" (known_as: ${JSON.stringify(knownAs)}). **Bidirectional:** the peer model is already updated — do not call delete_relation again swapping from/to for this same edge.\n\n` +
                        text,
                },
            ],
        };
    }

    private async handleDeleteModel(args: {
        model_name: string;
        acknowledge_permanent_deletion?: boolean;
    }) {
        if (args.acknowledge_permanent_deletion !== true) {
            throw new Error(
                'Refused: delete_model requires acknowledge_permanent_deletion: true (literal boolean). ' +
                    'This operation permanently removes the model and all its data from the project. ' +
                    'Do not call this tool unless a human explicitly confirmed the model name and consequences.'
            );
        }
        const model = await this.client!.updateModel('delete', args.model_name);
        const text = await this.formatStagingMutationResponse(
            `delete model "${args.model_name}"`,
            model
        );
        const warn =
            '**IRREVERSIBLE WHEN PUBLISHED** — Removing a model deletes its data after publish. Verify backups first.\n\n';
        return {
            content: [
                {
                    type: 'text',
                    text: warn + text,
                },
            ],
        };
    }

    private formatModelScopeLabel(model: ApitoModel, tenantModelName?: string): string {
        if (model.is_common_model) {
            return 'common (project-wide)';
        }
        if (
            tenantModelName &&
            model.name.toLowerCase() === tenantModelName.trim().toLowerCase()
        ) {
            return 'tenant catalogue';
        }
        return 'tenant-scoped';
    }

    private async handleListModels(args: { source?: string } = {}) {
        const source = await this.resolveSchemaSource(args.source);
        const { models, status, sourceUsed } = await this.getSchemaContext().resolveModels(source);
        const reminder = formatUserPublishReminder(status);
        let tenantModelName: string | undefined;
        try {
            const ctx = await this.client!.getProjectContextForMCP();
            tenantModelName =
                typeof ctx.tenant_model_name === 'string' ? ctx.tenant_model_name : undefined;
        } catch {
            tenantModelName = undefined;
        }

        return {
            content: [
                {
                    type: 'text',
                    text:
                        `Found ${models.length} model(s) (source: ${sourceUsed}):\n\n` +
                        models
                            .map(
                                (m) =>
                                    `- ${m.name} (${m.fields?.length || 0} fields, ${this.formatModelScopeLabel(m, tenantModelName)})`
                            )
                            .join('\n') +
                        '\n\nScope legend: **common** = all tenants share rows; **tenant-scoped** = each tenant sees only their data; **tenant catalogue** = tenant registry table.' +
                        reminder,
                },
            ],
        };
    }

    private async handleGetProjectQueryStructure() {
        const { models } = await this.getSchemaContext().resolveModels('live');
        const mapping = models.map((m) => {
            const singular = this.modelNameToCamelCase(m.name);
            return {
                model: m.name,
                singular: `${singular}(_id)`,
                list: `${singular}List`,
                count: `${singular}ListCount`,
                create: `create${m.name}`,
                update: `update${m.name}`,
                delete: `delete${m.name}`,
                upsert: `upsert${m.name}List`,
            };
        });

        const text = `# Apito Project Query Structure\n\n` +
            `For each model, these GraphQL operations exist. **CamelCase matters.**\n\n` +
            `| Model | Get by ID | List | Count | Create | Update | Delete | Upsert |\n` +
            `|-------|-----------|------|-------|--------|--------|--------|--------|\n` +
            mapping.map((r) => `| ${r.model} | ${r.singular} | ${r.list} | ${r.count} | ${r.create} | ${r.update} | ${r.delete} | ${r.upsert} |`).join('\n') +
            `\n\nExample for Task: \`task(_id: "…")\`, \`taskList\`, \`createTask\`, \`updateTask\`, \`deleteTask\`, \`upsertTaskList\`\n\n` +
            `**Note:** Public project GraphQL reflects **published (live)** schema only. Draft-only models from MCP staging appear here only after Console publish.\n\n` +
            `Use resource \`apito://project-query-guide\` for full guide.\n\n` +
            `**Nested field selections:** tool \`get_field_design_guide\` or resource \`apito://field-design-guide\` — object/repeated fields are not second documents; do not add an inner \`data { }\` around them.`;

        return {
            content: [{ type: 'text' as const, text }],
        };
    }

    private async handleGetFieldDesignGuide() {
        return {
            content: [{ type: 'text' as const, text: this.getFieldDesignGuideContent() }],
        };
    }

    private async handleGetProjectContext() {
        const ctx = await this.client!.getProjectContextForMCP();
        const opts = this.buildGraphQLClientOptions();
        const tenantHint =
            opts.tenantId || opts.sendTempTenantCookie
                ? `\n\nMCP is sending tenant context (X-Apito-Tenant-ID${opts.sendTempTenantCookie ? ' + temp_tenant_id cookie' : ''}) from env.`
                : '\n\nNo TENANT_ID / APITO_TENANT_ID in env — for SaaS per-tenant DB, set tenant on the MCP process.';

        const saasHint =
            ctx.project_type === 'saas'
                ? '\n\n**SaaS project** — call `get_saas_model_guide` (or read `apito://saas-model-guide`) before `create_model` to decide whether a model should be **common (project-wide)** or **tenant-scoped**.'
                : '';
        const migrationHint =
            '\n\n**Schema migration** — call `get_schema_migration_guide` (or read `apito://schema-migration-guide`) before any bulk schema build or migration from JSON/preview/gap diff.';

        return {
            content: [
                {
                    type: 'text',
                    text: `Current project (system GraphQL):\n\n${JSON.stringify(ctx, null, 2)}${tenantHint}${saasHint}${migrationHint}`,
                },
            ],
        };
    }

    private async handleGetSaaSModelGuide() {
        return {
            content: [{ type: 'text' as const, text: this.getSaaSModelClassificationGuideContent() }],
        };
    }

    private async handleGetSchemaMigrationGuide() {
        return {
            content: [{ type: 'text' as const, text: getSchemaMigrationGuideContent() }],
        };
    }

    private async handleGetRelationGraph(args: { project_id?: string; source?: string }) {
        const source = await this.resolveSchemaSource(args?.source);
        if (source === 'live') {
            const graph = await this.client!.getProjectSchemaRelationGraph(args?.project_id);
            const mermaid = typeof graph.mermaid === 'string' ? graph.mermaid : '';
            const rest = { ...graph };
            delete (rest as { mermaid?: string }).mermaid;

            return {
                content: [
                    {
                        type: 'text',
                        text:
                            `Relation graph (live, from projectSchemaRelationGraph).\n\n## JSON\n${JSON.stringify(rest, null, 2)}\n\n## Mermaid\n\`\`\`mermaid\n${mermaid}\n\`\`\``,
                    },
                ],
            };
        }

        const { models, sourceUsed, status } = await this.getSchemaContext().resolveModels(source);
        const graph = buildRelationGraphFromModels(models);
        const reminder = formatUserPublishReminder(status);

        return {
            content: [
                {
                    type: 'text',
                    text:
                        `Relation graph (source: ${sourceUsed}, built from schema preview).\n\n` +
                        JSON.stringify(graph, null, 2) +
                        reminder,
                },
            ],
        };
    }

    private modelNameToCamelCase(name: string): string {
        return name.charAt(0).toLowerCase() + name.slice(1);
    }

    /** Markdown: object vs repeated vs relation; GraphQL selections vs payloads (evolve this over time). */
    private getFieldDesignGuideContent(): string {
        return `# Apito field design & GraphQL selection guide

This document is the **source of truth** for how nested fields differ from **top-level model documents**. Improve it over time as schema edge cases appear.

## Apito vocabulary: \`object\` vs \`repeated\` (schema / add_field)

- **\`object\` + \`object\`**: one **nested object** (single JSON object) with subfields you define under it.
- **\`repeated\` + \`repeated\`**: Apito’s name for a **structured array** — a list of rows, each row an object with its own subfields; rows typically get an **\`_id\`** for updates. When you want an “array field” in the sense of **array of objects**, create a **\`repeated\`** field first — that is the supported pattern.
- **\`list\`** (e.g. \`dynamicList\`, \`dropdown\`, \`multiSelect\`) is for **scalar / choice lists**, not for defining a typed array of nested object shapes like line items.

Do not assume a GraphQL or JSON type named “array”; match Apito’s **\`object\`** vs **\`repeated\`** in \`get_model_schema\` / \`add_field\`.

## 1) Top-level model document (each list row, get-by-id, upsert response)

For a normal Apito **model** record, user-defined scalars and “flat” fields live under the **\`data { … }\`** selection alongside **\`id\`** / **\`_id\`** and **\`meta { … }\`** (exact field names match your public schema).

**Wrong (root):** \`foodOrderList { id order_no date }\` — user fields on the document root  
**Right (root):** \`foodOrderList { id data { order_no date } meta { created_at } }\`

## 2) Relation to another model (\`has_one\` / \`has_many\`)

A relation points at **another Apito model**. That side behaves like **(1)** again: use the **document envelope** when you need full rows — typically **\`id\`**, **\`data { … }\`**, **\`meta\`**.

**Right:** \`customer { id data { name phone } }\`  
**Wrong:** \`customer { name phone }\` — only if your public API exposes a shortcut projection (prefer the envelope for portability).

## 3) Object field (\`field_type: object\`, \`input_type: object\`)

Stored **inside** the parent’s \`data\` as nested JSON. In GraphQL, select **only the object’s keys** — there is **no** inner \`id\` / \`data\` wrapper for that object.

**Right:** \`settings { individual_maintenance_mode business_type }\`  
**Wrong:** \`settings { id data { individual_maintenance_mode } }\`

Same idea for structured scalars that require a sub-selection in your schema, e.g. \`logo { url }\`, \`address { full_address division }\`, \`bio { markdown }\`.

## 4) Repeated — Apito’s **array of object** (\`field_type: repeated\`, \`input_type: repeated\`)

Each array element is **not** a full Apito model document. Children are **direct fields** on the element. Apito usually assigns **\`_id\`** per row so updates can target one line — include **\`_id\`** in selections when you need stable row identity.

**Right:**  
\`foods { _id food_id size price quantity discount }\`  
\`additional_costs { cause amount }\`  
\`stocks { stock_id quantity amount }\`

**Wrong:**  
\`foods { id data { food_id size } }\` — treats each line like a root document (it is not).

## 5) Object inside object, object inside repeated

Compose with the same rules: **each nested object** uses **direct braces**, no nested \`data\`:

\`outer { inner { a b } }\`, \`lines { _id qty item { sku } }\`

## 6) Array inside array

Allowed but **discouraged**. Shape-wise: inner list items still **do not** get an automatic \`data { }\` wrapper—follow the schema’s sub-selections. Prefer flattening or a child model + relation if the graph gets unwieldy.

## 7) Payloads (\`createX\`, \`updateX\`, \`upsert_data\` \`payload\`)

- **Top-level model**: put user field values in the shape your API expects (often mirroring \`data\` keys at the payload root for project GraphQL).
- **Object / repeated**: use plain JSON nesting — **no** artificial \`data\` key **inside** each array element or object sub-tree unless your API explicitly requires it.

## Quick reference

| Concept | Apito schema (\`add_field\`) | GraphQL selection pattern |
|---------|------------------------------|---------------------------|
| Single nested object | \`object\` / \`object\` | \`obj { a b nested { x } }\` |
| Array of structured rows | **\`repeated\` / \`repeated\`** (this is “the array”) | \`rows { _id? a b nested { x } }\` |
| Model root row | (model) | \`id data { userFields } meta { … }\` |
| Relation (other model) | connection | \`rel { id data { … } meta { … } }\` |

## MCP tools

- **\`get_model_schema\`**: identifiers, object/repeated nesting, connections.  
- **\`get_field_design_guide\`** (this guide): selection & payload mental model.  
- **\`get_project_query_guide\`** resource / **\`get_project_query_structure\`**: operation names and filters.

When in doubt, compare to **\`get_model_schema\`**: **\`object\`** = one nested object; **\`repeated\`** = array of structured rows; **connection** → relation section **2**.
`;
    }

    private getProjectQueryGuideContent(): string {
        return `# Apito Project GraphQL Query Structure

For each model (e.g. \`Task\`, \`DentalAssessment\`), Apito generates a fixed set of operations. **CamelCase matters.**

## System API vs public project GraphQL

This guide describes the **public** project GraphQL shape (\`taskList\`, \`createTask\`, etc.) for apps and integrations that call the project endpoint. **apito-mcp** itself uses the **system** GraphQL API (with \`X-Apito-Key\`) for schema and \`getModelData\`—not the public endpoint. Public queries may differ in authentication, multi-tenant context, and how nested relations are batched; if something matches here but fails on public, check tenant tokens and the public schema separately.

## CRITICAL: Root document envelope vs nested object / repeated fields

**At the root of each model document** (each item in \`taskList\`, \`task(_id)\`, and each **relation** to another model), user-defined scalars belong under **\`data { … }\`** with **\`id\`**, **\`meta\`**, etc.

**WRONG (root):** \`articleList { id title slug category { id name } }\` — user fields on the document root  
**RIGHT (root):** \`articleList { id data { title slug } meta { created_at } category { id data { name } } }\`

**Nested \`object\` and \`repeated\` (array-of-object) fields** live inside that \`data\`, but they are **not** second mini-documents: **do not** wrap their children in an inner \`id data { }\` unless you are intentionally selecting a **relation** to another model.

- **Object field:** \`settings { mode type }\` — correct. \`settings { id data { mode } }\` — wrong.  
- **Repeated field:** \`lines { _id qty amount }\` — correct (include \`_id\` when you need row identity). \`lines { id data { qty } }\` — wrong.

Full rules, examples, and payload notes: MCP tool **\`get_field_design_guide\`** or resource **\`apito://field-design-guide\`**.

**multiline fields** (content, bio, description, etc.) MUST have sub-selection: \`content { html }\` or \`bio { text }\` — pick \`html\`, \`text\`, or \`markdown\`. **geo fields** MUST have sub-selection: \`location { lat lon }\`. Selecting them bare causes "must have a sub selection" error.

## Naming Convention

| Model (PascalCase) | Singular | List | Count | Create | Update | Delete | Upsert |
|--------------------|---------|------|-------|--------|--------|--------|--------|
| Task | task(_id) | taskList | taskListCount | createTask | updateTask | deleteTask | upsertTaskList |
| DentalAssessment | dentalAssessment(_id) | dentalAssessmentList | dentalAssessmentListCount | createDentalAssessment | updateDentalAssessment | deleteDentalAssessment | upsertDentalAssessmentList |
| Category | category(_id) | categoryList | categoryListCount | createCategory | updateCategory | deleteCategory | upsertCategoryList |

## The \`where\` Parameter (Filtering)

\`where\` is an object keyed by field names. Each field uses operators by type:

- **string** (text, multiline): \`eq\`, \`ne\`, \`in\`, \`not_in\`, \`contains\`
- **string** (date): \`eq\`, \`ne\`, \`before\`, \`after\`, \`between\`
- **int/double**: \`eq\`, \`ne\`, \`lt\`, \`lte\`, \`gt\`, \`gte\`, \`between\`, \`in\`, \`not_in\`
- **bool**: \`eq\`, \`ne\`
- **geo**: \`geo_within\` (lat, lon, km_radius)

Use \`OR: [{ field: { eq: "x" } }, { field: { eq: "y" } }]\` for OR logic. Use \`_key: { in: ["id1","id2"] }\` to filter by IDs (ignores rest of where).

## Connection queries and list filters

Relations are **bidirectional** (has_one, has_many, many_to_many). Three related concepts:

1. **Nested selection** — load related rows in the query result (\`class { id data { name } }\`, \`studentList { … }\`).
2. **\`relation\` list filter** — **default** way to filter a list by a linked model (has_one, has_many, M:N).
3. **\`connection\` list filter** — **advanced only**; anchor document + direction metadata. **Do not use** for simple “find rows whose related X matches …”.

### \`relation\` filter (use this)

Filter \`*List\` queries by conditions on a **related model**. Keys are the related model name or \`known_as\` from \`get_model_schema\` → \`connections[]\`.

Each relation key supports:

- **\`_id\`** — \`eq\`, \`ne\`, \`in\`, \`not_in\` on the related document id
- **Related scalar fields** — same operators as \`where\` on that model

**Example — student has one class; class has many students** (find students in one class):

\`\`\`graphql
query MyQuery {
  studentList(relation: { class: { _id: { eq: "01KW4M8K7WR57HB3G0DWN48CTZ" } } }) {
    id
    data { name }
    class {
      id
      data { name code }
    }
  }
}
\`\`\`

By related field instead of id:

\`\`\`graphql
studentList(relation: { class: { code: { eq: "C100" } } }) {
  id
  data { name }
}
\`\`\`

| Geometry | Typical filter |
|----------|------------------|
| **has_one** (FK on listed model) | \`studentList(relation: { class: { … } })\` |
| **has_many** (FK on child) | \`parentList(relation: { child: { … } })\` or filter from the child list |
| **many_to_many** | \`articleList(relation: { tag: { _id: { eq: "…" } } })\` |

Combine \`relation\` with \`where\`, \`page\`, \`limit\`, and \`sort\`.

### \`connection\` filter (advanced — rarely needed)

Only when you must constrain a list from a **specific anchor document** with explicit \`connection_type\` (forward/backward), \`to_model\`, and \`relation_type\`. **Not** for everyday “students in class X” / “orders for customer Y” — use \`relation\` above.

\`\`\`graphql
taskList(connection: {
  _id: "anchor_doc_id"
  connection_type: backward
  to_model: task
  relation_type: has_many
})
\`\`\`

### Nested selection (loading related data)

- **has_one**: single object — \`author { id data { name } }\`
- **has_many**: nested list with \`where\`, \`page\`, \`limit\`, \`sort\` — \`bookList(where: {...}, page: 1, limit: 10) { id data { title } }\`

**Schema link removal (MCP \`delete_relation\`):** one \`deleteConnectionFromModel\` call **drops the connection on both models** (forward and reverse). Pick either model as \`from_model\`, the peer as \`to_model\`, correct \`known_as\` — then **do not** delete again from the other model for the same edge.

## Pagination

- \`page\`: 1-based page number
- \`limit\`: Items per page (default 10). Use \`-1\` for no limit
- \`sort\`: \`{ fieldName: ASC, anotherField: DESC }\`

## Full Query/Mutation Args

**List**: \`where\`, \`page\`, \`limit\`, \`local\`, \`status\` (all/draft/published), \`_key\`, \`connection\`, \`relation\`, \`sort\`, \`groupBy\`
**Create**: \`payload\`, \`local\`, \`status\`, \`connect\` (relation IDs)
**Update**: \`_id\`, \`payload\`, \`connect\`, \`disconnect\`, \`keepRevision\`, \`deltaUpdate\`
**Delete**: \`_ids\`
**Upsert**: \`payloads\`, \`local\`, \`status\`

## What Is Possible vs Not

**Possible**: CRUD, filters by field type, OR/AND, pagination, sort, groupBy, relations (has_one, has_many, M:N), **\`relation\` list filters** (default for cross-model list filtering), **\`connection\` list filters** (advanced anchor traversal only), locale, draft/published.
**Not**: Raw SQL, cross-model filters without relation, recursive graph traversal, full-text across all fields, schema changes via project API.

Use the \`get_project_query_structure\` tool to get the mapping for your project models. For nested object/repeated field selection rules (avoid extra \`data\` wrappers on embedded object/repeated fields), call MCP tool \`get_field_design_guide\` or read resource \`apito://field-design-guide\`.

**Schema versioning:** Public project GraphQL reflects **published (live)** schema only. MCP may stage draft models via system mutations; they appear in public API only after Console publish. See \`apito://schema-versioning-guide\`.`;
    }

    private async handleAddRelation(args: {
        from_model: string;
        to_model: string;
        forward_connection_type: 'has_many' | 'has_one';
        reverse_connection_type: 'has_many' | 'has_one';
        known_as?: string;
    }) {
        const connections = await this.client!.upsertConnectionToModel(
            args.from_model,
            args.to_model,
            args.forward_connection_type,
            args.reverse_connection_type,
            args.known_as
        );

        const text = await this.formatStagingMutationResponse(
            `add relation ${args.from_model} ↔ ${args.to_model}`,
            connections
        );

        return {
            content: [
                {
                    type: 'text',
                    text:
                        `Relation between "${args.from_model}" and "${args.to_model}".\n\nForward: ${args.from_model} ${args.forward_connection_type} ${args.to_model}\nReverse: ${args.to_model} ${args.reverse_connection_type} ${args.from_model}\n\n` +
                        text,
                },
            ],
        };
    }

    private async handleGetSchemaVersioningStatus() {
        const status = await this.getSchemaContext().getStatus(true);
        const reminder = formatUserPublishReminder(status);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(status, null, 2) + reminder,
                },
            ],
        };
    }

    private async handleGetSchemaPreview(args: { source: string; version?: number }) {
        const source = args.source as SchemaPreviewSource;
        if (source !== 'live' && source !== 'draft' && source !== 'version') {
            throw new Error('source must be live, draft, or version');
        }
        const models = await this.getSchemaContext().getPreview(source, args.version);
        const status = await this.getSchemaContext().getStatus();
        return {
            content: [
                {
                    type: 'text',
                    text:
                        `Schema preview (source: ${source}, ${models.length} model(s)):\n\n` +
                        JSON.stringify({ models }, null, 2) +
                        formatUserPublishReminder(status),
                },
            ],
        };
    }

    private async handleGetEffectiveSchema() {
        const summary = await this.getSchemaContext().getEffectiveSchemaSummary();
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(summary, null, 2),
                },
            ],
        };
    }

    private async handleGetSchemaChangePlan(args: { changeset_id?: string } = {}) {
        const status = await this.getSchemaContext().getStatus(true);
        const changesetId = args.changeset_id || status.changeset_id;
        const records = await this.getSchemaContext().getChangePlan(changesetId);
        const reminder = formatUserPublishReminder(status);
        const header =
            `Publish plan (${records.length} record(s), changeset: ${changesetId ?? 'none'}). ` +
            `Local/Remote columns are pending until the user publishes in Console → Schema Changes.\n\n`;
        return {
            content: [
                {
                    type: 'text',
                    text: header + JSON.stringify(records, null, 2) + reminder,
                },
            ],
        };
    }

    private async handleSummarizeSchemaDraftForReview() {
        const summary = await this.getSchemaContext().getEffectiveSchemaSummary();
        const status = summary.versioning as import('./types.js').SchemaVersioningStatus;
        const records = await this.getSchemaContext().getChangePlan(status.changeset_id);

        const draftOnly = (summary.draft_only_models as string[]) ?? [];
        const effectiveModels = (summary.effective_models as import('./types.js').ApitoModel[]) ?? [];

        let md = `# Schema draft summary\n\n`;
        md += `- Versioning enabled: **${status.enabled}**\n`;
        md += `- Active published version: **${status.active_version}**\n`;
        md += `- Has draft: **${status.has_draft}**\n`;
        if (status.changeset_id) {
            md += `- Changeset: \`${status.changeset_id}\` (${status.pending_operations ?? 0} operation(s))\n`;
        }
        md += `\n## Effective models (${effectiveModels.length})\n\n`;
        for (const m of effectiveModels) {
            const draftTag = draftOnly.includes(m.name) ? ' *(draft-only — not published)*' : '';
            md += `- **${m.name}**${draftTag}: ${m.fields?.length ?? 0} field(s), ${m.connections?.length ?? 0} connection(s)\n`;
        }

        md += `\n## Publish plan (${records.length} steps)\n\n`;
        md += `| # | Action | Target | Impact | Status |\n|---|--------|--------|--------|--------|\n`;
        for (const r of records) {
            md += `| ${r.sequence ?? '-'} | ${r.action_key ?? '-'} | ${r.target_name ?? '-'} | ${r.impact ?? '-'} | ${r.status ?? r.local_status ?? '-'} |\n`;
        }

        md += formatUserPublishReminder(status);
        md += `\n\nUse \`get_effective_schema\` for full JSON or \`get_schema_change_plan\` for detailed execution records.`;

        return {
            content: [{ type: 'text' as const, text: md }],
        };
    }

    private async handleUpsertData(args: {
        model_name: string;
        payload: Record<string, any>;
        _id?: string;
        status?: string;
        local?: string;
        connect?: Record<string, any>;
        disconnect?: Record<string, any>;
        tenant_id?: string;
    }) {
        await this.getSchemaContext().assertModelPublished(args.model_name);

        const doc = await this.client!.upsertModelData(
            args.model_name,
            args.payload,
            {
                _id: args._id,
                status: args.status,
                local: args.local,
                connect: args.connect,
                disconnect: args.disconnect,
            },
            this.tenantReqOpts(args.tenant_id)
        );

        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully upserted record in "${args.model_name}".\n\n${JSON.stringify(doc, null, 2)}`,
                },
            ],
        };
    }

    private async handleGetData(args: {
        model_name: string;
        page?: number;
        limit?: number;
        where?: Record<string, any>;
        status?: string;
        search?: string;
        tenant_id?: string;
    }) {
        await this.getSchemaContext().assertModelPublished(args.model_name);

        const result = await this.client!.getModelData(
            args.model_name,
            {
                page: args.page,
                limit: args.limit,
                where: args.where,
                status: args.status,
                search: args.search,
            },
            this.tenantReqOpts(args.tenant_id)
        );

        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${result.count} record(s) in "${args.model_name}".\n\n${JSON.stringify(result, null, 2)}`,
                },
            ],
        };
    }

    private async handleDeleteData(args: { model_name: string; _id: string; tenant_id?: string }) {
        await this.getSchemaContext().assertModelPublished(args.model_name);

        const deleted = await this.client!.deleteModelData(
            args.model_name,
            args._id,
            this.tenantReqOpts(args.tenant_id)
        );

        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully deleted record ${deleted.id} from "${args.model_name}".`,
                },
            ],
        };
    }

    private async handleDuplicateData(args: { model_name: string; _id: string; tenant_id?: string }) {
        await this.getSchemaContext().assertModelPublished(args.model_name);

        const duplicated = await this.client!.duplicateModelData(
            args.model_name,
            args._id,
            this.tenantReqOpts(args.tenant_id)
        );

        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully duplicated record. New record ID: ${duplicated.id}`,
                },
            ],
        };
    }

    private async handleGetModelSchema(args: { model_name: string; source?: string }) {
        const source = await this.resolveSchemaSource(args.source);
        const { models, status, sourceUsed } = await this.getSchemaContext().resolveModels(source);
        const model = models.find((m) => m.name.toLowerCase() === args.model_name.toLowerCase());

        if (!model) {
            const hint =
                status.enabled && status.has_draft
                    ? ' Try source=effective or get_effective_schema — the model may exist only in the draft.'
                    : '';
            return {
                content: [
                    {
                        type: 'text',
                        text: `Model "${args.model_name}" not found (source: ${sourceUsed}).${hint}`,
                    },
                ],
                isError: true,
            };
        }

        return {
            content: [
                {
                    type: 'text',
                    text:
                        `Schema for model "${args.model_name}" (source: ${sourceUsed}):\n\n` +
                        JSON.stringify(model, null, 2) +
                        formatUserPublishReminder(status),
                },
            ],
        };
    }

    private getSaaSModelClassificationGuideContent(): string {
        return `# Apito SaaS model classification (common vs tenant-scoped)

Use this guide on **SaaS projects** (\`project_type: "saas"\`) before calling \`create_model\`. Call \`get_project_context\` first to confirm project type and \`tenant_model_name\`.

## Three model scopes

| Scope | Flag | Who sees the data | tenant_id column |
|-------|------|-------------------|------------------|
| **Tenant-scoped** (default) | omit \`is_common_model\` or \`false\` | Each tenant only their own rows | Yes (shared DB) |
| **Common (project-wide)** | \`is_common_model: true\` | **All tenants** read and write the **same** rows | No |
| **Tenant catalogue** | (bootstrap only) | Registry of tenants — model name matches \`tenant_model_name\` on project | No |

**Common models are not related to any tenant.** They do not get tenant filters on queries and do not stamp \`tenant_id\` on inserts. Every tenant in the project shares one dataset — like a global config table inside the app.

## When to use \`is_common_model: true\`

Use a **common model** when the data is **identical for all tenants** and **must not be isolated per tenant**:

1. **App release policy** (\`app_release_policy\`) — minimum version, force-update rules, maintenance windows that apply to every tenant's app install.
2. **Hospital management — medicine catalog** (\`medicine\`, \`drug_formulary\`) — shared drug reference list used by all hospital branches; **not** patient-specific prescriptions.
3. **Global product/SKU catalog** — franchise-wide menu or inventory master when every location sells the same items.
4. **Feature flags / global settings** — toggles that affect the whole product, not one customer.
5. **Reference/lookup tables** — countries, ICD codes, tax brackets when all tenants share the same reference set.

## When NOT to use common (keep tenant-scoped)

Use the **default** (do **not** set \`is_common_model\`) when data belongs to **one tenant only**:

- **Patients, appointments, orders, invoices** — Hospital A must never see Hospital B's records.
- **User-generated content per customer** — posts, tickets, carts, subscriptions.
- **Tenant-specific configuration** — branding, billing profile, local staff.

If in doubt: *"Should tenant A ever see tenant B's rows?"* → **No** → tenant-scoped. **Yes, same rows for everyone** → common.

## MCP tools

### Create with the right scope

\`\`\`
create_model({
  model_name: "app_release_policy",
  is_common_model: true
})
\`\`\`

\`\`\`
create_model({
  model_name: "patient"
  // is_common_model omitted → tenant-scoped
})
\`\`\`

### Fix an existing model

If a model was created without the flag but should be project-wide:

\`\`\`
update_model({
  model_name: "app_release_policy",
  is_common_model: true
})
\`\`\`

Metadata-only \`is_common_model\` updates apply **immediately** on pro engines (no schema publish required).

### Inspect scope

- \`list_models\` — shows \`common (project-wide)\`, \`tenant-scoped\`, or \`tenant catalogue\` per model.
- \`get_model_schema\` — JSON includes \`is_common_model\` when available.

## Shared database vs separate DB per tenant

Check \`get_project_context\`:

- \`per_tenant_separate_database: false\` (**shared DB**) — \`is_common_model\` is **critical**. Wrong scope causes SQL errors (\`no such column: tenant_id\`) or wrong isolation.
- \`per_tenant_separate_database: true\` — each tenant has its own database; scope still affects filters and public API shape, but physical layout differs.

## Tenant routing (separate from model scope)

- **Model scope** (\`is_common_model\`) — *what data is shared vs isolated*.
- **Request tenant** (\`TENANT_ID\` / \`X-Apito-Tenant-ID\`) — *which tenant context the current API call runs under* for tenant-scoped models and per-tenant DB routing.

You still send tenant headers for SaaS data calls even when reading common models (the engine ignores tenant filter for common models).

## Example: multi-tenant hospital SaaS

| Model | Scope | Why |
|-------|-------|-----|
| \`tenant\` | tenant catalogue | Registry of hospital branches |
| \`medicine\` | **common** | Shared drug formulary for all hospitals |
| \`patient\` | tenant-scoped | Each hospital's patients |
| \`appointment\` | tenant-scoped | Each hospital's schedule |
| \`app_release_policy\` | **common** | Mobile app update rules for all installs |

## Workflow checklist

1. \`get_project_context\` — confirm SaaS + shared vs separate DB.
2. Read this guide (or \`get_saas_model_guide\`).
3. \`create_model\` with \`is_common_model: true\` only when data is truly global.
4. \`list_models\` — verify scope labels after create.
5. Publish schema in Console if versioning staged other changes.
`;
    }

    private getSchemaVersioningGuideContent(): string {
        return `# Apito schema versioning (MCP guide)

Pro Apito projects use **schema versioning**: system GraphQL mutations **stage** changes into a draft changeset. **Nothing is published automatically.**

## Workflow

1. Call \`get_schema_migration_guide\` before bulk schema / migration work.
2. Call \`get_schema_versioning_status\` at the start of schema work.
2. Use \`create_model\`, \`add_field\`, \`add_relation\`, etc. — these stage draft operations on pro engines.
3. Verify with \`get_effective_schema\` or \`get_schema_preview(source: "draft")\`.
4. Review the publish plan with \`get_schema_change_plan\`.
5. End sessions with \`summarize_schema_draft_for_review\`.
6. **User** opens Apito Console → Project Settings → **Schema Changes** → reviews timeline → **Publish manually**.

**MCP never publishes.** It does not call \`approveSchemaChanges\` or similar mutations.

## Live vs draft vs effective

| Source | Meaning |
|--------|---------|
| **live** | Published schema — what public GraphQL and physical tables use today |
| **draft** | Staged changeset only (not yet published) |
| **effective** | Merged live + draft (console overlay parity) — use to verify MCP work |

Tools \`list_models\`, \`get_model_schema\`, and \`get_relation_graph\` accept optional \`source\`. Default: **effective** when a draft exists, else **live**.

## Data tools

\`upsert_data\`, \`get_data\`, \`delete_data\`, and \`duplicate_data\` require the model to exist in **live (published)** schema. Draft-only models are blocked with an error until publish.

## Publish plan columns

\`get_schema_change_plan\` returns \`schemaChangeExecutionRecords\`. **Local/Remote** statuses are pending until the user publishes in Console. After publish, remote may reflect backup/sync (Litestream), not live schema mutation.

## Environment

- \`TENANT_ID\` / \`APITO_TENANT_ID\` — sent as \`X-Apito-Tenant-ID\` for SaaS per-tenant DB scope
- \`APITO_MCP_TEMP_TENANT_COOKIE=true\` — also sends \`temp_tenant_id\` cookie when needed

## SaaS model scope

On SaaS projects, call \`get_saas_model_guide\` or read \`apito://saas-model-guide\` before \`create_model\`. Use \`is_common_model: true\` for project-wide models (all tenants share rows); default is tenant-scoped.

## Schema migration

For migrations from any source (JSON export, another project, gap diff), call \`get_schema_migration_guide\` or read \`apito://schema-migration-guide\` first.
`;
    }

    private validateModelName(name: string) {
        const reserved = ['list', 'user', 'system', 'function'];
        const lowerName = name.toLowerCase();

        if (reserved.includes(lowerName)) {
            throw new Error(
                `Model name "${name}" is reserved. Reserved names: ${reserved.join(', ')}`
            );
        }

        if (/^\d/.test(name)) {
            throw new Error('Model name cannot start with a number');
        }
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        // Use console.error for logging (stderr) - important for STDIO servers
        console.error('[Apito MCP] Server initialized and running on stdio');
        console.error(`[Apito MCP] GraphQL endpoint: ${this.graphqlEndpoint}`);
    }
}

// Main entry point for stdio mode
// Only run if executed directly (not imported)
declare const process: any;
declare const console: any;

const isDirectRun =
    typeof process !== 'undefined' &&
    process.argv?.[1] &&
    import.meta.url === new URL(process.argv[1], 'file:').href;

if (isDirectRun) {
    // Default to system GraphQL endpoint for system queries like projectModelsInfo
    let endpoint = process.env.APITO_GRAPHQL_ENDPOINT || 'https://api.apito.io/system/graphql';

    // If user provided /secured/graphql, convert to /system/graphql for system queries
    if (endpoint.includes('/secured/graphql')) {
        endpoint = endpoint.replace('/secured/graphql', '/system/graphql');
    }

    const token = process.env.APITO_AUTH_TOKEN || process.env.APITO_API_KEY || '';

    if (!token) {
        console.error('[Apito MCP] Error: APITO_AUTH_TOKEN or APITO_API_KEY environment variable is required');
        process.exit(1);
    }

    // Log initialization (to stderr)
    console.error('[Apito MCP] Starting server...');
    console.error(`[Apito MCP] Endpoint: ${endpoint}`);
    const tid = process.env.TENANT_ID || process.env.APITO_TENANT_ID;
    if (tid) {
        console.error(`[Apito MCP] TENANT_ID / APITO_TENANT_ID set (X-Apito-Tenant-ID will be sent)`);
    }
    if (process.env.APITO_MCP_TEMP_TENANT_COOKIE === 'true') {
        console.error('[Apito MCP] APITO_MCP_TEMP_TENANT_COOKIE=true (also sending temp_tenant_id cookie)');
    }

    const server = new ApitoMCPServer(endpoint, token);
    server.run().catch((err: any) => console.error('[Apito MCP] Fatal error:', err));
}

