import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Model } from "../src/model";
import { Schema } from "../src/schema";
import { DataTypes } from "../src/datatypes";
import { TarangClient } from "../src/client";
import { Infer } from "../src/types";

const PostSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    title: DataTypes.String,
});

type Post = Infer<typeof PostSchema>;

describe("Model Concurrency", () => {
    let mockClient: any;
    let model: Model<Post>;

    beforeEach(() => {
        mockClient = {
            getSheetValues: mock(async (range: string) => {
                // Always return empty to simulate "stale" read where writes haven't appeared yet
                return [];
            }),
            createSheet: mock(async (title: string) => { }),
            updateValues: mock(async () => { }),
            appendValues: mock(async () => { }),
        };

        model = new Model<Post>(mockClient as unknown as TarangClient, {
            sheetName: 'Posts',
            schema: PostSchema,
        });
    });

    test("should increment ID locally even if sheet is stale", async () => {
        // Create first post
        const post1 = await model.create({ title: 'Post 1' });
        expect(post1.id).toBe(1);

        // Create second post immediately. 
        // getSheetValues will still return empty (stale), but local tracking should know max is 1.
        const post2 = await model.create({ title: 'Post 2' });
        expect(post2.id).toBe(2);

        // Create third post
        const post3 = await model.create({ title: 'Post 3' });
        expect(post3.id).toBe(3);
    });
});
