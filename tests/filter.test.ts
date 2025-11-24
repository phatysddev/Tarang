import { describe, expect, test, mock } from "bun:test";
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
    isActive: DataTypes.Boolean,
});

type User = Infer<typeof UserSchema>;

// Mock Data
const mockData = [
    ['id', 'name', 'age', 'isActive'], // Header
    ['1', 'Alice', '25', 'TRUE'],
    ['2', 'Bob', '30', 'FALSE'],
    ['3', 'Charlie', '35', 'TRUE'],
    ['4', 'David', '20', 'FALSE'],
];

// Mock Client
const mockClient = {
    getSheetValues: mock(async (range: string) => {
        if (range.includes('!A1:Z1')) {
            return [mockData[0]];
        }
        if (range.includes('!A2:Z')) {
            return mockData.slice(1);
        }
        return [];
    }),
    updateValues: mock(async () => { }),
    appendValues: mock(async () => { }),
    clearValues: mock(async () => { }),
} as unknown as TarangClient;

const userModel = new Model<User>(mockClient, {
    sheetName: 'Users',
    schema: UserSchema,
});

describe("Model Filtering", () => {
    test("Filter by exact match", async () => {
        const users = await userModel.findMany({ age: 25 });
        expect(users.length).toBe(1);
        expect(users[0].name).toBe('Alice');
    });

    test("Filter by greater than (gt)", async () => {
        const users = await userModel.findMany({ age: { gt: 25 } });
        expect(users.length).toBe(2); // Bob (30), Charlie (35)
        expect(users.map(u => u.name)).toContain('Bob');
        expect(users.map(u => u.name)).toContain('Charlie');
    });

    test("Filter by less than (lt)", async () => {
        const users = await userModel.findMany({ age: { lt: 30 } });
        expect(users.length).toBe(2); // Alice (25), David (20)
        expect(users.map(u => u.name)).toContain('Alice');
        expect(users.map(u => u.name)).toContain('David');
    });

    test("Filter by greater than or equal (gte)", async () => {
        const users = await userModel.findMany({ age: { gte: 30 } });
        expect(users.length).toBe(2); // Bob (30), Charlie (35)
        expect(users.map(u => u.name)).toContain('Bob');
        expect(users.map(u => u.name)).toContain('Charlie');
    });

    test("Filter by less than or equal (lte)", async () => {
        const users = await userModel.findMany({ age: { lte: 25 } });
        expect(users.length).toBe(2); // Alice (25), David (20)
        expect(users.map(u => u.name)).toContain('Alice');
        expect(users.map(u => u.name)).toContain('David');
    });

    test("Filter by not equal (ne)", async () => {
        const users = await userModel.findMany({ age: { ne: 25 } });
        expect(users.length).toBe(3); // Bob (30), Charlie (35), David (20)
        expect(users.map(u => u.name)).not.toContain('Alice');
    });

    test("Filter by multiple conditions", async () => {
        const users = await userModel.findMany({
            age: { gt: 20 },
            isActive: true
        });
        expect(users.length).toBe(2); // Alice (25, TRUE), Charlie (35, TRUE)
        expect(users.map(u => u.name)).toContain('Alice');
        expect(users.map(u => u.name)).toContain('Charlie');
    });
});
