import { describe, expect, test } from "bun:test";
import { DataTypes, DataType, NumberDataType, DateDataType } from "../src/datatypes";

describe("DataTypes", () => {
    test("should have correct types", () => {
        expect(DataTypes.String.type).toBe("string");
        expect(DataTypes.Number.type).toBe("number");
        expect(DataTypes.Boolean.type).toBe("boolean");
        expect(DataTypes.JSON.type).toBe("json");
        expect(DataTypes.UUID.type).toBe("uuid");
        expect(DataTypes.CUID.type).toBe("cuid");
        expect(DataTypes.Date.type).toBe("date");
    });

    test("NumberDataType should support autoIncrement", () => {
        const num = new NumberDataType();
        expect(num.isAutoIncrement).toBe(false);
        const autoNum = num.autoIncrement();
        expect(autoNum.isAutoIncrement).toBe(true);
        expect(autoNum).toBeInstanceOf(NumberDataType);
    });

    test("DateDataType should support timestamps", () => {
        const date = new DateDataType();
        expect(date.isCreatedAt).toBe(false);
        expect(date.isUpdatedAt).toBe(false);
        expect(date.isDeletedAt).toBe(false);

        const createdAt = date.createdAt();
        expect(createdAt.isCreatedAt).toBe(true);
        expect(createdAt.isUpdatedAt).toBe(false);

        const updatedAt = date.updatedAt();
        expect(updatedAt.isCreatedAt).toBe(false);
        expect(updatedAt.isUpdatedAt).toBe(true);

        const deletedAt = date.deletedAt();
        expect(deletedAt.isDeletedAt).toBe(true);
    });

    test("toString should return type string", () => {
        expect(DataTypes.String.toString()).toBe("string");
    });
});
