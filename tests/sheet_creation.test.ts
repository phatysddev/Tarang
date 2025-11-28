import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Model } from "../src/model";
import { Schema } from "../src/schema";
import { DataTypes } from "../src/datatypes";
import { TarangClient } from "../src/client";
import { Infer } from "../src/types";

const UserSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    name: DataTypes.String,
});

type User = Infer<typeof UserSchema>;

describe("Model Sheet Creation", () => {
    let mockClient: any;
    let model: Model<User>;

    beforeEach(() => {
        mockClient = {
            getSheetValues: mock(async (range: string) => {
                // First call throws "Unable to parse range" (simulating missing sheet)
                // Subsequent calls return empty (simulating created sheet)
                throw { code: 400, message: "Unable to parse range: Users!A1:Z1" };
            }),
            createSheet: mock(async (title: string) => { }),
            updateValues: mock(async () => { }),
            appendValues: mock(async () => { }),
        };

        model = new Model<User>(mockClient as unknown as TarangClient, {
            sheetName: 'Users',
            schema: UserSchema,
        });
    });

    test("should create sheet if it does not exist", async () => {
        // Mock getSheetValues to throw error first, then return empty
        let callCount = 0;
        mockClient.getSheetValues = mock(async (range: string) => {
            if (callCount === 0) {
                callCount++;
                throw { code: 400, message: "Unable to parse range: Users!A1:Z1" };
            }
            return [];
        });

        await model.findMany();

        expect(mockClient.createSheet).toHaveBeenCalled();
        expect(mockClient.createSheet).toHaveBeenCalledWith('Users');
        expect(mockClient.updateValues).toHaveBeenCalled(); // Should create headers
    });
});
