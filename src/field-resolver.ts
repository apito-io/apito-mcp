import type { FieldTypeInfo, ParsedField } from './types.js';
import { SchemaParser } from './schema-parser.js';

export class FieldResolver {
    /**
     * Resolve field type from field definition
     * Returns field_type and input_type based on heuristics
     */
    static resolveFieldType(fieldDef: string, fieldName?: string): FieldTypeInfo {
        const name = fieldName || fieldDef.trim().toLowerCase();
        const def = fieldDef.trim();

        // Array fields (already parsed by schema parser) - use [ ] syntax
        if (SchemaParser.isArray(def)) {
            return {
                field_type: 'repeated',
                input_type: 'repeated',
                is_array: true,
            };
        }

        // Object fields (already parsed by schema parser) - use { } syntax
        if (SchemaParser.isObject(def)) {
            return {
                field_type: 'object',
                input_type: 'object',
                is_object: true,
            };
        }

        // Check for explicit array indicators (legacy support)
        if (def.endsWith('[]') || SchemaParser.mightBeArray(def)) {
            return {
                field_type: 'repeated',
                input_type: 'repeated',
                is_array: true,
            };
        }

        // Infer from field name patterns
        if (this.isDateField(name)) {
            return {
                field_type: 'date',
                input_type: 'string',
            };
        }

        if (this.isNumberField(name)) {
            return {
                field_type: 'number',
                input_type: 'int',
            };
        }

        if (this.isBooleanField(name)) {
            return {
                field_type: 'boolean',
                input_type: 'bool',
            };
        }

        if (this.isMultilineField(name)) {
            return {
                field_type: 'multiline',
                input_type: 'string',
            };
        }

        if (this.isMediaField(name)) {
            return {
                field_type: 'media',
                input_type: 'string',
            };
        }

        if (this.isUrlField(name)) {
            return {
                field_type: 'text',
                input_type: 'string',
            };
        }

        // Default to text
        return {
            field_type: 'text',
            input_type: 'string',
        };
    }

    /**
     * Check if field name suggests a date field
     */
    private static isDateField(name: string): boolean {
        const dateKeywords = ['date', 'time', 'created_at', 'updated_at', 'timestamp', 'when'];
        return dateKeywords.some(keyword => name.includes(keyword));
    }

    /**
     * Check if field name suggests a number field
     */
    private static isNumberField(name: string): boolean {
        const numberKeywords = [
            'count', 'number', 'num', 'quantity', 'qty', 'amount', 'price',
            'cost', 'total', 'sum', 'age', 'score', 'rating', 'rank',
            'index', 'order', 'serial', 'id', 'duration', 'frequency',
            'strength', 'unit'
        ];
        return numberKeywords.some(keyword => name.includes(keyword));
    }

    /**
     * Check if field name suggests a boolean field
     */
    private static isBooleanField(name: string): boolean {
        const booleanKeywords = [
            'is_', 'has_', 'can_', 'should_', 'must_', 'enable', 'disable',
            'active', 'inactive', 'enabled', 'disabled', 'visible', 'hidden',
            'required', 'optional', 'verified', 'confirmed'
        ];
        return booleanKeywords.some(keyword => name.startsWith(keyword) || name.includes(keyword));
    }

    /**
     * Check if field name suggests a multiline field
     */
    private static isMultilineField(name: string): boolean {
        const multilineKeywords = [
            'description', 'content', 'body', 'text', 'message', 'note',
            'comment', 'details', 'summary', 'abstract', 'instructions',
            'advice', 'findings', 'recommendations', 'notes'
        ];
        return multilineKeywords.some(keyword => name.includes(keyword));
    }

    /**
     * Check if field name suggests a media field
     */
    private static isMediaField(name: string): boolean {
        const mediaKeywords = [
            'image', 'photo', 'picture', 'logo', 'avatar', 'icon',
            'file', 'document', 'attachment', 'media', 'video', 'audio'
        ];
        return mediaKeywords.some(keyword => name.includes(keyword));
    }

    /**
     * Check if field name suggests a URL field
     */
    private static isUrlField(name: string): boolean {
        const urlKeywords = ['url', 'link', 'href', 'website', 'web', 'uri'];
        return urlKeywords.some(keyword => name.includes(keyword));
    }

    /**
     * Resolve field type for a parsed field, updating it in place
     */
    static resolveParsedField(field: ParsedField): ParsedField {
        const resolved = this.resolveFieldType(field.name, field.name);

        field.field_type = resolved.field_type;
        field.input_type = resolved.input_type;

        // Resolve nested fields if present
        if (field.nested_fields) {
            field.nested_fields = field.nested_fields.map(nested => {
                const nestedResolved = this.resolveFieldType(nested.name, nested.name);
                return {
                    ...nested,
                    field_type: nestedResolved.field_type,
                    input_type: nestedResolved.input_type,
                };
            });
        }

        return field;
    }

    /**
     * Check if field type is ambiguous and might need user input
     */
    static isAmbiguous(fieldDef: string): boolean {
        const def = fieldDef.trim().toLowerCase();

        // If it's clearly an object or array, not ambiguous
        if (SchemaParser.isObject(fieldDef) || def.endsWith('[]')) {
            return false;
        }

        // Check if it could be multiple types
        const resolved = this.resolveFieldType(fieldDef);

        // If it resolved to text but has characteristics of other types, it's ambiguous
        if (resolved.field_type === 'text') {
            const hasNumberKeywords = this.isNumberField(def);
            const hasDateKeywords = this.isDateField(def);
            const hasBooleanKeywords = this.isBooleanField(def);

            // If it matches multiple patterns, it's ambiguous
            const matchCount = [hasNumberKeywords, hasDateKeywords, hasBooleanKeywords].filter(Boolean).length;
            return matchCount > 1;
        }

        return false;
    }

    /**
     * Get suggested field types for ambiguous fields
     */
    static getSuggestedTypes(fieldDef: string): string[] {
        const def = fieldDef.trim().toLowerCase();
        const suggestions: string[] = [];

        if (this.isDateField(def)) suggestions.push('date');
        if (this.isNumberField(def)) suggestions.push('number');
        if (this.isBooleanField(def)) suggestions.push('boolean');
        if (this.isMultilineField(def)) suggestions.push('multiline');
        if (this.isMediaField(def)) suggestions.push('media');

        // Always include text as fallback
        if (suggestions.length === 0) {
            suggestions.push('text');
        }

        return suggestions;
    }
}

