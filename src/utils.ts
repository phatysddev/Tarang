export function formatPrivateKey(key: string): string {
    return key.replace(/\\n/g, '\n');
}

export function parseValue(value: string, type: string): any {
    if (value === undefined || value === null || value === '') return null;
    switch (type) {
        case 'number':
            return Number(value);
        case 'boolean':
            return value.toLowerCase() === 'true';
        case 'json':
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        default:
            return value;
    }
}

export function stringifyValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}
