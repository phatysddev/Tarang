import type { JsonValue } from './types';

export function formatPrivateKey(key: string): string {
    return key.replaceAll(String.raw`\n`, '\n');
}

export type ParsedValue = Date | JsonValue;

export function parseValue(value: string | null | undefined, type: string): ParsedValue {
    if (value === undefined || value === null || value === '') return null;
    switch (type) {
        case 'number':
            return Number(value);
        case 'boolean':
            return value.toLowerCase() === 'true';
        case 'json':
            try {
                return JSON.parse(value) as JsonValue;
            } catch {
                return null;
            }
        case 'date':
            return new Date(value);
        default:
            return value;
    }
}

export function stringifyValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    // Primitives: string, number, boolean, bigint, symbol
    return String(value as string | number | boolean | bigint | symbol);
}
