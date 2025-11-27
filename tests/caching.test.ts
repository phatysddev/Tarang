import { describe, expect, test, mock, beforeEach } from "bun:test";
import { TarangClient } from "../src/client";
import { google } from "googleapis";

// Mock googleapis
const mockValuesGet = mock(async () => ({ data: { values: [['cached']] } }));
const mockValuesAppend = mock(async () => ({ data: {} }));
const mockValuesUpdate = mock(async () => ({ data: {} }));
const mockValuesClear = mock(async () => ({ data: {} }));

// We need to mock the google.sheets constructor and its return value
// Since we can't easily mock the module itself in bun test in this specific way without more setup,
// we will rely on the fact that TarangClient uses google.sheets internally.
// However, mocking external modules in Bun can be tricky.
// A better approach for unit testing TarangClient's caching logic might be to inspect the client instance if we could inject the sheets object,
// but `sheets` is public in TarangClient, so we can replace it!

describe("Caching", () => {
    let client: TarangClient;
    let mockSheets: any;

    beforeEach(() => {
        client = new TarangClient({
            spreadsheetId: 'test-sheet',
            auth: { clientEmail: 'test', privateKey: 'test' },
            cacheTTL: 1000 // 1 second cache
        });

        // Replace the internal sheets object with our mock
        mockSheets = {
            spreadsheets: {
                values: {
                    get: mockValuesGet,
                    append: mockValuesAppend,
                    update: mockValuesUpdate,
                    clear: mockValuesClear,
                }
            }
        };
        client.sheets = mockSheets;

        mockValuesGet.mockClear();
        mockValuesAppend.mockClear();
        mockValuesUpdate.mockClear();
        mockValuesClear.mockClear();
    });

    test("should cache getSheetValues calls", async () => {
        // First call should hit the API
        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(1);

        // Second call should hit the cache
        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(1);
    });

    test("should expire cache after TTL", async () => {
        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(1);

        // Wait for TTL to expire
        await new Promise(resolve => setTimeout(resolve, 1100));

        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(2);
    });

    test("should invalidate cache on appendValues", async () => {
        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(1);

        await client.appendValues('Sheet1!A1', [['new']]);

        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(2);
    });

    test("should invalidate cache on updateValues", async () => {
        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(1);

        await client.updateValues('Sheet1!A1', [['update']]);

        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(2);
    });

    test("should invalidate cache on clearValues", async () => {
        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(1);

        await client.clearValues('Sheet1!A1');

        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(2);
    });
    test("should only invalidate cache for the modified sheet", async () => {
        // Cache data for Sheet1 and Sheet2
        await client.getSheetValues('Sheet1!A1');
        await client.getSheetValues('Sheet2!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(2);

        // Modify Sheet1
        await client.appendValues('Sheet1!A1', [['new']]);

        // Sheet1 should be invalidated (hit API)
        await client.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(3);

        // Sheet2 should still be cached (no API hit)
        await client.getSheetValues('Sheet2!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(3);
    });

    test("should enforce max cache size", async () => {
        // Create client with small cache size
        const smallCacheClient = new TarangClient({
            spreadsheetId: 'test-sheet',
            auth: { clientEmail: 'test', privateKey: 'test' },
            cacheTTL: 60000,
            maxCacheSize: 2
        });
        smallCacheClient.sheets = mockSheets;

        // Fill cache
        await smallCacheClient.getSheetValues('Sheet1!A1');
        await smallCacheClient.getSheetValues('Sheet2!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(2);

        // Add one more to exceed limit (Sheet1 should be evicted)
        await smallCacheClient.getSheetValues('Sheet3!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(3);

        // Sheet1 should be evicted (hit API)
        await smallCacheClient.getSheetValues('Sheet1!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(4);

        // Sheet3 should still be cached (it was inserted recently)
        await smallCacheClient.getSheetValues('Sheet3!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(4);

        // Sheet2 should have been evicted by Sheet1 insertion
        await smallCacheClient.getSheetValues('Sheet2!A1');
        expect(mockValuesGet).toHaveBeenCalledTimes(5);
    });
});
