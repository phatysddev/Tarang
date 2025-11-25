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
    email: { type: DataTypes.String, unique: true },
});

type User = Infer<typeof UserSchema>;

// Mock Data
let mockData: string[][] = [];

// Mock Client
const mockClient = {
    getSheetValues: mock(async (range: string) => {
        if (range.includes('!A1:Z1')) {
            return [['id', 'name', 'age', 'email']];
        }
        if (range.includes('!A2:Z')) {
            return mockData;
        }
        return [];
    }),
    updateValues: mock(async () => { }),
    appendValues: mock(async (range: string, values: any[][]) => {
        mockData.push(...values);
    }),
    clearValues: mock(async () => { }),
} as unknown as TarangClient;

const userModel = new Model<User>(mockClient, {
    sheetName: 'Users',
    schema: UserSchema,
});

describe("Model Comprehensive", () => {
    beforeEach(() => {
        mockData = [
            ['1', 'Alice', '25', 'alice@example.com'],
            ['2', 'Bob', '30', 'bob@example.com'],
            ['3', 'Charlie', '20', 'charlie@example.com'],
            ['4', 'David', '35', 'david@example.com'],
        ];
        (mockClient.updateValues as any).mockClear();
        (mockClient.appendValues as any).mockClear();
        (mockClient.clearValues as any).mockClear();
    });

    describe("findMany", () => {
        test("should return all records if no filter", async () => {
            const users = await userModel.findMany();
            expect(users.length).toBe(4);
        });

        test("should support select", async () => {
            const users = await userModel.findMany({}, { select: { name: true } });
            expect(users[0]).toEqual({ name: 'Alice' });
            expect(users[0].age).toBeUndefined();
        });

        test("should support limit and skip", async () => {
            const users = await userModel.findMany({}, { limit: 2, skip: 1 });
            expect(users.length).toBe(2);
            expect(users[0].name).toBe('Bob');
            expect(users[1].name).toBe('Charlie');
        });

        test("should support sorting (asc)", async () => {
            const users = await userModel.findMany({}, { sortBy: 'age', sortOrder: 'asc' });
            expect(users[0].name).toBe('Charlie'); // 20
            expect(users[1].name).toBe('Alice');   // 25
            expect(users[2].name).toBe('Bob');     // 30
            expect(users[3].name).toBe('David');   // 35
        });

        test("should support sorting (desc)", async () => {
            const users = await userModel.findMany({}, { sortBy: 'age', sortOrder: 'desc' });
            expect(users[0].name).toBe('David');   // 35
            expect(users[1].name).toBe('Bob');     // 30
        });
    });

    describe("findFirst", () => {
        test("should return first match", async () => {
            const user = await userModel.findFirst({ age: 30 });
            expect(user).not.toBeNull();
            expect(user?.name).toBe('Bob');
        });

        test("should return null if not found", async () => {
            const user = await userModel.findFirst({ age: 99 });
            expect(user).toBeNull();
        });
    });

    describe("create", () => {
        test("should create a new record", async () => {
            const newUser = await userModel.create({ name: 'Eve', age: 22, email: 'eve@example.com' });
            expect(newUser.name).toBe('Eve');
            expect(newUser.id).toBe(5); // Auto-increment
            expect(mockClient.appendValues).toHaveBeenCalled();
        });
    });

    describe("delete (Hard)", () => {
        test("should hard delete records", async () => {
            const count = await userModel.delete({ age: 25 }, { force: true });
            expect(count).toBe(1);
            expect(mockClient.clearValues).toHaveBeenCalled();
            expect(mockClient.updateValues).toHaveBeenCalled();

            // Verify what was written back (kept rows)
            const callArgs = (mockClient.updateValues as any).mock.calls[0];
            const keptRows = callArgs[1];
            expect(keptRows.length).toBe(3); // 3 remaining
        });
    });
});
