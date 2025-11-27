import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Model } from "../src/model";
import { Schema } from "../src/schema";
import { DataTypes } from "../src/datatypes";
import { TarangClient } from "../src/client";
import { Infer } from "../src/types";

const UserSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    name: DataTypes.String,
    deletedAt: DataTypes.Date.deletedAt(),
});

type User = Infer<typeof UserSchema>;

describe("Soft Delete Reproduction", () => {
    let mockClient: any;
    let model: Model<User>;
    let sheetData: any[][];

    beforeEach(() => {
        sheetData = [
            ['id', 'name', 'deletedAt'],
            ['1', 'Alice', ''],
        ];

        mockClient = {
            getSheetValues: mock(async (range: string) => {
                if (range.includes('A2:Z')) {
                    return [['1', 'Alice', '']];
                }
                return sheetData;
            }),
            createSheet: mock(async (title: string) => { }),
            updateValues: mock(async (range: string, values: any[][]) => {
                // Simulate update
                // range is usually 'Sheet!A2' or similar. 
                // For simplicity in this mock, we assume we are updating the whole sheet or specific rows.
                // In the actual implementation, updateValues receives the NEW rows.

                // Let's just verify what's being passed.
                // If soft delete is working, we should see the row with a date in the 3rd column.
            }),
            clearValues: mock(async (range: string) => { }),
            appendValues: mock(async () => { }),
        };

        model = new Model<User>(mockClient as unknown as TarangClient, {
            sheetName: 'Users',
            schema: UserSchema,
        });
    });

    test("should perform soft delete by updating the row with deletedAt", async () => {
        await model.delete({ id: 1 });

        // Check if updateValues was called
        expect(mockClient.updateValues).toHaveBeenCalled();

        // Check if clearValues was NOT called (hard delete calls clearValues)
        expect(mockClient.clearValues).not.toHaveBeenCalled();

        // Inspect the arguments passed to updateValues
        const calls = mockClient.updateValues.mock.calls;
        const lastCall = calls[calls.length - 1];
        const updatedRows = lastCall[1];

        // We expect 1 row (Alice)
        expect(updatedRows.length).toBe(1);
        const aliceRow = updatedRows[0];

        // id, name, deletedAt
        expect(aliceRow[0]).toBe('1');
        expect(aliceRow[1]).toBe('Alice');
        // deletedAt should be a non-empty string (ISO date)
        expect(aliceRow[2]).not.toBe('');
        expect(aliceRow[2]).not.toBeNull();
        expect(aliceRow[2]).not.toBeUndefined();
    });
});
