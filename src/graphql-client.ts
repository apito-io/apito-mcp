import { GraphQLClient } from 'graphql-request';
import type { GraphQLResponse, ValidationInput, ApitoModel, ApitoField } from './types.js';

export class ApitoGraphQLClient {
  private client: GraphQLClient;
  private endpoint: string;

  constructor(endpoint: string, token: string) {
    this.endpoint = endpoint;
    this.client = new GraphQLClient(endpoint, {
      headers: {
        'X-Apito-Key': token,
        'Content-Type': 'application/json',
      },
    });
  }

  private async execute<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    try {
      const response = await this.client.request<any>(query, variables);

      // Check for GraphQL errors in response
      if (response.errors && response.errors.length > 0) {
        const errorMessages = response.errors.map((e: any) => {
          const path = e.path ? ` (path: ${e.path.join('.')})` : '';
          const code = e.extensions?.code ? ` [${e.extensions.code}]` : '';
          return `${e.message}${code}${path}`;
        }).join('; ');

        throw new Error(`GraphQL errors: ${errorMessages}`);
      }

      // graphql-request returns data directly, not wrapped in { data: ... }
      // So response IS the data
      return response as T;
    } catch (error: any) {
      // Enhanced error handling
      if (error.response) {
        const errors = error.response.errors || [];
        const errorMessages = errors.map((e: any) => {
          const path = e.path ? ` (path: ${e.path.join('.')})` : '';
          const code = e.extensions?.code ? ` [${e.extensions.code}]` : '';
          return `${e.message}${code}${path}`;
        }).join('; ');

        throw new Error(`GraphQL request failed: ${errorMessages || JSON.stringify(error.response)}`);
      }

      // Network or other errors
      if (error.message) {
        throw new Error(`Request failed: ${error.message}`);
      }

      // Log full error for debugging
      console.error('Full error object:', JSON.stringify(error, null, 2));
      throw new Error(`Request failed: ${JSON.stringify(error)}`);
    }
  }

  async addModelToProject(name: string, singleRecord?: boolean): Promise<ApitoModel[]> {
    const mutation = `
      mutation AddModelToProject($name: String!, $single_record: Boolean) {
        addModelToProject(name: $name, single_record: $single_record) {
          name
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

    const result = await this.execute<{ addModelToProject: ApitoModel[] }>(
      mutation,
      { name, single_record: singleRecord }
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
      isRelation?: boolean;
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
        $is_relation: Boolean
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
          is_relation: $is_relation
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
    if (options.isRelation !== undefined) variables.is_relation = options.isRelation;
    if (options.knownAs) variables.known_as = options.knownAs;
    if (options.movedTo) variables.moved_to = options.movedTo;
    if (options.changedType) variables.changed_type = options.changedType;

    const result = await this.execute<{ modelFieldOperation: ApitoField }>(
      mutation,
      variables
    );

    return result.modelFieldOperation;
  }

  async getProjectModelsInfo(modelName?: string): Promise<ApitoModel[]> {
    const query = `
      query GetProjectModelsInfo($model_name: String) {
        projectModelsInfo(model_name: $model_name) {
          name
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
}

