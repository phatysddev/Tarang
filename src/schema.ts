import { SchemaDefinition, ColumnDefinition } from './types';
import { DataType, NumberDataType } from './datatypes';

export class Schema {
    public definition: Record<string, ColumnDefinition>;

    constructor(definition: SchemaDefinition) {
        this.definition = {};
        for (const key in definition) {
            const value = definition[key];
            if (value instanceof DataType || value instanceof NumberDataType) {
                this.definition[key] = { type: value };
            } else {
                this.definition[key] = value;
            }
        }
    }
}
