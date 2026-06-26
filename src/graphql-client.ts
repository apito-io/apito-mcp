import { GraphQLClient } from 'graphql-request';
import type {
  GraphQLResponse,
  ValidationInput,
  ApitoModel,
  ApitoField,
  ApitoConnection,
  ApitoDocument,
  GetModelDataResponse,
  SchemaVersioningStatus,
  SchemaPreviewSource,
  SchemaChangeExecutionRecord,
} from './types.js';

/** Per-request overrides (e.g. tenant scope for a single tool call). */
export type GraphQLRequestOptions = {
  tenantId?: string;
};

/** Optional headers for SaaS / MCP (see engine pro_token_hook tenant resolution). */
export type ApitoGraphQLClientOptions = {
  /** Sent as `X-Apito-Tenant-ID` (preferred for per-tenant DB routing). */
  tenantId?: string;
  /** If true and tenantId is set, also sends `Cookie: temp_tenant_id=…` (same fallback order as the engine). */
  sendTempTenantCookie?: boolean;
};

export class ApitoGraphQLClient {
  private readonly endpoint: string;
  private readonly authToken: string;
  private readonly defaultOptions: ApitoGraphQLClientOptions;

  constructor(endpoint: string, token: string, options: ApitoGraphQLClientOptions = {}) {
    this.endpoint = endpoint;
    this.authToken = token;
    this.defaultOptions = options;
  }

  private buildHeaders(reqOpts?: GraphQLRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Apito-Key': this.authToken,
      'Content-Type': 'application/json',
    };
    const tid = (reqOpts?.tenantId ?? this.defaultOptions.tenantId)?.trim();
    if (tid) {
      headers['X-Apito-Tenant-ID'] = tid;
    }
    const sendCookie =
      this.defaultOptions.sendTempTenantCookie ||
      (typeof process !== 'undefined' && process.env?.APITO_MCP_TEMP_TENANT_COOKIE === 'true');
    if (sendCookie && tid) {
      headers['Cookie'] = `temp_tenant_id=${encodeURIComponent(tid)}`;
    }
    return headers;
  }

  /** Execute GraphQL with optional per-request tenant override. */
  async request<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    reqOpts?: GraphQLRequestOptions
  ): Promise<T> {
    const client = new GraphQLClient(this.endpoint, {
      headers: this.buildHeaders(reqOpts),
    });
    try {
      const response = await client.request<unknown>(query, variables);

      if (
        response &&
        typeof response === 'object' &&
        'errors' in response &&
        Array.isArray((response as { errors?: unknown[] }).errors) &&
        (response as { errors: unknown[] }).errors.length > 0
      ) {
        const errors = (response as { errors: Array<{ message?: string; path?: unknown[]; extensions?: { code?: string } }> }).errors;
        const errorMessages = errors
          .map((e) => {
            const path = e.path ? ` (path: ${(e.path as string[]).join('.')})` : '';
            const code = e.extensions?.code ? ` [${e.extensions.code}]` : '';
            return `${e.message}${code}${path}`;
          })
          .join('; ');
        throw new Error(`GraphQL errors: ${errorMessages}`);
      }

      return response as T;
    } catch (error: unknown) {
      const err = error as { response?: { errors?: unknown[] }; message?: string };
      if (err.response) {
        const errors = err.response.errors || [];
        const errorMessages = (errors as Array<{ message?: string; path?: unknown[]; extensions?: { code?: string } }>)
          .map((e) => {
            const path = e.path ? ` (path: ${(e.path as string[]).join('.')})` : '';
            const code = e.extensions?.code ? ` [${e.extensions.code}]` : '';
            return `${e.message}${code}${path}`;
          })
          .join('; ');
        throw new Error(`GraphQL request failed: ${errorMessages || JSON.stringify(err.response)}`);
      }
      if (err.message) {
        throw new Error(`Request failed: ${err.message}`);
      }
      throw new Error(`Request failed: ${JSON.stringify(error)}`);
    }
  }

  private async execute<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    reqOpts?: GraphQLRequestOptions
  ): Promise<T> {
    return this.request<T>(query, variables, reqOpts);
  }

  async addModelToProject(
    name: string,
    singleRecord?: boolean,
    isCommonModel?: boolean
  ): Promise<ApitoModel[]> {
    const mutation = `
      mutation AddModelToProject($name: String!, $single_record: Boolean, $is_common_model: Boolean) {
        addModelToProject(name: $name, single_record: $single_record, is_common_model: $is_common_model) {
          name
          is_common_model
          fields {
            identifier
            label
            field_type
            input_type
            serial
          }
        }
      }
    `;

    const variables: Record<string, unknown> = { name, single_record: singleRecord };
    if (isCommonModel !== undefined) {
      variables.is_common_model = isCommonModel;
    }

    const result = await this.execute<{ addModelToProject: ApitoModel[] }>(
      mutation,
      variables
    );

    return result.addModelToProject;
  }

  async upsertFieldToModel(
    modelName: string,
    fieldLabel: string,
    fieldType: string,
    inputType: string,
    options: {
      parentField?: string;
      isObjectField?: boolean;
      isUpdate?: boolean;
      serial?: number;
      fieldDescription?: string;
      fieldSubType?: string;
      validation?: ValidationInput;
    } = {}
  ): Promise<ApitoField> {
    const mutation = `
      mutation UpsertFieldToModel(
        $model_name: String!
        $field_label: String!
        $field_type: FIELD_TYPE_ENUM
        $field_sub_type: FIELD_SUB_TYPE_ENUM
        $input_type: INPUT_TYPE_ENUM
        $parent_field: String
        $is_object_field: Boolean
        $is_update: Boolean
        $serial: Int
        $field_description: String
        $validation: module_validation_payload
      ) {
        upsertFieldToModel(
          model_name: $model_name
          field_label: $field_label
          field_type: $field_type
          field_sub_type: $field_sub_type
          input_type: $input_type
          parent_field: $parent_field
          is_object_field: $is_object_field
          is_update: $is_update
          serial: $serial
          field_description: $field_description
          validation: $validation
        ) {
          identifier
          label
          field_type
          field_sub_type
          input_type
          description
          serial
          parent_field
        }
      }
    `;

    const variables: Record<string, any> = {
      model_name: modelName,
      field_label: fieldLabel,
      field_type: fieldType,
      input_type: inputType,
    };

    if (options.fieldSubType) variables.field_sub_type = options.fieldSubType;
    if (options.parentField) variables.parent_field = options.parentField;
    if (options.isObjectField !== undefined) variables.is_object_field = options.isObjectField;
    if (options.isUpdate !== undefined) variables.is_update = options.isUpdate;
    if (options.serial !== undefined) variables.serial = options.serial;
    if (options.fieldDescription) variables.field_description = options.fieldDescription;
    if (options.validation) variables.validation = options.validation;

    const result = await this.execute<{ upsertFieldToModel: ApitoField }>(
      mutation,
      variables
    );

    return result.upsertFieldToModel;
  }

  async updateModel(
    type: 'update' | 'rename' | 'duplicate' | 'delete' | 'convert',
    modelName: string,
    options: {
      newName?: string;
      singlePageModel?: boolean;
      isCommonModel?: boolean;
    } = {}
  ): Promise<ApitoModel> {
    const mutation = `
      mutation UpdateModel(
        $type: UpdateModelTypeEnum!
        $model_name: String!
        $new_name: String
        $single_page_model: Boolean
        $is_common_model: Boolean
      ) {
        updateModel(
          type: $type
          model_name: $model_name
          new_name: $new_name
          single_page_model: $single_page_model
          is_common_model: $is_common_model
        ) {
          name
          is_common_model
          fields {
            identifier
            label
            field_type
            input_type
            serial
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      type,
      model_name: modelName,
    };

    if (options.newName) variables.new_name = options.newName;
    if (options.singlePageModel !== undefined) variables.single_page_model = options.singlePageModel;
    if (options.isCommonModel !== undefined) variables.is_common_model = options.isCommonModel;

    const result = await this.execute<{ updateModel: ApitoModel }>(
      mutation,
      variables
    );

    return result.updateModel;
  }

  async modelFieldOperation(
    type: string,
    modelName: string,
    fieldName: string,
    options: {
      newName?: string;
      parentField?: string;
      singlePageModel?: boolean;
      knownAs?: string;
      movedTo?: string;
      changedType?: string;
    } = {}
  ): Promise<ApitoField> {
    const mutation = `
      mutation ModelFieldOperation(
        $type: FIELD_OPERATION_TYPE_ENUM!
        $model_name: String!
        $field_name: String!
        $new_name: String
        $parent_field: String
        $single_page_model: Boolean
        $known_as: String
        $moved_to: String
        $changed_type: String
      ) {
        modelFieldOperation(
          type: $type
          model_name: $model_name
          field_name: $field_name
          new_name: $new_name
          parent_field: $parent_field
          single_page_model: $single_page_model
          known_as: $known_as
          moved_to: $moved_to
          changed_type: $changed_type
        ) {
          identifier
          label
          field_type
          input_type
          serial
        }
      }
    `;

    const variables: Record<string, any> = {
      type,
      model_name: modelName,
      field_name: fieldName,
    };

    if (options.newName) variables.new_name = options.newName;
    if (options.parentField) variables.parent_field = options.parentField;
    if (options.singlePageModel !== undefined) variables.single_page_model = options.singlePageModel;
    if (options.knownAs !== undefined) variables.known_as = options.knownAs;
    if (options.movedTo) variables.moved_to = options.movedTo;
    if (options.changedType) variables.changed_type = options.changedType;

    const result = await this.execute<{ modelFieldOperation: ApitoField }>(
      mutation,
      variables
    );

    return result.modelFieldOperation;
  }

  /** System mutation `deleteConnectionFromModel` — removes schema connection (inverse of upsertConnectionToModel). */
  async deleteConnectionFromModel(
    fromModel: string,
    toModel: string,
    knownAs?: string
  ): Promise<ApitoConnection[]> {
    const mutation = `
      mutation DeleteConnectionFromModel(
        $from: String!
        $to: String!
        $known_as: String
      ) {
        deleteConnectionFromModel(from: $from, to: $to, known_as: $known_as) {
          type
          relation
          model
          known_as
        }
      }
    `;

    const variables: Record<string, any> = {
      from: fromModel,
      to: toModel,
    };
    if (knownAs !== undefined && knownAs !== '') {
      variables.known_as = knownAs;
    }

    const result = await this.execute<{ deleteConnectionFromModel: ApitoConnection[] }>(
      mutation,
      variables
    );

    return result.deleteConnectionFromModel;
  }

  async upsertConnectionToModel(
    fromModel: string,
    toModel: string,
    forwardConnectionType: 'has_many' | 'has_one',
    reverseConnectionType: 'has_many' | 'has_one',
    knownAs?: string
  ): Promise<ApitoConnection[]> {
    const mutation = `
      mutation UpsertConnectionToModel(
        $forward_connection_type: RELATION_TYPE_ENUM!
        $from: String!
        $reverse_connection_type: RELATION_TYPE_ENUM!
        $to: String!
        $known_as: String
      ) {
        upsertConnectionToModel(
          forward_connection_type: $forward_connection_type
          from: $from
          reverse_connection_type: $reverse_connection_type
          to: $to
          known_as: $known_as
        ) {
          type
          relation
          model
          known_as
        }
      }
    `;

    const variables: Record<string, any> = {
      forward_connection_type: forwardConnectionType, // Keep lowercase: has_many or has_one
      from: fromModel,
      reverse_connection_type: reverseConnectionType, // Keep lowercase: has_many or has_one
      to: toModel,
    };

    if (knownAs) variables.known_as = knownAs;

    const result = await this.execute<{ upsertConnectionToModel: ApitoConnection[] }>(
      mutation,
      variables
    );

    return result.upsertConnectionToModel;
  }

  async getProjectModelsInfo(modelName?: string): Promise<ApitoModel[]> {
    const query = `
      query GetProjectModelsInfo($model_name: String) {
        projectModelsInfo(model_name: $model_name) {
          name
          single_page
          is_common_model
          fields {
            identifier
            label
            field_type
            input_type
            description
            serial
            parent_field
            sub_field_info {
              identifier
              label
              field_type
              input_type
              serial
              parent_field
            }
            validation {
              required
              unique
              hide
            }
          }
          connections {
            model
            relation
            known_as
          }
        }
      }
    `;

    const result = await this.execute<{ projectModelsInfo: ApitoModel[] }>(
      query,
      modelName ? { model_name: modelName } : {}
    );

    if (!result || !result.projectModelsInfo) {
      throw new Error('Invalid response structure from GraphQL API');
    }

    return result.projectModelsInfo;
  }

  async getCurrentProject(): Promise<any> {
    const query = `
      query GetCurrentProject {
        currentProject {
          id
          name
          description
        }
      }
    `;

    const result = await this.execute<{ currentProject: any }>(query);
    return result.currentProject;
  }

  /**
   * Current project metadata for MCP / tooling. Tries Pro extended fields when available.
   */
  async getProjectContextForMCP(): Promise<Record<string, unknown>> {
    const extended = `
      query GetProjectContextMCP {
        currentProject {
          id
          name
          description
          project_type
          tenant_model_name
          per_tenant_separate_database
        }
      }
    `;
    try {
      const result = await this.execute<{ currentProject: Record<string, unknown> }>(extended);
      return result.currentProject ?? {};
    } catch {
      const basic = `
        query GetProjectContextBasic {
          currentProject {
            id
            name
            description
            project_type
          }
        }
      `;
      const result = await this.execute<{ currentProject: Record<string, unknown> }>(basic);
      return result.currentProject ?? {};
    }
  }

  /**
   * Single-call relation overview (system GraphQL). Returns JSON: project_id, models, edges, mermaid.
   */
  async getProjectSchemaRelationGraph(projectId?: string): Promise<Record<string, unknown>> {
    const query = `
      query ProjectSchemaRelationGraph($_id: String) {
        projectSchemaRelationGraph(_id: $_id)
      }
    `;
    const variables: Record<string, unknown> = {};
    if (projectId !== undefined && projectId !== '') {
      variables._id = projectId;
    }
    const result = await this.execute<{ projectSchemaRelationGraph: Record<string, unknown> }>(
      query,
      variables
    );
    return (result.projectSchemaRelationGraph ?? {}) as Record<string, unknown>;
  }

  async upsertModelData(
    modelName: string,
    payload: Record<string, any>,
    options: {
      _id?: string;
      status?: string;
      local?: string;
      connect?: Record<string, any>;
      disconnect?: Record<string, any>;
    } = {},
    reqOpts?: GraphQLRequestOptions
  ): Promise<ApitoDocument> {
    const status = options.status || 'published';
    const hasId = !!options._id;
    const hasLocal = !!options.local;
    const hasConnect = !!options.connect && Object.keys(options.connect).length > 0;
    const hasDisconnect = !!options.disconnect && Object.keys(options.disconnect).length > 0;

    const varDecls: string[] = ['$model_name: String!', '$payload: JSON', '$status: String!'];
    const argList: string[] = ['model_name: $model_name', 'payload: $payload', 'status: $status'];
    const variables: Record<string, any> = {
      model_name: modelName,
      payload,
      status,
    };

    if (hasId) {
      varDecls.push('$_id: String!');
      argList.push('_id: $_id');
      variables._id = options._id;
    }
    if (hasLocal) {
      varDecls.push('$local: String!');
      argList.push('local: $local');
      variables.local = options.local;
    }
    if (hasConnect) {
      varDecls.push('$connect: JSON!');
      argList.push('connect: $connect');
      variables.connect = options.connect;
    }
    if (hasDisconnect) {
      varDecls.push('$disconnect: JSON!');
      argList.push('disconnect: $disconnect');
      variables.disconnect = options.disconnect;
    }

    const mutation = `
      mutation UpsertModelData(${varDecls.join(', ')}) {
        upsertModelData(${argList.join(', ')}) {
          id
          _key
          type
          data
          meta {
            created_at
            updated_at
            status
          }
        }
      }
    `;

    const result = await this.execute<{ upsertModelData: ApitoDocument }>(
      mutation,
      variables,
      reqOpts
    );
    return result.upsertModelData;
  }

  async getModelData(
    modelName: string,
    options: {
      page?: number;
      limit?: number;
      where?: Record<string, any>;
      status?: string;
      search?: string;
    } = {},
    reqOpts?: GraphQLRequestOptions
  ): Promise<GetModelDataResponse> {
    const query = `
      query GetModelData(
        $model: String!
        $page: Int
        $limit: Int
        $where: JSON
        $status: FILTER_STATUS_TYPE_ENUM
        $search: String
      ) {
        getModelData(
          model: $model
          page: $page
          limit: $limit
          where: $where
          status: $status
          search: $search
        ) {
          count
          results {
            id
            _key
            type
            data
            meta {
              created_at
              updated_at
              status
            }
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      model: modelName,
    };
    if (options.page !== undefined) variables.page = options.page;
    if (options.limit !== undefined) variables.limit = options.limit;
    if (options.where) variables.where = options.where;
    const validStatus = ['all', 'draft', 'published'];
    if (options.status && validStatus.includes(options.status)) {
      variables.status = options.status;
    }
    if (options.search) variables.search = options.search;

    const result = await this.execute<{ getModelData: GetModelDataResponse }>(
      query,
      variables,
      reqOpts
    );
    return result.getModelData;
  }

  async deleteModelData(
    modelName: string,
    id: string,
    reqOpts?: GraphQLRequestOptions
  ): Promise<{ id: string }> {
    const mutation = `
      mutation DeleteModelData($_id: String, $model_name: String!) {
        deleteModelData(_id: $_id, model_name: $model_name) {
          id
        }
      }
    `;

    const result = await this.execute<{ deleteModelData: { id: string } }>(
      mutation,
      { _id: id, model_name: modelName },
      reqOpts
    );
    return result.deleteModelData;
  }

  async getSchemaVersioningStatus(): Promise<SchemaVersioningStatus> {
    const query = `
      query SchemaVersioningStatus {
        schemaVersioningStatus {
          enabled
          active_version
          has_draft
          changeset_id
          changeset_status
          pending_operations
        }
      }
    `;
    const result = await this.execute<{ schemaVersioningStatus: SchemaVersioningStatus }>(query);
    return result.schemaVersioningStatus ?? {
      enabled: false,
      active_version: 0,
      has_draft: false,
      pending_operations: 0,
    };
  }

  async getSchemaPreview(source: SchemaPreviewSource = 'live', version?: number): Promise<string> {
    const query = `
      query SchemaPreview($source: String, $version: Int) {
        schemaPreview(source: $source, version: $version)
      }
    `;
    const variables: Record<string, unknown> = { source };
    if (version !== undefined) {
      variables.version = version;
    }
    const result = await this.execute<{ schemaPreview: string }>(query, variables);
    return result.schemaPreview ?? '{}';
  }

  async getSchemaDiff(changesetId?: string): Promise<string> {
    const query = `
      query SchemaDiff($changeset_id: String) {
        schemaDiff(changeset_id: $changeset_id)
      }
    `;
    const variables: Record<string, unknown> = {};
    if (changesetId) {
      variables.changeset_id = changesetId;
    }
    const result = await this.execute<{ schemaDiff: string }>(query, variables);
    return result.schemaDiff ?? '{}';
  }

  async getSchemaChangeExecutionRecords(
    changesetId?: string,
    options: { version?: number; limit?: number; offset?: number } = {}
  ): Promise<SchemaChangeExecutionRecord[]> {
    const query = `
      query SchemaChangeExecutionRecords(
        $changeset_id: String
        $version: Int
        $limit: Int
        $offset: Int
      ) {
        schemaChangeExecutionRecords(
          changeset_id: $changeset_id
          version: $version
          limit: $limit
          offset: $offset
        ) {
          id
          operation_id
          sequence
          scope_kind
          scope_key
          target_kind
          target_name
          action_key
          impact
          requires_ddl
          retryable
          system_message
          project_message
          local_status
          remote_status
          status
          error
          attempt_count
          changeset_id
          schema_version_id
          created_at
        }
      }
    `;
    const variables: Record<string, unknown> = {};
    if (changesetId) {
      variables.changeset_id = changesetId;
    }
    if (options.version !== undefined) {
      variables.version = options.version;
    }
    if (options.limit !== undefined) {
      variables.limit = options.limit;
    }
    if (options.offset !== undefined) {
      variables.offset = options.offset;
    }
    const result = await this.execute<{ schemaChangeExecutionRecords: SchemaChangeExecutionRecord[] }>(
      query,
      variables
    );
    return result.schemaChangeExecutionRecords ?? [];
  }

  async duplicateModelData(
    modelName: string,
    id: string,
    reqOpts?: GraphQLRequestOptions
  ): Promise<{ id: string }> {
    const mutation = `
      mutation DuplicateModelData($_id: String, $model_name: String!) {
        duplicateModelData(_id: $_id, model_name: $model_name) {
          id
        }
      }
    `;

    const result = await this.execute<{ duplicateModelData: { id: string } }>(
      mutation,
      { _id: id, model_name: modelName },
      reqOpts
    );
    return result.duplicateModelData;
  }
}

