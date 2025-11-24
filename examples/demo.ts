import { TarangClient, Model, Schema, DataTypes } from '../src';

// Example Schema
const UserSchema = new Schema({
    id: { type: DataTypes.UUID, unique: true }, // Auto-generated UUID
    cuid: { type: DataTypes.CUID, unique: true }, // Auto-generated CUID
    name: DataTypes.String, // Shorthand
    email: { type: DataTypes.String, unique: true },
    age: DataTypes.Number, // Shorthand
    isActive: { type: DataTypes.Boolean, default: true },
});

interface User {
    id: string;
    cuid: string;
    name: string;
    email: string;
    age: number;
    isActive: boolean;
}

// Post Schema
const PostSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true, unique: true }, // Auto Increment ID
    title: DataTypes.String,
    content: DataTypes.String,
    userId: DataTypes.String, // Foreign Key
});

interface Post {
    id: number;
    title: string;
    content: string;
    userId: string;
}

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

    // Create User
    const newUser = await userModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
    });
    console.log('Created User:', newUser);

    // Create Post
    await postModel.create({
        title: 'Hello World',
        content: 'This is my first post',
        userId: newUser.id,
    });

    // Find User with Posts
    const userWithPosts = await userModel.findFirst(
        { email: 'john@example.com' },
        { include: { posts: true } }
    );
    console.log('User with Posts:', userWithPosts);

    // Find Many Users
    const allUsers = await userModel.findMany();
    console.log('All Users:', allUsers);

    // Update User
    const updatedUsers = await userModel.update(
        { email: 'john@example.com' },
        { age: 31, isActive: false }
    );
    console.log('Updated User:', updatedUsers);

    // Delete User
    // const deletedCount = await userModel.delete({ email: 'john@example.com' });
    // console.log('Deleted Users Count:', deletedCount);

    // Find Many Users with Select
    const selectedUsers = await userModel.findMany(undefined, {
        select: { name: true, email: true },
        limit: 2,
        skip: 0
    });
    console.log('Selected Users (Name & Email only, Limit 2):', selectedUsers);
}

// main().catch(console.error);
