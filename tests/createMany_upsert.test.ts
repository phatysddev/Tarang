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
    email: { type: DataTypes.String, unique: true },
});

type User = Infer<typeof UserSchema>;

// Mock Data
let mockData: string[][] = [];

// Mock Client
const mockClient = {
    getSheetValues: mock(async (range: string) => {
        if (range.includes('!A1:Z1')) {
            return [['id', 'name', 'email']];
        }
        if (range.includes('!A2:Z')) {
            return mockData;
        }
        return [];
    }),
    updateValues: mock(async (range: string, values: any[][]) => {
        // Simple mock update logic for upsert test
        // In a real scenario, we'd need to parse range to find index
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

describe("Model createMany and upsert", () => {
    beforeEach(() => {
        mockData = []; // Reset data
        (mockClient.appendValues as any).mockClear();
        (mockClient.updateValues as any).mockClear();
    });

    test("createMany should append multiple rows", async () => {
        const users = await userModel.createMany([
            { name: 'Alice', email: 'alice@example.com' },
            { name: 'Bob', email: 'bob@example.com' },
        ]);

        expect(users.length).toBe(2);
        expect(users[0].name).toBe('Alice');
        expect(users[1].name).toBe('Bob');
        expect(mockClient.appendValues).toHaveBeenCalledTimes(1);
        // Check if appendValues was called with 2 rows
        const callArgs = (mockClient.appendValues as any).mock.calls[0];
        expect(callArgs[1].length).toBe(2);
    });

    test("upsert should create if not found", async () => {
        const user = await userModel.upsert({
            where: { email: 'charlie@example.com' },
            update: { name: 'Charlie Updated' },
            create: { name: 'Charlie', email: 'charlie@example.com' },
        });

        expect(user.name).toBe('Charlie');
        expect(mockClient.appendValues).toHaveBeenCalled();
    });

    test("upsert should update if found", async () => {
        // Pre-populate data
        mockData = [['1', 'David', 'david@example.com']];

        const user = await userModel.upsert({
            where: { email: 'david@example.com' },
            update: { name: 'David Updated' },
            create: { name: 'David', email: 'david@example.com' },
        });

        expect(user.name).toBe('David Updated');
        expect(mockClient.updateValues).toHaveBeenCalled();
        expect(mockClient.appendValues).not.toHaveBeenCalled();
    });
});
