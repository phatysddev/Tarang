import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { SheetConfig } from './types';
import { formatPrivateKey } from './utils';

export class TarangClient {
    private auth: JWT;
    private spreadsheetId: string;
    public sheets: any;

    constructor(config: SheetConfig) {
        this.spreadsheetId = config.spreadsheetId;
        this.auth = new google.auth.JWT({
            email: config.auth.clientEmail,
            key: formatPrivateKey(config.auth.privateKey),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    }

    async getSpreadsheetId() {
        return this.spreadsheetId;
    }

    async getSheetValues(range: string) {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range,
        });
        return response.data.values;
    }

    async appendValues(range: string, values: any[][]) {
        const response = await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });
        return response.data;
    }

    async updateValues(range: string, values: any[][]) {
        const response = await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });
        return response.data;
    }

    async clearValues(range: string) {
        const response = await this.sheets.spreadsheets.values.clear({
            spreadsheetId: this.spreadsheetId,
            range,
        });
        return response.data;
    }
}
