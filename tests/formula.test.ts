import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Model } from "../src/model";
import { Schema } from "../src/schema";
import { DataTypes } from "../src/datatypes";
import { TarangClient } from "../src/client";
import { Infer } from "../src/types";

// Define Schema
const ProductSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    name: DataTypes.String,
    price: DataTypes.Number,
    qty: DataTypes.Number,
    total: DataTypes.Number, // We want to put a formula here
});

type Product = Infer<typeof ProductSchema>;

// Mock Data
let mockData: string[][] = [];

// Mock Client
const mockClient = {
    getSheetValues: mock(async (range: string) => {
        if (range.includes('!A1:Z1')) {
            return [['id', 'name', 'price', 'qty', 'total']];
        }
        return mockData;
    }),
    updateValues: mock(async () => { }),
    appendValues: mock(async (range: string, values: any[][]) => {
        mockData.push(...values);
    }),
    clearValues: mock(async () => { }),
} as unknown as TarangClient;

const productModel = new Model<Product>(mockClient, {
    sheetName: 'Products',
    schema: ProductSchema,
});

describe("Formula Support", () => {
    beforeEach(() => {
        mockData = [];
        (mockClient.appendValues as any).mockClear();
    });

    test("should allow inserting a formula into a number field", async () => {
        const product = await productModel.create({
            name: 'iPhone',
            price: 30000,
            qty: 2,
            total: '=INDIRECT("R[0]C[-2]", FALSE) * INDIRECT("R[0]C[-1]", FALSE)'
        });

        expect(product.name).toBe('iPhone');
        expect((product.total as any)).toBe('=INDIRECT("R[0]C[-2]", FALSE) * INDIRECT("R[0]C[-1]", FALSE)');

        expect(mockClient.appendValues).toHaveBeenCalled();
        const callArgs = (mockClient.appendValues as any).mock.calls[0];
        const values = callArgs[1];
        // Check if the formula string is preserved in the row data
        // id, name, price, qty, total
        expect(values[0][4]).toBe('=INDIRECT("R[0]C[-2]", FALSE) * INDIRECT("R[0]C[-1]", FALSE)');
    });
});
