import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Model } from "../src/model";
import { Schema } from "../src/schema";
import { DataTypes } from "../src/datatypes";
import { TarangClient } from "../src/client";
import { Infer } from "../src/types";

// Define Schema
const UserSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    name: DataTypes.String,
    age: DataTypes.Number,
    deletedAt: DataTypes.Date.deletedAt(),
});

type User = Infer<typeof UserSchema>;

// Mock Data
let mockData: string[][] = [];

// Mock Client
const mockClient = {
    getSheetValues: mock(async (range: string) => {
        if (range.includes('!A1:Z1')) {
            return [['id', 'name', 'age', 'deletedAt']];
        }
        if (range.includes('!A2:Z')) {
            return mockData;
        }
        return [];
    }),
    updateValues: mock(async (range: string, values: any[][]) => {
        // In a real scenario, we'd update mockData here
    }),
    appendValues: mock(async (range: string, values: any[][]) => {
        mockData.push(...values);
    }),
    clearValues: mock(async () => { }),
} as unknown as TarangClient;

const userModel = new Model<User>(mockClient, {
    sheetName: 'Users',
    schema: UserSchema,
});

describe("Performance Optimization", () => {
    beforeEach(() => {
        // Reset data with 3 users, 2 of which match the update criteria
        mockData = [
            ['1', 'Alice', '25', ''],
            ['2', 'Bob', '25', ''],
            ['3', 'Charlie', '30', ''],
        ];
        (mockClient.updateValues as any).mockClear();
    });

    test("update should call updateValues only once for multiple records", async () => {
        // Update all users with age 25 (Alice and Bob)
        const updatedUsers = await userModel.update(
            { age: 25 },
            { name: 'Updated Name' }
        );

        expect(updatedUsers.length).toBe(2);
        expect(updatedUsers[0].name).toBe('Updated Name');
        expect(updatedUsers[1].name).toBe('Updated Name');

        // Should be called exactly ONCE with the entire dataset
        expect(mockClient.updateValues).toHaveBeenCalledTimes(1);

        const callArgs = (mockClient.updateValues as any).mock.calls[0];
        const range = callArgs[0];
        const values = callArgs[1];

        expect(range).toContain('!A2');
        expect(values.length).toBe(3); // Should send back ALL 3 rows
    });

    test("soft delete should call updateValues only once for multiple records", async () => {
        // Soft delete all users with age 25
        const deletedCount = await userModel.delete({ age: 25 });

        expect(deletedCount).toBe(2);

        // Should be called exactly ONCE
        expect(mockClient.updateValues).toHaveBeenCalledTimes(1);

        const callArgs = (mockClient.updateValues as any).mock.calls[0];
        const values = callArgs[1];

        // Verify deletedAt is set for matched rows
        expect(values[0][3]).not.toBe(''); // Alice
        expect(values[1][3]).not.toBe(''); // Bob
        expect(values[2][3]).toBe('');     // Charlie (untouched)
    });
});
