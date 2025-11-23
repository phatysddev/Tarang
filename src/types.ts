export type GoogleSheetsAuth = {
    clientEmail: string;
    privateKey: string;
};

export type SheetConfig = {
    spreadsheetId: string;
    auth: GoogleSheetsAuth;
};

export type ColumnType = 'string' | 'number' | 'boolean' | 'json' | 'uuid' | 'cuid';

export interface ColumnDefinition {
    type: ColumnType;
    unique?: boolean;
    default?: any;
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
