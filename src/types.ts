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

