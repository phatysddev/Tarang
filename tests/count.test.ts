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
    isDeleted: DataTypes.Date.deletedAt()
});

type User = Infer<typeof UserSchema>;

// Mock Data
let mockData: string[][] = [];

// Mock Client
const mockClient = {
    getSheetValues: mock(async (range: string) => {
        if (range.includes('!A1:Z1')) {
            return [['id', 'name', 'age', 'email', 'isDeleted']];
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

describe("Model Count", () => {
    beforeEach(() => {
        mockData = [
            ['1', 'Alice', '25', 'alice@example.com', ''],
            ['2', 'Bob', '30', 'bob@example.com', ''],
            ['3', 'Charlie', '20', 'charlie@example.com', ''],
            ['4', 'David', '25', 'david@example.com', '2023-01-01T00:00:00.000Z'], // Soft deleted
        ];
    });

    test("should count all active records by default", async () => {
        const count = await userModel.count();
        expect(count).toBe(3);
    });

    test("should count all records including deleted if specified", async () => {
        const count = await userModel.count(undefined, { includeDeleted: true });
        expect(count).toBe(4);
    });

    test("should count filtered records", async () => {
        const count = await userModel.count({ age: 25 });
        expect(count).toBe(1); // Alice only, David is deleted
    });

    test("should count filtered records including deleted", async () => {
        const count = await userModel.count({ age: 25 }, { includeDeleted: true });
        expect(count).toBe(2); // Alice and David
    });

    test("should return 0 if no match", async () => {
        const count = await userModel.count({ age: 99 });
        expect(count).toBe(0);
    });
});
