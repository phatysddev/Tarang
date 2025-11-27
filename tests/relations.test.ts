import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Model } from "../src/model";
import { Schema } from "../src/schema";
import { DataTypes } from "../src/datatypes";
import { TarangClient } from "../src/client";
import { Infer } from "../src/types";

// --- Schemas ---
const UserSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    name: DataTypes.String,
});

const PostSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    title: DataTypes.String,
    userId: DataTypes.Number,
});

type User = Infer<typeof UserSchema>;
type Post = Infer<typeof PostSchema>;

// --- Mock Client ---
// We'll mock getSheetValues to return specific data for Users and Posts
const mockClient = {
    getSheetValues: mock(async (range: string) => {
        if (range.includes('Users!A1:Z1')) return [['id', 'name']];
        if (range.includes('Posts!A1:Z1')) return [['id', 'title', 'userId']];

        if (range.includes('Users!A2:Z')) {
            return [
                ['1', 'Alice'],
                ['2', 'Bob'],
            ];
        }
        if (range.includes('Posts!A2:Z')) {
            return [
                ['101', 'Alice Post 1', '1'],
                ['102', 'Alice Post 2', '1'],
                ['103', 'Bob Post 1', '2'],
            ];
        }
        return [];
    }),
    updateValues: mock(async () => { }),
    appendValues: mock(async () => { }),
} as unknown as TarangClient;

// --- Models ---
const postModel = new Model<Post>(mockClient, {
    sheetName: 'Posts',
    schema: PostSchema,
});

const userModel = new Model<User>(mockClient, {
    sheetName: 'Users',
    schema: UserSchema,
    relations: {
        posts: {
            type: 'hasMany',
            targetModel: postModel,
            foreignKey: 'userId',
            localKey: 'id',
        },
    },
});

// Add inverse relation to Post manually for testing
(postModel as any).relations = {
    author: {
        type: 'belongsTo',
        targetModel: userModel,
        foreignKey: 'id',     // Key on Target (User)
        localKey: 'userId',   // Key on Source (Post)
    }
};

describe("Model Relations", () => {
    beforeEach(() => {
        (mockClient.getSheetValues as any).mockClear();
    });

    test("should load hasMany relation", async () => {
        const users = await userModel.findMany({}, { include: { posts: true } });

        expect(users.length).toBe(2);

        const alice = users.find(u => u.name === 'Alice');
        expect(alice).toBeDefined();
        expect((alice as any).posts).toBeDefined();
        expect((alice as any).posts.length).toBe(2);
        expect((alice as any).posts[0].title).toBe('Alice Post 1');

        const bob = users.find(u => u.name === 'Bob');
        expect(bob).toBeDefined();
        expect((bob as any).posts.length).toBe(1);
        expect((bob as any).posts[0].title).toBe('Bob Post 1');
    });

    test("should load belongsTo relation", async () => {
        const posts = await postModel.findMany({}, { include: { author: true } });

        expect(posts.length).toBe(3);

        const post1 = posts.find(p => p.id === 101);
        expect(post1).toBeDefined();
        expect((post1 as any).author).toBeDefined();
        expect((post1 as any).author.name).toBe('Alice');

        const post3 = posts.find(p => p.id === 103);
        expect(post3).toBeDefined();
        expect((post3 as any).author.name).toBe('Bob');
    });
});
