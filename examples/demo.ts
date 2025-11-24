import { TarangClient, Model, Schema, DataTypes, Infer } from '../src';

// Example Schema
const UserSchema = new Schema({
    id: { type: DataTypes.UUID, unique: true }, // Auto-generated UUID
    cuid: { type: DataTypes.CUID, unique: true }, // Auto-generated CUID
    name: DataTypes.String, // Shorthand
    email: { type: DataTypes.String, unique: true },
    age: DataTypes.Number, // Shorthand
    birthDate: DataTypes.Date, // Plain Date field
    isActive: { type: DataTypes.Boolean, default: true },
    createdAt: DataTypes.Date.createdAt(),
    updatedAt: DataTypes.Date.updatedAt(),
    deletedAt: DataTypes.Date.deletedAt(),
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
    // You need a service account JSON and a spreadsheet ID
    const client = new TarangClient({
        spreadsheetId: 'YOUR_SPREADSHEET_ID',
        auth: {
            clientEmail: 'YOUR_SERVICE_ACCOUNT_EMAIL',
            privateKey: 'YOUR_PRIVATE_KEY',
        },
    });

    const postModel = new Model<Post>(client, {
        sheetName: 'Posts',
        schema: PostSchema,
    });

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

    // 1. Create User
    console.log('--- Creating User ---');
    const newUser = await userModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        birthDate: new Date('1995-05-15'),
    });
    console.log('Created User:', newUser);

    // 2. Create Post
    console.log('\n--- Creating Post ---');
    await postModel.create({
        title: 'Hello World',
        content: 'This is my first post',
        userId: newUser.id,
    });
    console.log('Created Post for User');

    // 3. Find User with Posts (Relations)
    console.log('\n--- Find User with Posts ---');
    const userWithPosts = await userModel.findFirst(
        { email: 'john@example.com' },
        { include: { posts: true } }
    );
    console.log('User with Posts:', userWithPosts);

    // 4. Find Many Users
    console.log('\n--- Find All Users ---');
    const allUsers = await userModel.findMany();
    console.log('All Users:', allUsers);

    // 5. Update User
    console.log('\n--- Updating User ---');
    const updatedUsers = await userModel.update(
        { email: 'john@example.com' },
        { age: 31, isActive: false }
    );
    console.log('Updated User:', updatedUsers);

    // 6. Find with Pagination, Selection, and Sorting
    console.log('\n--- Find with Pagination, Selection, and Sorting ---');
    const pagedUsers = await userModel.findMany(
        { isActive: false },
        {
            select: { name: true, email: true, age: true },
            limit: 10,
            skip: 0,
            sortBy: 'age',
            sortOrder: 'desc'
        }
    );
    console.log('Paged Users (Sorted by Age desc):', pagedUsers);

    // 7. Soft Delete User
    console.log('\n--- Soft Deleting User ---');
    const deletedCount = await userModel.delete({ email: 'john@example.com' });
    console.log('Soft Deleted Count:', deletedCount);

    // 8. Verify Soft Delete (Should not find it)
    const foundAfterDelete = await userModel.findFirst({ email: 'john@example.com' });
    console.log('Found after soft delete (should be null):', foundAfterDelete);

    // 9. Find Including Deleted
    console.log('\n--- Find Including Deleted ---');
    const deletedUsers = await userModel.findMany(
        { email: 'john@example.com' },
        { includeDeleted: true }
    );
    console.log('Found deleted users:', deletedUsers);

    // 10. Hard Delete (Cleanup)
    console.log('\n--- Hard Deleting User (Cleanup) ---');
    const hardDeletedCount = await userModel.delete(
        { email: 'john@example.com' },
        { force: true }
    );
    console.log('Hard Deleted Count:', hardDeletedCount);
}

main().catch(console.error);
