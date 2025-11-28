import { TarangClient, Model, Schema, DataTypes, Infer } from '../src';

// --- Schema ---

const ScoreSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    playerName: DataTypes.String,
    score: DataTypes.Number,
    level: DataTypes.Number,
    timestamp: DataTypes.Date,
});

type Score = Infer<typeof ScoreSchema>;

async function main() {
    console.log('🏆 Starting Sorting & Pagination Demo...\n');

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

    const scoreModel = new Model<Score>(client, {
        sheetName: 'Leaderboard',
        schema: ScoreSchema,
    });

    // Seed Data (Random Scores)
    console.log('🌱 Seeding Leaderboard...');
    const players = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy'];
    const scores = players.map(name => ({
        playerName: name,
        score: Math.floor(Math.random() * 10000),
        level: Math.floor(Math.random() * 10) + 1,
        timestamp: new Date()
    }));
    await scoreModel.createMany(scores);
    console.log(`   Added ${scores.length} scores.`);

    // 1. Basic Sorting (High Scores)
    console.log('\n🥇 Top 3 High Scores (Desc)');
    const topScores = await scoreModel.findMany({}, {
        sortBy: 'score',
        sortOrder: 'desc',
        limit: 3
    });
    topScores.forEach((s, i) => console.log(`   ${i + 1}. ${s.playerName}: ${s.score}`));

    // 2. Sorting Ascending
    console.log('\n👶 Lowest Levels (Asc)');
    const lowLevels = await scoreModel.findMany({}, {
        sortBy: 'level',
        sortOrder: 'asc',
        limit: 3
    });
    lowLevels.forEach(s => console.log(`   - ${s.playerName} (Level ${s.level})`));

    // 3. Pagination
    console.log('\n📄 Pagination (Page 2, 3 items per page)');
    const pageSize = 3;
    const page2 = await scoreModel.findMany({}, {
        sortBy: 'score',
        sortOrder: 'desc',
        limit: pageSize,
        skip: pageSize // Skip first page
    });

    console.log('   Page 2 Results:');
    page2.forEach((s, i) => console.log(`   ${i + 1 + pageSize}. ${s.playerName}: ${s.score}`));

    // 4. Sorting with Filtering
    console.log('\n🎯 Top Scores for Level 5+');
    const topHighLevel = await scoreModel.findMany(
        { level: { gte: 5 } },
        {
            sortBy: 'score',
            sortOrder: 'desc',
            limit: 3
        }
    );
    topHighLevel.forEach(s => console.log(`   - ${s.playerName}: ${s.score} (Lvl ${s.level})`));

    console.log('\n✅ Sorting Demo Complete!');
}

if (import.meta.main) {
    main().catch(console.error);
}
