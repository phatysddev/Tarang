import { SchemaDefinition, ColumnDefinition , DataType, NumberDataType, DateDataType } from './datatypes';

export class Schema<T extends SchemaDefinition = SchemaDefinition> {
    public definition: Record<string, ColumnDefinition>;

    constructor(definition: T) {
        this.definition = {};
        for (const key in definition) {
            const value = definition[key];
            if (value instanceof DataType || value instanceof NumberDataType || value instanceof DateDataType) {
                this.definition[key] = { type: value };
            } else {
                // Runtime check for autoIncrement on non-number types
                if (value.autoIncrement && value.type.type !== 'number') {
                    throw new Error(`Field '${key}' cannot have autoIncrement enabled because it is of type '${value.type.type}'. autoIncrement is only allowed for Number types.`);
                }
                this.definition[key] = value;
            }
        }
    }
}
