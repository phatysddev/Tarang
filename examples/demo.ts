import { TarangClient, Model, Schema, DataTypes, Infer } from '../src';

// 1. Define Schemas
// -----------------

// User Schema
const UserSchema = new Schema({
    id: { type: DataTypes.UUID, unique: true }, // Auto-generated UUID
    name: DataTypes.String,
    email: { type: DataTypes.String, unique: true },
    age: DataTypes.Number,
    role: { type: DataTypes.String, default: 'user' },
    isActive: { type: DataTypes.Boolean, default: true },
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
    userId: DataTypes.String, // Foreign Key (UUID from User)
    published: { type: DataTypes.Boolean, default: false },
    createdAt: DataTypes.Date.createdAt(),
    updatedAt: DataTypes.Date.updatedAt(),
});

type Post = Infer<typeof PostSchema>;

async function main() {
    console.log('🚀 Starting TarangDB Demo...\n');

    // 2. Initialize Client
    // --------------------
    const client = new TarangClient({
        spreadsheetId: 'YOUR_SPREADSHEET_ID', // Replace with actual ID for real run
        auth: {
            clientEmail: 'YOUR_SERVICE_ACCOUNT_EMAIL',
            privateKey: 'YOUR_PRIVATE_KEY',
        },
    });

    // 3. Initialize Models & Relations
    // --------------------------------

    // Post Model
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
    // We access the private `relations` property or re-instantiate if supported publicly.
    // For this demo, we'll assume the library supports adding relations dynamically or via constructor.
    // Since `relations` is defined in the constructor, we can't easily add it after without casting.
    // In a real app, you'd define models in an order or use a defineRelation method if available.
    // Here we will just use the User -> Post relation.

    // 4. CRUD Operations
    // ------------------

    // --- CREATE ---
    console.log('📝 Creating Users...');
    const alice = await userModel.create({
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'admin'
    });
    console.log('   Created:', alice.name);

    // Create Many
    console.log('\n📝 Creating Many Users...');
    const newUsers = await userModel.createMany([
        { name: 'Bob', email: 'bob@example.com', age: 30 },
        { name: 'Charlie', email: 'charlie@example.com', age: 35 },
    ]);
    console.log(`   Created ${newUsers.length} users.`);

    // --- UPSERT ---
    console.log('\n🔄 Upserting User (Update if exists, Create if not)...');
    const upsertedUser = await userModel.upsert({
        where: { email: 'alice@example.com' },
        update: { age: 26 }, // Alice just had a birthday
        create: { name: 'Alice', email: 'alice@example.com', age: 25 },
    });
    console.log(`   Upserted ${upsertedUser.name}, new age: ${upsertedUser.age}`);

    // --- RELATIONS ---
    console.log('\n🔗 Creating Posts for Alice...');
    await postModel.createMany([
        { title: 'Alice Post 1', content: 'Hello World', userId: alice.id, published: true },
        { title: 'Alice Post 2', content: 'Draft post', userId: alice.id, published: false },
    ]);
    console.log('   Created 2 posts.');

    // --- READ & FILTER ---
    console.log('\n🔍 Finding Users with Posts...');
    const userWithPosts = await userModel.findFirst(
        { email: 'alice@example.com' },
        { include: { posts: true } }
    );
    console.log(`   Found ${userWithPosts?.name} with ${(userWithPosts as any)?.posts?.length} posts.`);

    console.log('\n🔍 Advanced Filtering (Age > 28)...');
    const olderUsers = await userModel.findMany({
        age: { gt: 28 }
    });
    console.log('   Found:', olderUsers.map(u => `${u.name} (${u.age})`).join(', '));

    // --- UPDATE ---
    console.log('\n✏️  Updating Bob...');
    await userModel.update(
        { email: 'bob@example.com' },
        { isActive: false }
    );
    console.log('   Bob is now inactive.');

    // --- SOFT DELETE ---
    console.log('\n🗑️  Soft Deleting Charlie...');
    await userModel.delete({ email: 'charlie@example.com' });

    const charlieCheck = await userModel.findFirst({ email: 'charlie@example.com' });
    console.log(`   Searching for Charlie (default): ${charlieCheck ? 'Found' : 'Not Found'}`);

    const charlieDeleted = await userModel.findFirst(
        { email: 'charlie@example.com' },
        { includeDeleted: true }
    );
    console.log(`   Searching for Charlie (includeDeleted): ${charlieDeleted ? 'Found' : 'Not Found'}`);

    // --- HARD DELETE ---
    console.log('\n💥 Hard Deleting Inactive Users...');
    const deletedCount = await userModel.delete(
        { isActive: false },
        { force: true }
    );
    console.log(`   Hard deleted ${deletedCount} users.`);

    console.log('\n✅ Demo Complete!');
}

// Only run if this file is executed directly
if (import.meta.main) {
    main().catch(console.error);
}
