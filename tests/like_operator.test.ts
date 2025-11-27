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
    email: DataTypes.String,
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
        return mockData;
    }),
    updateValues: mock(async () => { }),
    appendValues: mock(async () => { }),
    clearValues: mock(async () => { }),
} as unknown as TarangClient;

const userModel = new Model<User>(mockClient, {
    sheetName: 'Users',
    schema: UserSchema,
});

describe("LIKE Operator", () => {
    beforeEach(() => {
        mockData = [
            ['1', 'Alice', 'alice@example.com'],
            ['2', 'Bob', 'bob@example.com'],
            ['3', 'Charlie', 'charlie@example.com'],
            ['4', 'Dave', 'dave@example.com'],
            ['5', 'Eve', 'eve@example.org'],
        ];
    });

    test("should support LIKE with % (starts with)", async () => {
        const users = await userModel.findMany({ name: { like: 'A%' } });
        expect(users.length).toBe(1);
        expect(users[0].name).toBe('Alice');
    });

    test("should support LIKE with % (ends with)", async () => {
        const users = await userModel.findMany({ name: { like: '%e' } });
        expect(users.length).toBe(4); // Alice, Charlie, Dave, Eve
        const names = users.map(u => u.name).sort();
        expect(names).toEqual(['Alice', 'Charlie', 'Dave', 'Eve']);
    });

    test("should support LIKE with % (contains)", async () => {
        const users = await userModel.findMany({ name: { like: '%li%' } });
        expect(users.length).toBe(2); // Alice, Charlie
        const names = users.map(u => u.name).sort();
        expect(names).toEqual(['Alice', 'Charlie']);
    });

    test("should support LIKE with _ (single char)", async () => {
        const users = await userModel.findMany({ name: { like: 'Bo_' } });
        expect(users.length).toBe(1);
        expect(users[0].name).toBe('Bob');
    });

    test("should be case-sensitive for LIKE", async () => {
        const users = await userModel.findMany({ name: { like: 'alice' } });
        expect(users.length).toBe(0);
    });

    test("should support ILIKE (case-insensitive)", async () => {
        const users = await userModel.findMany({ name: { ilike: 'alice' } });
        expect(users.length).toBe(1);
        expect(users[0].name).toBe('Alice');
    });

    test("should support ILIKE with patterns", async () => {
        const users = await userModel.findMany({ name: { ilike: '%LI%' } });
        expect(users.length).toBe(2); // Alice, Charlie
    });
});
