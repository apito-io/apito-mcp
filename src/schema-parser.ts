import type { ParsedField } from './types.js';

export class SchemaParser {
    /**
     * Parse a field definition string into a ParsedField
     * Examples:
     * - "date" -> simple text field
     * - "chief_complaint [ complaint duration unit location ]" -> array/repeated field with nested fields
     * - "chief_complaint { complaint duration unit location }" -> object field with nested fields
     * - "medicine { unit name instruction }" -> object field
     */
    static parseField(fieldDef: string, parentField?: string): ParsedField {
        const trimmed = fieldDef.trim();

        // Check if it's an array field with nested fields: field_name [ nested fields ]
        if (trimmed.includes('[') && trimmed.includes(']')) {
            return this.parseArrayField(trimmed, parentField);
        }

        // Check if it's an object field with nested fields: field_name { nested fields }
        if (trimmed.includes('{') && trimmed.includes('}')) {
            return this.parseObjectField(trimmed, parentField);
        }

        // Simple field
        return {
            name: trimmed,
            field_type: 'text', // Will be resolved by field-resolver
            input_type: 'string',
            parent_field: parentField,
        };
    }

    /**
     * Parse an array field definition
     * Example: "chief_complaint [ complaint duration unit location ]"
     */
    private static parseArrayField(fieldDef: string, parentField?: string): ParsedField {
        const match = fieldDef.match(/^(\w+)\s*\[([^\]]+)\]$/);
        if (!match) {
            throw new Error(`Invalid array field format: ${fieldDef}`);
        }

        const fieldName = match[1].trim();
        const nestedFieldsStr = match[2].trim();

        // Parse nested fields (space-separated)
        const nestedFieldNames = nestedFieldsStr
            .split(/\s+/)
            .map(name => name.trim())
            .filter(name => name.length > 0);

        const nestedFields: ParsedField[] = nestedFieldNames.map((name, index) => ({
            name,
            field_type: 'text', // Will be resolved by field-resolver
            input_type: 'string',
            parent_field: fieldName,
            serial: index + 1,
        }));

        return {
            name: fieldName,
            field_type: 'repeated',
            input_type: 'repeated',
            nested_fields: nestedFields,
            parent_field: parentField,
            is_array: true,
        };
    }

    /**
     * Parse an object field definition
     * Example: "chief_complaint { complaint duration unit location }"
     */
    private static parseObjectField(fieldDef: string, parentField?: string): ParsedField {
        const match = fieldDef.match(/^(\w+)\s*\{([^}]+)\}$/);
        if (!match) {
            throw new Error(`Invalid object field format: ${fieldDef}`);
        }

        const fieldName = match[1].trim();
        const nestedFieldsStr = match[2].trim();

        // Parse nested fields (space-separated)
        const nestedFieldNames = nestedFieldsStr
            .split(/\s+/)
            .map(name => name.trim())
            .filter(name => name.length > 0);

        const nestedFields: ParsedField[] = nestedFieldNames.map((name, index) => ({
            name,
            field_type: 'text', // Will be resolved by field-resolver
            input_type: 'string',
            parent_field: fieldName,
            serial: index + 1,
        }));

        return {
            name: fieldName,
            field_type: 'object',
            input_type: 'object',
            nested_fields: nestedFields,
            parent_field: parentField,
            is_object: true,
        };
    }

    /**
     * Parse an array of field definitions
     * Example: ["date", "chief_complaint { complaint duration }", "medicine { unit name }"]
     */
    static parseFields(fieldDefinitions: string[]): ParsedField[] {
        return fieldDefinitions.map((def, index) => {
            const parsed = this.parseField(def);
            parsed.serial = index + 1;
            return parsed;
        });
    }

    /**
     * Extract model name from schema definition
     * Example: "dentalAssessmentFields" -> "dentalAssessment"
     */
    static extractModelName(schemaName: string): string {
        // Remove common suffixes
        let name = schemaName
            .replace(/Fields?$/, '')
            .replace(/Schema$/, '')
            .replace(/Model$/, '');

        // Convert to camelCase if needed
        name = name.charAt(0).toLowerCase() + name.slice(1);

        return name;
    }

    /**
     * Check if a field definition represents an array
     * Array fields use [ ] syntax
     */
    static isArray(fieldDef: string): boolean {
        return fieldDef.includes('[') && fieldDef.includes(']');
    }

    /**
     * Check if a field definition represents an array
     * This is a heuristic - we'll ask the user if uncertain
     */
    static mightBeArray(fieldDef: string): boolean {
        const trimmed = fieldDef.trim().toLowerCase();

        // Common array indicators
        const arrayIndicators = [
            'list',
            'array',
            'items',
            'collection',
            'multiple',
        ];

        return arrayIndicators.some(indicator => trimmed.includes(indicator));
    }

    /**
     * Check if a field definition represents an object
     * Object fields use { } syntax
     */
    static isObject(fieldDef: string): boolean {
        return fieldDef.includes('{') && fieldDef.includes('}');
    }

    /**
     * Extract nested field names from an object field definition
     */
    static extractNestedFieldNames(fieldDef: string): string[] {
        if (!this.isObject(fieldDef)) {
            return [];
        }

        const match = fieldDef.match(/\{([^}]+)\}/);
        if (!match) {
            return [];
        }

        return match[1]
            .trim()
            .split(/\s+/)
            .map(name => name.trim())
            .filter(name => name.length > 0);
    }
}

