export type GoogleSheetsAuth = {
    clientEmail: string;
    privateKey: string;
};

export type SheetConfig = {
    spreadsheetId: string;
    auth: GoogleSheetsAuth;
};

import { DataType, NumberDataType } from './datatypes';

export interface BaseColumnDefinition {
    unique?: boolean;
    default?: any;
}

export interface NumberColumnDefinition extends BaseColumnDefinition {
    type: NumberDataType;
    autoIncrement?: boolean;
}

export interface OtherColumnDefinition extends BaseColumnDefinition {
    type: DataType;
    autoIncrement?: never;
}

export type ColumnDefinition = NumberColumnDefinition | OtherColumnDefinition;

export type SchemaType = ColumnDefinition | DataType | NumberDataType;

export interface SchemaDefinition {
    [key: string]: SchemaType;
}

export interface RelationConfig {
    type: 'hasOne' | 'hasMany' | 'belongsTo';
    targetModel: any;
    foreignKey: string;
    localKey: string;
}

import { Schema } from './schema';

export interface ModelConfig {
    sheetName: string;
    schema: Schema;
    relations?: Record<string, RelationConfig>;
}

export type RowData = Record<string, any>;
