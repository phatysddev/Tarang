import { TarangClient } from './client';
import { ModelConfig, RowData, Schema } from './types';
import { parseValue, stringifyValue } from './utils';
import { v4 as uuidv4 } from 'uuid';
import { createId } from '@paralleldrive/cuid2';

import { RelationConfig } from './types';

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
            this.headers = Object.keys(this.schema);
            await this.client.updateValues(`${this.sheetName}!A1`, [this.headers]);
        }
    }

    private mapRowToObject(row: any[]): T {
        const obj: any = {};
        this.headers.forEach((header, index) => {
            const value = row[index];
            const columnDef = this.schema[header];
            if (columnDef) {
                obj[header] = parseValue(value, columnDef.type);
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

    async findMany(filter?: Partial<T>, options?: { include?: Record<string, boolean>, select?: Record<string, boolean>, limit?: number, skip?: number }): Promise<Partial<T>[]> {
        await this.ensureHeaders();
        const rows = await this.client.getSheetValues(`${this.sheetName}!A2:Z`);
        if (!rows) return [];

        let results = rows.map((row: any[]) => this.mapRowToObject(row));

        if (filter) {
            results = this.applyFilter(results, filter);
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

    private applyFilter(results: T[], filter: Partial<T>): T[] {
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

    async findFirst(filter: Partial<T>, options?: { include?: Record<string, boolean>, select?: Record<string, boolean>, skip?: number }): Promise<Partial<T> | null> {
        const results = await this.findMany(filter, { ...options, limit: 1 });
        return results.length > 0 ? results[0] : null;
    }

    async create(data: Partial<T>): Promise<T> {
        await this.ensureHeaders();
        const dataWithDefaults = this.prepareDataForCreate(data);
        const row = this.mapObjectToRow(dataWithDefaults);
        await this.client.appendValues(`${this.sheetName}!A:A`, [row]);
        return dataWithDefaults as T;
    }

    async update(filter: Partial<T>, data: Partial<T>): Promise<T[]> {
        await this.ensureHeaders();
        const rows = await this.client.getSheetValues(`${this.sheetName}!A2:Z`);
        if (!rows) return [];

        const updatedItems: T[] = [];

        // We need to process rows to find matches and update them
        // This is a bit tricky to batch efficiently without reading everything first
        // Current implementation updates one by one which is slow but safe for MVP

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const item = this.mapRowToObject(row);

            if (this.matchesFilter(item, filter)) {
                const updatedItem = { ...item, ...data };
                updatedItems.push(updatedItem);
                const newRow = this.mapObjectToRow(updatedItem);

                // Row index is i + 2 (1 for header, 1 for 0-based index)
                const rowIndex = i + 2;
                await this.client.updateValues(`${this.sheetName}!A${rowIndex}`, [newRow]);
            }
        }

        return updatedItems;
    }

    async delete(filter: Partial<T>): Promise<number> {
        await this.ensureHeaders();
        const rows = await this.client.getSheetValues(`${this.sheetName}!A2:Z`);
        if (!rows) return 0;

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

    private prepareDataForCreate(data: Partial<T>): any {
        const dataWithDefaults: any = { ...data };
        for (const key in this.schema) {
            const columnDef = this.schema[key];
            if (dataWithDefaults[key] === undefined) {
                if (columnDef.default !== undefined) {
                    dataWithDefaults[key] = columnDef.default;
                } else if (columnDef.type === 'uuid') {
                    dataWithDefaults[key] = uuidv4();
                } else if (columnDef.type === 'cuid') {
                    dataWithDefaults[key] = createId();
                }
            }
        }
        return dataWithDefaults;
    }

    private matchesFilter(item: T, filter: Partial<T>): boolean {
        for (const key in filter) {
            if (item[key as keyof T] !== filter[key]) {
                return false;
            }
        }
        return true;
    }
}
