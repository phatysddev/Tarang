import { TarangClient, Model, Schema, DataTypes, Infer } from '../src';

// --- Schemas ---

const UserSchema = new Schema({
    id: { type: DataTypes.UUID, unique: true },
    username: { type: DataTypes.String, unique: true },
    email: { type: DataTypes.String, unique: true },
    createdAt: DataTypes.Date.createdAt(),
});

type User = Infer<typeof UserSchema>;

const ProfileSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    userId: { type: DataTypes.String, unique: true }, // Foreign Key to User.id
    bio: DataTypes.String,
    website: DataTypes.String,
    avatarUrl: DataTypes.String,
});

type Profile = Infer<typeof ProfileSchema>;

const PostSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true, unique: true },
    title: DataTypes.String,
    content: DataTypes.String,
    authorId: DataTypes.String, // Foreign Key to User.id
    likes: { type: DataTypes.Number, default: 0 },
    published: { type: DataTypes.Boolean, default: false },
    createdAt: DataTypes.Date.createdAt(),
});

type Post = Infer<typeof PostSchema>;

async function main() {
    console.log('📱 Starting Social App Demo...\n');

    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!spreadsheetId || !clientEmail || !privateKey) {
        console.error('❌ Error: Missing environment variables.');
        console.error('Please set GOOGLE_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY.');
        process.exit(1);
    }

    const client = new TarangClient({
        spreadsheetId,
        auth: {
            clientEmail,
            privateKey,
        },
    });

    // --- Models & Relations ---

    // 1. Initialize Models
    const userModel = new Model<User>(client, {
        sheetName: 'Social_Users',
        schema: UserSchema,
    });

    const profileModel = new Model<Profile>(client, {
        sheetName: 'Social_Profiles',
        schema: ProfileSchema,
    });

    const postModel = new Model<Post>(client, {
        sheetName: 'Social_Posts',
        schema: PostSchema,
    });

    // 2. Define Relations
    // Note: We define relations after initialization to handle circular references if needed,
    // or we could pass them in the constructor if we order them carefully.
    // Here we inject them into the internal config for clarity in this demo.

    // User Relations
    (userModel as any).relations = {
        posts: {
            type: 'hasMany',
            targetModel: postModel,
            foreignKey: 'authorId',
            localKey: 'id',
        },
        profile: {
            type: 'hasOne',
            targetModel: profileModel,
            foreignKey: 'userId',
            localKey: 'id',
        }
    };

    // Post Relations
    (postModel as any).relations = {
        author: {
            type: 'belongsTo',
            targetModel: userModel,
            foreignKey: 'id',     // Key on Target (User)
            localKey: 'authorId', // Key on Source (Post)
        }
    };

    // Profile Relations
    (profileModel as any).relations = {
        user: {
            type: 'belongsTo',
            targetModel: userModel,
            foreignKey: 'id',
            localKey: 'userId',
        }
    };

    // --- Scenario ---

    // 1. Sign up users
    console.log('👤 Signing up users...');
    const user1 = await userModel.create({
        username: 'tech_guru',
        email: 'guru@tech.com',
    });
    console.log(`   Created User: ${user1.username}`);

    // 2. Create Profile (hasOne)
    console.log('\n📝 Creating Profile...');
    await profileModel.create({
        userId: user1.id,
        bio: 'Lover of all things code.',
        website: 'https://tech.guru',
        avatarUrl: 'https://avatar.com/guru'
    });
    console.log('   Profile created.');

    // 3. Create Posts
    console.log('\n📝 Creating posts...');
    await postModel.createMany([
        { title: 'TarangDB is cool', content: 'Just tried it out!', authorId: user1.id, published: true, likes: 10 },
        { title: 'Draft Post', content: 'WIP', authorId: user1.id, published: false },
    ]);
    console.log('   Posts created.');

    // 4. Fetch User with Profile and Posts (hasOne + hasMany)
    console.log('\n🔍 Fetching tech_guru with Profile and Posts...');
    const fullUser = await userModel.findFirst(
        { username: 'tech_guru' },
        {
            include: {
                profile: true,
                posts: true
            }
        }
    );

    if (fullUser) {
        console.log(`   User: ${fullUser.username}`);
        const profile = (fullUser as any).profile;
        if (profile) {
            console.log(`   Bio: ${profile.bio} (Website: ${profile.website})`);
        }

        const posts = (fullUser as any).posts as Post[];
        console.log(`   Posts (${posts.length}):`);
        posts.forEach(p => {
            console.log(`     - ${p.title}`);
        });
    }

    // 5. Fetch Posts with Author (belongsTo)
    console.log('\n🔍 Fetching all posts with Author details...');
    const postsWithAuthor = await postModel.findMany(
        {},
        { include: { author: true } }
    );

    postsWithAuthor.forEach(p => {
        const author = (p as any).author;
        console.log(`   "${p.title}" by ${author ? author.username : 'Unknown'}`);
    });

    // 6. Fetch User with Nested Include (Profile only selecting bio)
    console.log('\n🔍 Fetching tech_guru with Profile (Bio only)...');
    const userWithBio = await userModel.findFirst(
        { username: 'tech_guru' },
        {
            include: {
                profile: {
                    select: { bio: true }
                }
            }
        }
    );

    if (userWithBio) {
        const profile = (userWithBio as any).profile;
        console.log(`   User: ${userWithBio.username}`);
        console.log(`   Bio: ${profile?.bio}`);
        console.log(`   Website: ${profile?.website} (Should be undefined)`);
    }

    console.log('\n✅ Social App Demo Complete!');
}

if (import.meta.main) {
    main().catch(console.error);
}
