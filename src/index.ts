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
import { ApitoGraphQLClient } from './graphql-client.js';
import { SchemaParser } from './schema-parser.js';
import { FieldResolver } from './field-resolver.js';
import type { ParsedField, ValidationInput } from './types.js';

export class ApitoMCPServer {
    private server: Server;
    private client: ApitoGraphQLClient | null = null;
    private graphqlEndpoint: string;
    private authToken: string;
    // Store handler references for HTTP transport
    private listToolsHandler?: (request: any) => Promise<any>;
    private callToolHandler?: (request: any) => Promise<any>;
    private listPromptsHandler?: (request: any) => Promise<any>;
    private getPromptHandler?: (request: any) => Promise<any>;
    private listResourcesHandler?: (request: any) => Promise<any>;
    private readResourceHandler?: (request: any) => Promise<any>;

    constructor(graphqlEndpoint: string, apiKey: string) {
        this.graphqlEndpoint = graphqlEndpoint;
        this.authToken = apiKey; // Store as authToken for backward compatibility
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

    private setupHandlers() {
        // List available tools
        this.listToolsHandler = async () => ({
            tools: [
                {
                    name: 'create_model',
                    description: 'Create a new model in Apito. Models are collections that define the structure of your data.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model to create (e.g., "dentalAssessment", "patient")',
                            },
                            single_record: {
                                type: 'boolean',
                                description: 'Whether this model should store only a single record (like settings)',
                                default: false,
                            },
                        },
                        required: ['model_name'],
                    },
                },
                {
                    name: 'add_field',
                    description: `Add a field to an existing model. You must specify field_type and input_type explicitly. Valid combinations:
- Text Field: field_type="text", input_type="string" (Single line text input)
- Rich Text Field: field_type="multiline", input_type="string" (Multiline editor with formatting)
- DateTime Field: field_type="date", input_type="string" (Date & Time input)
- Dynamic Array: field_type="list", field_sub_type="dynamicList", input_type="string" (Flexible list allowing multiple items)
- Dropdown Menu: field_type="list", field_sub_type="dropdown", input_type="string" (Predefined list for single selection). REQUIRES validation.fixed_list_elements (array of strings) and validation.fixed_list_element_type="string"
- Multi-Checkbox Selector: field_type="list", field_sub_type="multiSelect", input_type="string" (Allows selecting multiple options). REQUIRES validation.fixed_list_elements (array of strings) and validation.fixed_list_element_type="string"
- Boolean Field: field_type="boolean", input_type="bool" (True or False toggle)
- File Upload: field_type="media", input_type="string" (Upload images or files)
- Integer Field: field_type="number", input_type="int" (Whole numbers only)
- Decimal Field: field_type="number", input_type="double" (Decimal numbers)
- GeoPoint Field: field_type="geo", input_type="geo" (Latitude & Longitude)
- Object Schema: field_type="object", input_type="object" (Single object with multiple fields, set is_object_field=true)
- Array Schema: field_type="repeated", input_type="repeated" (List of objects with multiple fields, set is_object_field=true)
For nested fields (objects/arrays), set parent_field and is_object_field appropriately.`,
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
                                description: 'Field type. Valid values: text, multiline, number, date, boolean, media, object, repeated, list, geo',
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
                                description: 'Parent field name if this is a nested field (for objects/arrays)',
                            },
                            is_object_field: {
                                type: 'boolean',
                                description: 'Whether this field is an object/array field that can contain nested fields. Set to true for object and repeated field types.',
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
                    description: 'Delete a field from a model',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model',
                            },
                            field_name: {
                                type: 'string',
                                description: 'Field identifier to delete',
                            },
                            parent_field: {
                                type: 'string',
                                description: 'Parent field name if this is a nested field',
                            },
                        },
                        required: ['model_name', 'field_name'],
                    },
                },
                {
                    name: 'delete_model',
                    description: 'Delete a model from the project. This will also delete all data in the model.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model to delete',
                            },
                        },
                        required: ['model_name'],
                    },
                },
                {
                    name: 'list_models',
                    description: 'List all models in the current Apito project',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'get_model_schema',
                    description: 'Get the complete schema for a model including all fields and their types',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            model_name: {
                                type: 'string',
                                description: 'Name of the model to get schema for',
                            },
                        },
                        required: ['model_name'],
                    },
                },
                {
                    name: 'add_relation',
                    description: 'Create a relation between two models. Relations define how models are connected (e.g., a Patient has many DentalAssessments, or a DentalAssessment belongs to one Patient).',
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
            ],
        });
        this.server.setRequestHandler(ListToolsRequestSchema, this.listToolsHandler);

        // Handle tool calls
        this.callToolHandler = async (request) => {
            if (!this.client) {
                this.client = new ApitoGraphQLClient(this.graphqlEndpoint, this.authToken);
            }

            const { name, arguments: args } = request.params;

            try {
                switch (name) {
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
                    case 'list_models':
                        return await this.handleListModels();
                    case 'get_model_schema':
                        return await this.handleGetModelSchema(args as any);
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

        // List available resources (model schemas)
        this.listResourcesHandler = async (_request: any) => {
            if (!this.client) {
                this.client = new ApitoGraphQLClient(this.graphqlEndpoint, this.authToken);
            }

            try {
                const models = await this.client.getProjectModelsInfo();

                return {
                    resources: models.map(model => ({
                        uri: `apito://model/${model.name}`,
                        name: `Model: ${model.name}`,
                        description: `Schema for ${model.name} model with ${model.fields?.length || 0} fields`,
                        mimeType: 'application/json',
                    })),
                };
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
            if (!this.client) {
                this.client = new ApitoGraphQLClient(this.graphqlEndpoint, this.authToken);
            }

            const { uri } = request.params;

            // Parse URI: apito://model/{modelName}
            const match = uri.match(/^apito:\/\/model\/(.+)$/);
            if (!match) {
                throw new Error(`Invalid resource URI: ${uri}. Expected format: apito://model/{modelName}`);
            }

            const modelName = match[1];

            try {
                const models = await this.client.getProjectModelsInfo(modelName);

                if (models.length === 0) {
                    throw new Error(`Model "${modelName}" not found`);
                }

                const model = models[0];

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

    private async handleCreateModel(args: { model_name: string; single_record?: boolean }) {
        this.validateModelName(args.model_name);

        const models = await this.client!.addModelToProject(
            args.model_name,
            args.single_record
        );

        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully created model "${args.model_name}".\n\nModel details:\n${JSON.stringify(models[0], null, 2)}`,
                },
            ],
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

        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully added field "${args.field_label}" to model "${args.model_name}".\n\nField details:\n${JSON.stringify(field, null, 2)}`,
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

        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully updated field "${args.field_name}" in model "${args.model_name}".\n\nField details:\n${JSON.stringify(field, null, 2)}`,
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

        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully renamed field "${args.field_name}" to "${args.new_name}" in model "${args.model_name}".\n\nField details:\n${JSON.stringify(field, null, 2)}`,
                },
            ],
        } as any;
    }

    private async handleDeleteField(args: {
        model_name: string;
        field_name: string;
        parent_field?: string;
    }) {
        const field = await this.client!.modelFieldOperation(
            'delete',
            args.model_name,
            args.field_name,
            { parentField: args.parent_field }
        );
        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully deleted field "${args.field_name}" from model "${args.model_name}".`,
                },
            ],
        };
    }

    private async handleDeleteModel(args: {
        model_name: string;
    }) {
        const model = await this.client!.updateModel(
            'delete',
            args.model_name
        );
        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully deleted model "${args.model_name}" and all its data.`,
                },
            ],
        };
    }

    private async handleListModels() {
        const models = await this.client!.getProjectModelsInfo();

        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${models.length} model(s):\n\n${models.map(m => `- ${m.name} (${m.fields?.length || 0} fields)`).join('\n')}`,
                },
            ],
        };
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

        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully created relation between "${args.from_model}" and "${args.to_model}".\n\nForward: ${args.from_model} ${args.forward_connection_type} ${args.to_model}\nReverse: ${args.to_model} ${args.reverse_connection_type} ${args.from_model}\n\nConnection details:\n${JSON.stringify(connections, null, 2)}`,
                },
            ],
        };
    }

    private async handleGetModelSchema(args: { model_name: string }) {
        const models = await this.client!.getProjectModelsInfo(args.model_name);

        if (models.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Model "${args.model_name}" not found.`,
                    },
                ],
                isError: true,
            };
        }

        const model = models[0];

        return {
            content: [
                {
                    type: 'text',
                    text: `Schema for model "${args.model_name}":\n\n${JSON.stringify(model, null, 2)}`,
                },
            ],
        };
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

if (typeof process !== 'undefined' && process.argv) {
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

    const server = new ApitoMCPServer(endpoint, token);
    server.run().catch((err: any) => console.error('[Apito MCP] Fatal error:', err));
}

