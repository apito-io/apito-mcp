export interface FieldTypeInfo {
    field_type: string;
    input_type: string;
    is_array?: boolean;
    is_object?: boolean;
}

export interface ParsedField {
    name: string;
    field_type: string;
    input_type: string;
    nested_fields?: ParsedField[];
    parent_field?: string;
    serial?: number;
    is_object?: boolean;
    is_array?: boolean;
    description?: string;
}

export interface ModelDefinition {
    name: string;
    fields: ParsedField[];
    single_record?: boolean;
}

export interface GraphQLResponse<T = any> {
    data?: T;
    errors?: Array<{
        message: string;
        extensions?: Record<string, any>;
        path?: (string | number)[];
    }>;
}

export interface ApitoModel {
    name: string;
    fields: ApitoField[];
    connections?: any[];
    single_page?: boolean;
}

export interface ApitoField {
    identifier: string;
    label: string;
    field_type: string;
    field_sub_type?: string;
    input_type: string;
    description?: string;
    serial: number;
    parent_field?: string;
    sub_field_info?: ApitoField[];
    validation?: {
        required?: boolean;
        unique?: boolean;
        hide?: boolean;
        is_email?: boolean;
        is_url?: boolean;
        is_gallery?: boolean;
        is_multi_choice?: boolean;
        placeholder?: string;
        locals?: string[];
        fixed_list_elements?: any[];
        fixed_list_element_type?: string;
    };
}

export interface ValidationInput {
    required?: boolean;
    unique?: boolean;
    hide?: boolean;
    is_email?: boolean;
    is_url?: boolean;
    is_gallery?: boolean;
    is_multi_choice?: boolean;
    placeholder?: string;
    locals?: string[];
    fixed_list_elements?: string[]; // Array of option strings (REQUIRED for dropdown and multiSelect)
    fixed_list_element_type?: string; // Typically "string" (REQUIRED for dropdown and multiSelect)
}

export interface ApitoConnection {
    type?: string;
    relation?: string;
    model?: string;
    known_as?: string;
}

export interface ApitoDocument {
    id: string;
    _key?: string;
    type?: string;
    data: Record<string, any>;
    meta?: {
        created_at?: string;
        updated_at?: string;
        status?: string;
    };
}

export interface GetModelDataResponse {
    count: number;
    results: ApitoDocument[];
}

export interface SchemaVersioningStatus {
    enabled: boolean;
    active_version: number;
    has_draft: boolean;
    changeset_id?: string;
    changeset_status?: string;
    pending_operations: number;
}

export type SchemaPreviewSource = 'live' | 'draft' | 'version';

export interface SchemaChangeExecutionRecord {
    id: string;
    operation_id?: string;
    sequence?: number;
    scope_kind?: string;
    scope_key?: string;
    target_kind?: string;
    target_name?: string;
    action_key?: string;
    impact?: string;
    requires_ddl?: boolean;
    retryable?: boolean;
    system_message?: string;
    project_message?: string;
    local_status?: string;
    remote_status?: string;
    status?: string;
    error?: string;
    attempt_count?: number;
    changeset_id?: string;
    schema_version_id?: string;
    created_at?: string;
}

export interface StagingMutationMeta {
    staged: boolean;
    message?: string;
    modelName?: string;
}

