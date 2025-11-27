import { DataType, NumberDataType, DateDataType } from './datatypes';
import { Schema } from './schema';

export type GoogleSheetsAuth = {
    clientEmail: string;
    privateKey: string;
};

export type SheetConfig = {
    spreadsheetId: string;
    auth: GoogleSheetsAuth;
    cacheTTL?: number; // Cache TTL in milliseconds, default 60000
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

export type GetTypeFromDataType<T> =
    T extends DataType<'string'> | DataType<'uuid'> | DataType<'cuid'> ? string :
    T extends DataType<'number'> ? number :
    T extends DataType<'boolean'> ? boolean :
    T extends DataType<'date'> ? Date :
    T extends DataType<'json'> ? any :
    never;

export type GetTypeFromDefinition<T> =
    T extends DataType<any> ? GetTypeFromDataType<T> :
    T extends { type: infer DT } ? (DT extends DataType<any> ? GetTypeFromDataType<DT> : never) :
    never;

export type Infer<T> = T extends Schema<infer D> ? {
    [K in keyof D]: GetTypeFromDefinition<D[K]>
} : never;

export interface RelationConfig {
    type: 'hasOne' | 'hasMany' | 'belongsTo';
    targetModel: any;
    foreignKey: string;
    localKey: string;
}

export interface ModelConfig {
    sheetName: string;
    schema: Schema;
    relations?: Record<string, RelationConfig>;
}

export type FilterOperator<T> = {
    gt?: T;
    lt?: T;
    gte?: T;
    lte?: T;
    ne?: T;
    like?: string;
    ilike?: string;
};

export type Filter<T> = {
    [P in keyof T]?: T[P] | FilterOperator<T[P]>;
};

export type AllowFormulas<T> = {
    [K in keyof T]: T[K] | string;
};
