import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { SheetConfig, CellValue } from './types';
import { formatPrivateKey } from './utils';

export class TarangClient {
    private readonly auth: JWT;
    private readonly spreadsheetId: string;
    public sheets: sheets_v4.Sheets;
    private readonly cache: Map<string, { data: CellValue[][] | null | undefined, timestamp: number }> = new Map();
    private readonly cacheTTL: number;
    private readonly maxCacheSize: number;

    constructor(config: SheetConfig) {
        this.spreadsheetId = config.spreadsheetId;
        this.auth = new google.auth.JWT({
            email: config.auth.clientEmail,
            key: formatPrivateKey(config.auth.privateKey),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });

        this.cacheTTL = config.cacheTTL ?? 60000;
        this.maxCacheSize = config.maxCacheSize ?? 100;
    }

    private invalidateCache(range: string) {
        // Extract sheet name from range (e.g., 'Sheet1!A1:B2' -> 'Sheet1')
        const sheetName = range.split('!')[0];
        if (!sheetName) return;

        // Delete all cache entries for this sheet
        for (const key of this.cache.keys()) {
            if (key.startsWith(sheetName + '!')) {
                this.cache.delete(key);
            }
        }
    }

    async getSpreadsheetId() {
        return this.spreadsheetId;
    }

    async getSheetValues(range: string) {
        if (this.cacheTTL > 0) {
            const cached = this.cache.get(range);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }

        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range,
        });

        if (this.cacheTTL > 0) {
            // Enforce max cache size
            if (this.cache.size >= this.maxCacheSize) {
                const firstKey = this.cache.keys().next().value;
                if (firstKey) this.cache.delete(firstKey);
            }
            this.cache.set(range, { data: response.data.values, timestamp: Date.now() });
        }

        return response.data.values;
    }

    async appendValues(range: string, values: CellValue[][]) {
        const response = await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });
        this.invalidateCache(range); // Invalidate cache for this sheet
        return response.data;
    }

    async updateValues(range: string, values: CellValue[][]) {
        const response = await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });
        this.invalidateCache(range); // Invalidate cache for this sheet
        return response.data;
    }

    async clearValues(range: string) {
        const response = await this.sheets.spreadsheets.values.clear({
            spreadsheetId: this.spreadsheetId,
            range,
        });
        this.invalidateCache(range); // Invalidate cache for this sheet
        return response.data;
    }

    async createSheet(title: string) {
        try {
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title,
                                },
                            },
                        },
                    ],
                },
            });
        } catch (error: unknown) {
            // Ignore if sheet already exists
            const err = error as { code?: number; message?: string; response?: { data?: { error?: { message?: string } } } };
            if (err.code === 400 && (err.message?.includes('already exists') || err.response?.data?.error?.message?.includes('already exists'))) {
                return;
            }
            throw error;
        }
    }
}
