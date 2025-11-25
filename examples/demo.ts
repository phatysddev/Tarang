import { TarangClient, Model, Schema, DataTypes, Infer } from '../src';

// 1. Define Schemas
// -----------------

// User Schema
const UserSchema = new Schema({
    id: { type: DataTypes.UUID, unique: true }, // Auto-generated UUID
    cuid: { type: DataTypes.CUID, unique: true }, // Auto-generated CUID
    name: DataTypes.String, // Shorthand
    email: { type: DataTypes.String, unique: true },
    age: DataTypes.Number, // Shorthand
    birthDate: DataTypes.Date, // Plain Date field
    isActive: { type: DataTypes.Boolean, default: true },
    metadata: DataTypes.JSON, // JSON field
    createdAt: DataTypes.Date.createdAt(),
    updatedAt: DataTypes.Date.updatedAt(),
    deletedAt: DataTypes.Date.deletedAt(), // Soft delete
});

type User = Infer<typeof UserSchema>;

// Post Schema
const PostSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true, unique: true }, // Auto Increment ID
    title: DataTypes.String,
    content: DataTypes.String,
    userId: DataTypes.String, // Foreign Key
    createdAt: DataTypes.Date.createdAt(),
    updatedAt: DataTypes.Date.updatedAt(),
});

type Post = Infer<typeof PostSchema>;

async function main() {
    // 2. Initialize Client
    // --------------------
    const client = new TarangClient({
        spreadsheetId: 'YOUR_SPREADSHEET_ID',
        auth: {
            clientEmail: 'YOUR_SERVICE_ACCOUNT_EMAIL',
            privateKey: 'YOUR_PRIVATE_KEY',
        },
    });

    // 3. Initialize Models & Relations
    // --------------------------------

    // Post Model (Declared first to be used in User relations)
    const postModel = new Model<Post>(client, {
        sheetName: 'Posts',
        schema: PostSchema,
    });

    // User Model
    const userModel = new Model<User>(client, {
        sheetName: 'Users',
        schema: UserSchema,
        relations: {
            posts: {
                type: 'hasMany',
                targetModel: postModel,
                foreignKey: 'userId', // Column in Post table
                localKey: 'id',       // Column in User table
            },
        },
    });

    // Add inverse relation to Post Model (belongsTo)
    // Note: In a real app, you might want to define this cleaner, 
    // but here we modify the internal relations for the demo.
    // Ideally, you pass relations in the constructor.
    // Let's re-instantiate postModel with relations if we want to use it, 
    // or just assume we configured it correctly.
    // For this demo, let's just show the User -> Post relation primarily, 
    // but I'll add the config here for completeness if we were to re-create it.
    /*
    const postModelWithRelation = new Model<Post>(client, {
        sheetName: 'Posts',
        schema: PostSchema,
        relations: {
            author: {
                type: 'belongsTo',
                targetModel: userModel,
                foreignKey: 'userId',
                localKey: 'id'
            }
        }
    });
    */

    // 4. CRUD Operations
    // ------------------

    // Create Single User
    console.log('--- Creating User ---');
    const newUser = await userModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        birthDate: new Date('1995-05-15'),
        metadata: { role: 'admin', preferences: { theme: 'dark' } },
    });
    console.log('Created User:', newUser);

    // Create Many Users (Batch)
    console.log('\n--- Creating Many Users ---');
    const newUsers = await userModel.createMany([
        { name: 'Alice', email: 'alice@example.com', age: 25 },
        { name: 'Bob', email: 'bob@example.com', age: 35 },
    ]);
    console.log('Created Users:', newUsers);

    // Upsert User (Update if exists, Create if not)
    console.log('\n--- Upserting User ---');
    const upsertedUser = await userModel.upsert({
        where: { email: 'john@example.com' },
        update: { age: 31 }, // Update age if John exists
        create: { name: 'John Doe', email: 'john@example.com', age: 30 }, // Create if not
    });
    console.log('Upserted User:', upsertedUser);

    // Create Post for User
    console.log('\n--- Creating Post ---');
    await postModel.create({
        title: 'Hello World',
        content: 'This is my first post',
        userId: newUser.id,
    });
    console.log('Created Post for User');

    // 5. Querying
    // -----------

    // Find User with Posts (Relations)
    console.log('\n--- Find User with Posts ---');
    const userWithPosts = await userModel.findFirst(
        { email: 'john@example.com' },
        { include: { posts: true } }
    );
    console.log('User with Posts:', userWithPosts);

    // Find Many with Advanced Filtering
    console.log('\n--- Find Users > 25 years old ---');
    const olderUsers = await userModel.findMany({
        age: { gt: 25 }
    });
    console.log('Older Users:', olderUsers);

    console.log('\n--- Find Users between 20 and 30 ---');
    const youngAdults = await userModel.findMany({
        age: { gte: 20, lte: 30 }
    });
    console.log('Young Adults:', youngAdults);

    // Find with Pagination, Selection, and Sorting
    console.log('\n--- Find with Pagination, Selection, and Sorting ---');
    const pagedUsers = await userModel.findMany(
        { isActive: true },
        {
            select: { name: true, email: true, age: true },
            limit: 10,
            skip: 0,
            sortBy: 'age',
            sortOrder: 'desc'
        }
    );
    console.log('Paged Users (Sorted by Age desc):', pagedUsers);

    // 6. Updates and Deletes
    // ----------------------

    // Update User
    console.log('\n--- Updating User ---');
    const updatedUsers = await userModel.update(
        { email: 'john@example.com' },
        { isActive: false }
    );
    console.log('Updated User:', updatedUsers);

    // Soft Delete User
    console.log('\n--- Soft Deleting User ---');
    const deletedCount = await userModel.delete({ email: 'john@example.com' });
    console.log('Soft Deleted Count:', deletedCount);

    // Verify Soft Delete (Should not find it)
    const foundAfterDelete = await userModel.findFirst({ email: 'john@example.com' });
    console.log('Found after soft delete (should be null):', foundAfterDelete);

    // Find Including Deleted
    console.log('\n--- Find Including Deleted ---');
    const deletedUsers = await userModel.findMany(
        { email: 'john@example.com' },
        { includeDeleted: true }
    );
    console.log('Found deleted users:', deletedUsers);

    // Hard Delete (Cleanup)
    console.log('\n--- Hard Deleting User (Cleanup) ---');
    const hardDeletedCount = await userModel.delete(
        { email: 'john@example.com' },
        { force: true }
    );
    console.log('Hard Deleted Count:', hardDeletedCount);
}

main().catch(console.error);
