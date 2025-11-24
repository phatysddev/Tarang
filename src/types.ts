export type GoogleSheetsAuth = {
    clientEmail: string;
    privateKey: string;
};

export type SheetConfig = {
    spreadsheetId: string;
    auth: GoogleSheetsAuth;
};

import { DataType } from './datatypes';

export type ColumnType = 'string' | 'number' | 'boolean' | 'json' | 'uuid' | 'cuid';

export interface ColumnDefinition {
    type: ColumnType | DataType;
    unique?: boolean;
    default?: any;
    autoIncrement?: boolean;
}

export interface Schema {
    [key: string]: ColumnDefinition;
}

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

export type RowData = Record<string, any>;
