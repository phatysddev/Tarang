import { TarangClient } from './client';
import { ModelConfig, RelationConfig, Filter, FilterOperator } from './types';
import { DataType, DateDataType } from './datatypes';
import { parseValue, stringifyValue } from './utils';
import { v4 as uuidv4 } from 'uuid';
import { createId } from '@paralleldrive/cuid2';
import { Schema } from './schema';

export class Model<T = any> {
    private client: TarangClient;
    private sheetName: string;
    private schema: Schema;
    private relations: Record<string, RelationConfig> = {};
    private headers: string[] = [];

    constructor(client: TarangClient, config: ModelConfig) {
        this.client = client;
        this.sheetName = config.sheetName;
        this.schema = config.schema;
        if (config.relations) {
            this.relations = config.relations;
        }
    }

    private async ensureHeaders() {
        if (this.headers.length > 0) return;

        const values = await this.client.getSheetValues(`${this.sheetName}!A1:Z1`);
        if (values && values.length > 0) {
            this.headers = values[0];
        } else {
            // Create headers if they don't exist based on schema
            this.headers = Object.keys(this.schema.definition);
            await this.client.updateValues(`${this.sheetName}!A1`, [this.headers]);
        }
    }

    private mapRowToObject(row: any[]): T {
        const obj: any = {};
        this.headers.forEach((header, index) => {
            const value = row[index];
            const columnDef = this.schema.definition[header];
            if (columnDef) {
                const type = columnDef.type instanceof DataType ? columnDef.type.type : 'string';
                obj[header] = parseValue(value, type as any);
            } else {
                obj[header] = value;
            }
        });
        return obj as T;
    }

    private mapObjectToRow(obj: any): any[] {
        return this.headers.map(header => {
            const value = obj[header];
            return stringifyValue(value);
        });
    }

    async findMany(filter?: Filter<T>, options?: { include?: Record<string, boolean>, select?: Record<string, boolean>, limit?: number, skip?: number, includeDeleted?: boolean, sortBy?: keyof T, sortOrder?: 'asc' | 'desc' }): Promise<Partial<T>[]> {
        await this.ensureHeaders();
        const rows = await this.client.getSheetValues(`${this.sheetName}!A2:Z`);
        if (!rows) return [];

        let results = rows.map((row: any[]) => this.mapRowToObject(row));

        // Filter out soft-deleted items unless explicitly requested
        if (!options?.includeDeleted) {
            const deletedAtField = this.getDeletedAtField();
            if (deletedAtField) {
                results = results.filter((item: any) => !item[deletedAtField]);
            }
        }

        if (filter) {
            results = this.applyFilter(results, filter);
        }

        // Apply sorting
        if (options?.sortBy) {
            results = this.applySort(results, options.sortBy, options.sortOrder || 'asc');
        }

        // Apply skip and limit
        if (options?.skip !== undefined || options?.limit !== undefined) {
            results = this.applyPagination(results, options.skip, options.limit);
        }

        if (options?.include) {
            await this.loadRelations(results, options.include);
        }

        if (options?.select) {
            results = this.applySelect(results, options.select);
        }

        return results;
    }

    private applyFilter(results: T[], filter: Filter<T>): T[] {
        return results.filter((item: T) => this.matchesFilter(item, filter));
    }

    private applyPagination(results: T[], skip?: number, limit?: number): T[] {
        if (skip !== undefined) {
            results = results.slice(skip);
        }
        if (limit !== undefined) {
            results = results.slice(0, limit);
        }
        return results;
    }

    private applySort(results: T[], sortBy: keyof T, sortOrder: 'asc' | 'desc'): T[] {
        return results.sort((a, b) => {
            const valA = a[sortBy];
            const valB = b[sortBy];

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    private async loadRelations(results: any[], include: Record<string, boolean>) {
        const relationsToFetch = Object.keys(include).filter(
            key => include[key] && this.relations[key]
        );

        await Promise.all(relationsToFetch.map(async (relationName) => {
            const relation = this.relations[relationName];
            const targetModel = relation.targetModel as Model<any>;

            // Fetch all related records once to avoid N+1 problem
            const allRelatedRecords = await targetModel.findMany();

            results.forEach((item: any) => {
                const localValue = item[relation.localKey];
                if (!localValue) return;

                if (relation.type === 'hasOne' || relation.type === 'belongsTo') {
                    item[relationName] = allRelatedRecords.find(
                        (r: any) => r[relation.foreignKey] === localValue
                    ) || null;
                } else if (relation.type === 'hasMany') {
                    item[relationName] = allRelatedRecords.filter(
                        (r: any) => r[relation.foreignKey] === localValue
                    );
                }
            });
        }));
    }

    private applySelect(results: any[], select: Record<string, boolean>): any[] {
        return results.map((item: any) => {
            const selectedItem: any = {};
            for (const key in select) {
                if (select[key]) {
                    selectedItem[key] = item[key];
                }
            }
            return selectedItem;
        });
    }

    async findFirst(filter: Filter<T>, options?: { include?: Record<string, boolean>, select?: Record<string, boolean>, skip?: number, includeDeleted?: boolean }): Promise<Partial<T> | null> {
        const results = await this.findMany(filter, { ...options, limit: 1 });
        return results.length > 0 ? results[0] : null;
    }

    async create(data: Partial<T>): Promise<T> {
        await this.ensureHeaders();
        const dataWithDefaults = await this.prepareDataForCreate(data);
        const row = this.mapObjectToRow(dataWithDefaults);
        await this.client.appendValues(`${this.sheetName}!A:A`, [row]);
        return dataWithDefaults as T;
    }

    async createMany(data: Partial<T>[]): Promise<T[]> {
        await this.ensureHeaders();
        const createdItems: T[] = [];
        const rows: any[][] = [];

        for (const item of data) {
            const dataWithDefaults = await this.prepareDataForCreate(item);
            createdItems.push(dataWithDefaults as T);
            rows.push(this.mapObjectToRow(dataWithDefaults));
        }

        if (rows.length > 0) {
            await this.client.appendValues(`${this.sheetName}!A:A`, rows);
        }

        return createdItems;
    }

    async upsert(args: { where: Filter<T>, update: Partial<T>, create: Partial<T> }): Promise<T> {
        const existingItem = await this.findFirst(args.where);
        if (existingItem) {
            const updatedItems = await this.update(args.where, args.update);
            return updatedItems[0];
        } else {
            return this.create(args.create);
        }
    }

    async update(filter: Filter<T>, data: Partial<T>): Promise<T[]> {
        await this.ensureHeaders();
        const rows = await this.client.getSheetValues(`${this.sheetName}!A2:Z`);
        if (!rows) return [];

        const updatedItems: T[] = [];
        const updatedAtField = this.getUpdatedAtField();
        const updateData: any = { ...data };

        if (updatedAtField) {
            updateData[updatedAtField] = new Date().toISOString();
        }

        let hasChanges = false;
        const newRows = rows.map((row: any[]) => {
            const item = this.mapRowToObject(row);
            const deletedAtField = this.getDeletedAtField();

            // Skip soft-deleted items from update
            if (deletedAtField && (item as any)[deletedAtField]) {
                return row;
            }

            if (this.matchesFilter(item, filter)) {
                const updatedItem = { ...item, ...updateData };
                updatedItems.push(updatedItem);
                hasChanges = true;
                return this.mapObjectToRow(updatedItem);
            }

            return row;
        });

        if (hasChanges) {
            await this.client.updateValues(`${this.sheetName}!A2`, newRows);
        }

        return updatedItems;
    }

    async delete(filter: Filter<T>, options?: { force?: boolean }): Promise<number> {
        await this.ensureHeaders();
        const rows = await this.client.getSheetValues(`${this.sheetName}!A2:Z`);
        if (!rows) return 0;

        const deletedAtField = this.getDeletedAtField();

        // If soft delete is enabled and not forced, perform soft delete
        if (deletedAtField && !options?.force) {
            let deletedCount = 0;
            let hasChanges = false;
            const newRows = rows.map((row: any[]) => {
                const item = this.mapRowToObject(row);

                if (this.matchesFilter(item, filter)) {
                    // Skip if already deleted
                    if ((item as any)[deletedAtField]) return row;

                    const updatedItem: any = { ...item };
                    updatedItem[deletedAtField] = new Date().toISOString();
                    deletedCount++;
                    hasChanges = true;
                    return this.mapObjectToRow(updatedItem);
                }
                return row;
            });

            if (hasChanges) {
                await this.client.updateValues(`${this.sheetName}!A2`, newRows);
            }
            return deletedCount;
        }

        // Hard delete implementation
        const keptRows: any[][] = [];
        let deletedCount = 0;

        rows.forEach((row: any[]) => {
            const item = this.mapRowToObject(row);
            if (!this.matchesFilter(item, filter)) {
                keptRows.push(row);
            } else {
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            await this.client.clearValues(`${this.sheetName}!A2:Z`);
            if (keptRows.length > 0) {
                await this.client.updateValues(`${this.sheetName}!A2`, keptRows);
            }
        }

        return deletedCount;
    }

    private async prepareDataForCreate(data: Partial<T>): Promise<any> {
        const dataWithDefaults: any = { ...data };

        for (const key in this.schema.definition) {
            const columnDef = this.schema.definition[key];
            let type: string;
            let isAutoIncrement = false;
            let isCreatedAt = false;
            let isUpdatedAt = false;

            if (columnDef.type instanceof DataType) {
                type = columnDef.type.type;
                isAutoIncrement = columnDef.type.isAutoIncrement || !!columnDef.autoIncrement;
                if (columnDef.type instanceof DateDataType) {
                    isCreatedAt = columnDef.type.isCreatedAt;
                    isUpdatedAt = columnDef.type.isUpdatedAt;
                }
            } else {
                type = 'string';
                isAutoIncrement = false;
            }

            if (dataWithDefaults[key] === undefined) {
                if (columnDef.default !== undefined) {
                    dataWithDefaults[key] = columnDef.default;
                } else if (isAutoIncrement && type === 'number') {
                    dataWithDefaults[key] = await this.getNextAutoIncrementValue(key);
                } else if (type === 'uuid') {
                    dataWithDefaults[key] = uuidv4();
                } else if (type === 'cuid') {
                    dataWithDefaults[key] = createId();
                } else if (type === 'date') {
                    if (isCreatedAt || isUpdatedAt) {
                        dataWithDefaults[key] = new Date().toISOString();
                    }
                }
            }
        }
        return dataWithDefaults;
    }

    private getDeletedAtField(): string | null {
        for (const key in this.schema.definition) {
            const columnDef = this.schema.definition[key];
            if (columnDef.type instanceof DateDataType && columnDef.type.isDeletedAt) {
                return key;
            }
        }
        return null;
    }

    private getUpdatedAtField(): string | null {
        for (const key in this.schema.definition) {
            const columnDef = this.schema.definition[key];
            if (columnDef.type instanceof DateDataType && columnDef.type.isUpdatedAt) {
                return key;
            }
        }
        return null;
    }

    private async getNextAutoIncrementValue(key: string): Promise<number> {
        const rows = await this.client.getSheetValues(`${this.sheetName}!A2:Z`);
        if (!rows || rows.length === 0) return 1;

        const items = rows.map((row: any[]) => this.mapRowToObject(row));
        const max = items.reduce((maxVal: number, item: any) => {
            const val = item[key];
            return typeof val === 'number' && val > maxVal ? val : maxVal;
        }, 0);

        return max + 1;
    }

    private matchesFilter(item: T, filter: Filter<T>): boolean {
        for (const key in filter) {
            const filterValue = filter[key];
            const itemValue = item[key as keyof T];

            if (typeof filterValue === 'object' && filterValue !== null && !Array.isArray(filterValue) && !(filterValue instanceof Date)) {
                // Handle comparison operators
                const ops = filterValue as FilterOperator<any>;
                if (ops.gt !== undefined && !(itemValue > ops.gt)) return false;
                if (ops.lt !== undefined && !(itemValue < ops.lt)) return false;
                if (ops.gte !== undefined && !(itemValue >= ops.gte)) return false;
                if (ops.lte !== undefined && !(itemValue <= ops.lte)) return false;
                if (ops.ne !== undefined && itemValue === ops.ne) return false;
            } else {
                // Exact match
                if (itemValue !== filterValue) {
                    return false;
                }
            }
        }
        return true;
    }
}
