import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Model } from "../src/model";
import { Schema } from "../src/schema";
import { DataTypes } from "../src/datatypes";
import { TarangClient } from "../src/client";
import { Infer } from "../src/types";

// --- Schema ---
const UserSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    name: DataTypes.String,
    deletedAt: DataTypes.Date.deletedAt(),
});

type User = Infer<typeof UserSchema>;

// --- Mock Client ---
let mockData: string[][] = [];

const mockClient = {
    getSheetValues: mock(async (range: string) => {
        if (range.includes('!A1:Z1')) return [['id', 'name', 'deletedAt']];
        if (range.includes('!A2:Z')) return mockData;
        return [];
    }),
    updateValues: mock(async (range: string, values: any[][]) => {
        // In a real mock, we would update mockData here.
        // For simplicity, we'll just verify the call arguments in tests.
    }),
    appendValues: mock(async () => { }),
    clearValues: mock(async () => { }),
} as unknown as TarangClient;

const userModel = new Model<User>(mockClient, {
    sheetName: 'Users',
    schema: UserSchema,
});

describe("Model Soft Delete", () => {
    beforeEach(() => {
        mockData = [
            ['1', 'Alice', ''],
            ['2', 'Bob', '2023-01-01T00:00:00.000Z'], // Already deleted
            ['3', 'Charlie', ''],
        ];
        (mockClient.updateValues as any).mockClear();
    });

    test("findMany should exclude deleted items by default", async () => {
        const users = await userModel.findMany();
        expect(users.length).toBe(2);
        expect(users.map(u => u.name)).toContain('Alice');
        expect(users.map(u => u.name)).toContain('Charlie');
        expect(users.map(u => u.name)).not.toContain('Bob');
    });

    test("findMany should include deleted items if requested", async () => {
        const users = await userModel.findMany({}, { includeDeleted: true });
        expect(users.length).toBe(3);
        expect(users.map(u => u.name)).toContain('Bob');
    });

    test("delete() should soft delete by setting deletedAt", async () => {
        const count = await userModel.delete({ name: 'Alice' });
        expect(count).toBe(1);
        expect(mockClient.updateValues).toHaveBeenCalled();

        const callArgs = (mockClient.updateValues as any).mock.calls[0];
        const newRows = callArgs[1];
        // Alice is first row (index 0)
        // We expect the row for Alice to have a date in the 3rd column (index 2)
        expect(newRows[0][2]).not.toBe('');
        // Charlie (index 2 in original, but here it depends on how updateValues is called)
        // The mock implementation of updateValues in Model sends ALL rows back.
        // So index 0 is Alice, index 1 is Bob, index 2 is Charlie.
        expect(newRows[2][2]).toBe('');
    });

    test("update() should ignore deleted items", async () => {
        // Try to update everyone's name
        await userModel.update({}, { name: 'Updated' });

        expect(mockClient.updateValues).toHaveBeenCalled();
        const callArgs = (mockClient.updateValues as any).mock.calls[0];
        const newRows = callArgs[1];

        // Alice (active) should be updated
        expect(newRows[0][1]).toBe('Updated');
        // Bob (deleted) should NOT be updated
        expect(newRows[1][1]).toBe('Bob');
        // Charlie (active) should be updated
        expect(newRows[2][1]).toBe('Updated');
    });

    test("delete({ force: true }) should hard delete", async () => {
        // Force delete Alice
        const count = await userModel.delete({ name: 'Alice' }, { force: true });
        expect(count).toBe(1);
        expect(mockClient.clearValues).toHaveBeenCalled();
        expect(mockClient.updateValues).toHaveBeenCalled();

        const callArgs = (mockClient.updateValues as any).mock.calls[0];
        const keptRows = callArgs[1];
        // Should only keep Bob and Charlie
        expect(keptRows.length).toBe(2);
        expect(keptRows[0][1]).toBe('Bob');
        expect(keptRows[1][1]).toBe('Charlie');
    });
});
