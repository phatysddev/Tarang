import { DataType } from './datatypes';
import { Schema } from './schema';

export type CellValue = string | number | boolean | null;

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export type RowData = Record<string, CellValue | JsonValue | Date>;

export type GoogleSheetsAuth = {
    clientEmail: string;
    privateKey: string;
};

export type SheetConfig = {
    spreadsheetId: string;
    auth: GoogleSheetsAuth;
    cacheTTL?: number; // Cache TTL in milliseconds, default 60000
    maxCacheSize?: number; // Max number of entries in cache, default 100
};


export type GetTypeFromDataType<T> =
    T extends DataType<'string'> | DataType<'uuid'> | DataType<'cuid'> ? string :
    T extends DataType<'number'> ? number :
    T extends DataType<'boolean'> ? boolean :
    T extends DataType<'date'> ? Date :
    T extends DataType<'json'> ? JsonValue :
    never;

export type GetTypeFromDefinition<T> =
    T extends DataType<any> ? GetTypeFromDataType<T> :
    T extends { type: infer DT } ? (DT extends DataType<any> ? GetTypeFromDataType<DT> : never) :
    never;

export type Infer<T> = T extends Schema<infer D> ? {
    [K in keyof D]: GetTypeFromDefinition<D[K]>
} : never;

/** Interface for Model-like objects to avoid circular dependencies */
export interface ModelLike<T = unknown> {
    findMany(filter?: Filter<T>, options?: FindOptions<T>): Promise<Partial<T>[]>;
}

export interface RelationConfig {
    type: 'hasOne' | 'hasMany' | 'belongsTo';
    targetModel: ModelLike;
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

export interface FindOptions<T> {
    select?: Record<string, boolean>;
    include?: Record<string, boolean | FindOptions<unknown>>;
    limit?: number;
    skip?: number;
    includeDeleted?: boolean;
    sortBy?: keyof T;
    sortOrder?: 'asc' | 'desc';
}
