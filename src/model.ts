import { TarangClient } from './client';
import { ModelConfig, RelationConfig, Filter, FilterOperator, AllowFormulas, FindOptions, CellValue, RowData, ModelLike } from './types';
import { DataType, DateDataType } from './datatypes';
import { parseValue, stringifyValue } from './utils';
import { v4 as uuidv4 } from 'uuid';
import { createId } from '@paralleldrive/cuid2';
import { Schema } from './schema';

export class Model<T extends RowData = RowData> {
    private readonly client: TarangClient;
    private readonly sheetName: string;
    private readonly schema: Schema;
    private readonly relations: Record<string, RelationConfig> = {};
    private headers: string[] = [];
    private lastAutoIncrementValues: Record<string, number> = {};

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

        try {
            const values = await this.client.getSheetValues(`${this.sheetName}!A1:Z1`);
            if (values && values.length > 0) {
                this.headers = values[0];
            } else {
                // Sheet exists but empty, create headers
                this.headers = Object.keys(this.schema.definition);
                await this.client.updateValues(`${this.sheetName}!A1`, [this.headers]);
            }
        } catch (error: unknown) {
            // Check for "Unable to parse range" which often means sheet doesn't exist
            // Also check nested error object from Gaxios
            const err = error as { code?: number; message?: string; response?: { data?: { error?: { message?: string } } } };
            const msg = err.message || err.response?.data?.error?.message || '';

            if (err.code === 400 && (msg.includes('Unable to parse range') || msg.includes('Invalid values'))) {
                // Try to create the sheet
                await this.client.createSheet(this.sheetName);

                // Then create headers
                this.headers = Object.keys(this.schema.definition);
                await this.client.updateValues(`${this.sheetName}!A1`, [this.headers]);
            } else {
                throw error;
            }
        }
    }

    private mapRowToObject(row: CellValue[]): T {
        const obj: Record<string, unknown> = {};
        this.headers.forEach((header, index) => {
            const value = row[index];
            const columnDef = this.schema.definition[header];
            if (columnDef) {
                const type = columnDef.type instanceof DataType ? columnDef.type.type : 'string';
                obj[header] = parseValue(value as string, type);
            } else {
                obj[header] = value;
            }
        });
        return obj as T;
    }

    private mapObjectToRow(obj: Partial<T>): CellValue[] {
        return this.headers.map(header => {
            const value = obj[header as keyof T];
            return stringifyValue(value);
        });
    }

    async findMany(filter?: Filter<T>, options?: FindOptions<T>): Promise<Partial<T>[]> {
        await this.ensureHeaders();
        const rows = await this.client.getSheetValues(`${this.sheetName}!A2:Z`);
        if (!rows) return [];

        let results = rows.map((row: CellValue[]) => this.mapRowToObject(row));

        // Filter out soft-deleted items unless explicitly requested
        if (!options?.includeDeleted) {
            const deletedAtField = this.getDeletedAtField();
            if (deletedAtField) {
                results = results.filter((item) => !item[deletedAtField as keyof T]);
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

    private async loadRelations(results: T[], include: Record<string, boolean | FindOptions<unknown>>) {
        const relationsToFetch = Object.keys(include).filter(
            key => include[key] && this.relations[key]
        );

        await Promise.all(relationsToFetch.map(async (relationName) => {
            const relation = this.relations[relationName];
            const targetModel = relation.targetModel as ModelLike<RowData>;
            const includeValue = include[relationName];

            // Determine options for the related model query
            let relatedOptions: FindOptions<RowData> = {};
            if (typeof includeValue === 'object') {
                relatedOptions = { ...(includeValue as FindOptions<RowData>) };
            }

            // Ensure foreign key is selected if select is present, otherwise we can't match relations
            if (relatedOptions.select) {
                relatedOptions.select[relation.foreignKey] = true;
            }

            // Fetch all related records once to avoid N+1 problem
            // We pass the nested options here!
            const allRelatedRecords = await targetModel.findMany(undefined, relatedOptions);

            results.forEach((item) => {
                const extendedItem = item as T & Record<string, unknown>;
                const localValue = extendedItem[relation.localKey as keyof T];
                if (!localValue) return;

                if (relation.type === 'hasOne' || relation.type === 'belongsTo') {
                    extendedItem[relationName] = allRelatedRecords.find(
                        (r) => r[relation.foreignKey as keyof typeof r] === localValue
                    ) || null;
                } else if (relation.type === 'hasMany') {
                    extendedItem[relationName] = allRelatedRecords.filter(
                        (r) => r[relation.foreignKey as keyof typeof r] === localValue
                    );
                }
            });
        }));
    }

    private applySelect(results: T[], select: Record<string, boolean>): Partial<T>[] {
        return results.map((item) => {
            const selectedItem: Partial<T> = {};
            for (const key in select) {
                if (select[key]) {
                    selectedItem[key as keyof T] = item[key as keyof T];
                }
            }
            return selectedItem;
        });
    }

    async findFirst(filter: Filter<T>, options?: FindOptions<T>): Promise<Partial<T> | null> {
        const results = await this.findMany(filter, { ...options, limit: 1 });
        return results.length > 0 ? results[0] : null;
    }

    async create(data: AllowFormulas<Partial<T>>): Promise<T> {
        await this.ensureHeaders();
        const dataWithDefaults = await this.prepareDataForCreate(data);
        const row = this.mapObjectToRow(dataWithDefaults);
        await this.client.appendValues(`${this.sheetName}!A:A`, [row]);
        return dataWithDefaults as T;
    }

    async createMany(data: AllowFormulas<Partial<T>>[]): Promise<T[]> {
        await this.ensureHeaders();
        const createdItems: T[] = [];
        const rows: CellValue[][] = [];

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

    async upsert(args: { where: Filter<T>, update: AllowFormulas<Partial<T>>, create: AllowFormulas<Partial<T>> }): Promise<T> {
        const existingItem = await this.findFirst(args.where);
        if (existingItem) {
            const updatedItems = await this.update(args.where, args.update);
            return updatedItems[0];
        } else {
            return this.create(args.create);
        }
    }

    async update(filter: Filter<T>, data: AllowFormulas<Partial<T>>): Promise<T[]> {
        await this.ensureHeaders();
        const rows = await this.client.getSheetValues(`${this.sheetName}!A2:Z`);
        if (!rows) return [];

        const updatedItems: T[] = [];
        const updatedAtField = this.getUpdatedAtField();
        const updateData: Record<string, unknown> = { ...data };

        if (updatedAtField) {
            updateData[updatedAtField] = new Date().toISOString();
        }

        let hasChanges = false;
        const newRows = rows.map((row: CellValue[]) => {
            const item = this.mapRowToObject(row);
            const deletedAtField = this.getDeletedAtField();

            // Skip soft-deleted items from update
            if (deletedAtField && item[deletedAtField as keyof T]) {
                return row;
            }

            if (this.matchesFilter(item, filter)) {
                const updatedItem = { ...item, ...updateData } as T;
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
            const newRows = rows.map((row: CellValue[]) => {
                const item = this.mapRowToObject(row);

                if (this.matchesFilter(item, filter)) {
                    // Skip if already deleted
                    if (item[deletedAtField as keyof T]) return row;

                    const updatedItem: Record<string, unknown> = { ...item };
                    updatedItem[deletedAtField] = new Date().toISOString();
                    deletedCount++;
                    hasChanges = true;
                    return this.mapObjectToRow(updatedItem as Partial<T>);
                }
                return row;
            });

            if (hasChanges) {
                await this.client.updateValues(`${this.sheetName}!A2`, newRows);
            }
            return deletedCount;
        }

        // Hard delete implementation
        const keptRows: CellValue[][] = [];
        let deletedCount = 0;

        rows.forEach((row: CellValue[]) => {
            const item = this.mapRowToObject(row);
            if (this.matchesFilter(item, filter)) {
                deletedCount++;
            } else {
                keptRows.push(row);
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

    private async prepareDataForCreate(data: AllowFormulas<Partial<T>>): Promise<Partial<T>> {
        const dataWithDefaults: Record<string, unknown> = { ...data };

        // Check for unique constraints
        for (const key in dataWithDefaults) {
            const columnDef = this.schema.definition[key];
            if (columnDef && columnDef.unique) {
                const existing = await this.findFirst({ [key]: dataWithDefaults[key] } as Filter<T>);
                if (existing) {
                    throw new Error(`Unique constraint violation: ${key} with value '${dataWithDefaults[key]}' already exists.`);
                }
            }
        }

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
        return dataWithDefaults as Partial<T>;
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

        let max = 0;
        if (rows && rows.length > 0) {
            const items = rows.map((row: CellValue[]) => this.mapRowToObject(row));
            max = items.reduce((maxVal: number, item: T) => {
                const val = item[key as keyof T];
                return typeof val === 'number' && val > maxVal ? val : maxVal;
            }, 0);
        }

        // Ensure we don't reuse a value if the sheet hasn't updated yet (API latency)
        if (this.lastAutoIncrementValues[key] !== undefined) {
            max = Math.max(max, this.lastAutoIncrementValues[key]);
        }

        const nextVal = max + 1;
        this.lastAutoIncrementValues[key] = nextVal;
        return nextVal;
    }

    private createLikeRegex(pattern: string): RegExp {
        const escapedPattern = pattern.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const regexString = '^' + escapedPattern.replaceAll('%', '.*').replaceAll('_', '.') + '$';
        return new RegExp(regexString);
    }

    private matchesFilter(item: T, filter: Filter<T>): boolean {
        for (const key in filter) {
            const filterValue = filter[key];
            const itemValue = item[key as keyof T];

            if (typeof filterValue === 'object' && filterValue !== null && !Array.isArray(filterValue) && !(filterValue instanceof Date)) {
                // Handle comparison operators
                const ops = filterValue as FilterOperator<T[keyof T]>;
                if (ops.gt !== undefined && itemValue <= ops.gt) return false;
                if (ops.lt !== undefined && itemValue >= ops.lt) return false;
                if (ops.gte !== undefined && itemValue < ops.gte) return false;
                if (ops.lte !== undefined && itemValue > ops.lte) return false;
                if (ops.ne !== undefined && itemValue === ops.ne) return false;
                if (ops.like !== undefined) {
                    if (typeof itemValue !== 'string') return false;
                    const regex = this.createLikeRegex(ops.like);
                    if (!regex.test(itemValue)) return false;
                }
                if (ops.ilike !== undefined) {
                    if (typeof itemValue !== 'string') return false;
                    const regex = this.createLikeRegex(ops.ilike);
                    if (!new RegExp(regex.source, 'i').test(itemValue)) return false;
                }
            } else if (itemValue !== filterValue) {
                // Exact match
                return false;
            }
        }
        return true;
    }
}
