import { describe, expect, test } from "bun:test";
import { Schema } from "../src/schema";
import { DataTypes } from "../src/datatypes";

describe("Schema", () => {
    test("should normalize shorthand definitions", () => {
        const schema = new Schema({
            name: DataTypes.String,
            age: DataTypes.Number,
        });

        expect(schema.definition.name).toEqual({ type: DataTypes.String });
        expect(schema.definition.age).toEqual({ type: DataTypes.Number });
    });

    test("should accept full definitions", () => {
        const schema = new Schema({
            name: { type: DataTypes.String, unique: true },
        });

        expect(schema.definition.name).toEqual({ type: DataTypes.String, unique: true });
    });

    test("should throw error for autoIncrement on non-number types", () => {
        expect(() => {
            new Schema({
                // @ts-ignore
                name: { type: DataTypes.String, autoIncrement: true },
            });
        }).toThrow("Field 'name' cannot have autoIncrement enabled");
    });

    test("should allow autoIncrement on number types", () => {
        expect(() => {
            new Schema({
                id: { type: DataTypes.Number, autoIncrement: true },
            });
        }).not.toThrow();
    });
});
