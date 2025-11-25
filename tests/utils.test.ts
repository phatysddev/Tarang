import { describe, expect, test } from "bun:test";
import { formatPrivateKey, parseValue, stringifyValue } from "../src/utils";

describe("Utils", () => {
    describe("formatPrivateKey", () => {
        test("should replace \\n with newlines", () => {
            const key = "line1\\nline2\\nline3";
            expect(formatPrivateKey(key)).toBe("line1\nline2\nline3");
        });
    });

    describe("parseValue", () => {
        test("should return null for empty/null/undefined", () => {
            expect(parseValue("", "string")).toBeNull();
            expect(parseValue(null as any, "string")).toBeNull();
            expect(parseValue(undefined as any, "string")).toBeNull();
        });

        test("should parse number", () => {
            expect(parseValue("123", "number")).toBe(123);
            expect(parseValue("12.34", "number")).toBe(12.34);
        });

        test("should parse boolean", () => {
            expect(parseValue("TRUE", "boolean")).toBe(true);
            expect(parseValue("true", "boolean")).toBe(true);
            expect(parseValue("FALSE", "boolean")).toBe(false);
            expect(parseValue("false", "boolean")).toBe(false);
        });

        test("should parse json", () => {
            const obj = { a: 1, b: "test" };
            expect(parseValue(JSON.stringify(obj), "json")).toEqual(obj);
            expect(parseValue("invalid json", "json")).toBeNull();
        });

        test("should parse date", () => {
            const dateStr = "2023-01-01T00:00:00.000Z";
            const date = parseValue(dateStr, "date");
            expect(date).toBeInstanceOf(Date);
            expect(date.toISOString()).toBe(dateStr);
        });

        test("should return value as is for unknown types", () => {
            expect(parseValue("test", "string")).toBe("test");
            expect(parseValue("test", "unknown")).toBe("test");
        });
    });

    describe("stringifyValue", () => {
        test("should return empty string for null/undefined", () => {
            expect(stringifyValue(null)).toBe("");
            expect(stringifyValue(undefined)).toBe("");
        });

        test("should stringify date", () => {
            const date = new Date("2023-01-01T00:00:00.000Z");
            expect(stringifyValue(date)).toBe("2023-01-01T00:00:00.000Z");
        });

        test("should stringify object", () => {
            const obj = { a: 1 };
            expect(stringifyValue(obj)).toBe(JSON.stringify(obj));
        });

        test("should stringify primitives", () => {
            expect(stringifyValue(123)).toBe("123");
            expect(stringifyValue(true)).toBe("true");
            expect(stringifyValue("test")).toBe("test");
        });
    });
});
