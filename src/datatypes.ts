export class DataType<T extends string = string> {
    constructor(public type: T, public isAutoIncrement: boolean = false) { }

    toString() {
        return this.type;
    }
}

export class NumberDataType extends DataType<'number'> {
    constructor(isAutoIncrement: boolean = false) {
        super('number', isAutoIncrement);
    }

    autoIncrement() {
        return new NumberDataType(true);
    }
}

export class DateDataType extends DataType<'date'> {
    constructor(
        public isCreatedAt: boolean = false,
        public isUpdatedAt: boolean = false,
        public isDeletedAt: boolean = false
    ) {
        super('date');
    }

    createdAt() {
        return new DateDataType(true, this.isUpdatedAt, this.isDeletedAt);
    }

    updatedAt() {
        return new DateDataType(this.isCreatedAt, true, this.isDeletedAt);
    }

    deletedAt() {
        return new DateDataType(this.isCreatedAt, this.isUpdatedAt, true);
    }
}

export const DataTypes = {
    String: new DataType<'string'>('string'),
    Number: new NumberDataType(),
    Boolean: new DataType<'boolean'>('boolean'),
    JSON: new DataType<'json'>('json'),
    UUID: new DataType<'uuid'>('uuid'),
    CUID: new DataType<'cuid'>('cuid'),
    Date: new DateDataType()
};

export interface BaseColumnDefinition {
    unique?: boolean;
    default?: any;
}

export interface NumberColumnDefinition extends BaseColumnDefinition {
    type: NumberDataType;
    autoIncrement?: boolean;
}

export interface DateColumnDefinition extends BaseColumnDefinition {
    type: DateDataType;
    autoIncrement?: never;
}

export interface OtherColumnDefinition extends BaseColumnDefinition {
    type: DataType;
    autoIncrement?: never;
}

export type ColumnDefinition = NumberColumnDefinition | DateColumnDefinition | OtherColumnDefinition;

export type SchemaType = ColumnDefinition | DataType | NumberDataType | DateDataType;

export interface SchemaDefinition {
    [key: string]: SchemaType;
}
