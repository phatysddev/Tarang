import { TarangClient, Model, Schema, DataTypes, Infer } from '../src';

// --- Schema ---

const ProductSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    name: DataTypes.String,
    category: DataTypes.String,
    price: DataTypes.Number,
    stock: DataTypes.Number,
    tags: DataTypes.String, // Comma separated tags
    isAvailable: DataTypes.Boolean,
});

type Product = Infer<typeof ProductSchema>;

async function main() {
    console.log('🛒 Starting Filter Demo...\n');

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

    const productModel = new Model<Product>(client, {
        sheetName: 'Products',
        schema: ProductSchema,
    });

    // Seed Data
    console.log('🌱 Seeding Products...');
    await productModel.createMany([
        { name: 'Laptop Pro', category: 'Electronics', price: 1200, stock: 50, tags: 'work,premium', isAvailable: true },
        { name: 'Smartphone X', category: 'Electronics', price: 800, stock: 0, tags: 'mobile,popular', isAvailable: false },
        { name: 'Coffee Maker', category: 'Home', price: 150, stock: 20, tags: 'kitchen,appliance', isAvailable: true },
        { name: 'Desk Chair', category: 'Furniture', price: 300, stock: 10, tags: 'office,comfort', isAvailable: true },
        { name: 'Gaming Mouse', category: 'Electronics', price: 50, stock: 100, tags: 'gaming,accessory', isAvailable: true },
    ]);

    // 1. Exact Match
    console.log('\n🔍 1. Exact Match (Category = Electronics)');
    const electronics = await productModel.findMany({ category: 'Electronics' });
    console.log(`   Found: ${electronics.map(p => p.name).join(', ')}`);

    // 2. Greater Than / Less Than
    console.log('\n🔍 2. Price Range (Price > 100 AND Price < 1000)');
    const midRange = await productModel.findMany({
        price: { gt: 100, lt: 1000 }
    });
    console.log(`   Found: ${midRange.map(p => `${p.name} ($${p.price})`).join(', ')}`);

    // 3. Not Equal
    console.log('\n🔍 3. Not Electronics (Category != Electronics)');
    const notElectronics = await productModel.findMany({
        category: { ne: 'Electronics' }
    });
    console.log(`   Found: ${notElectronics.map(p => p.name).join(', ')}`);

    // 4. LIKE (Case Sensitive)
    console.log('\n🔍 4. LIKE (Name starts with "Smart")');
    const smartProducts = await productModel.findMany({
        name: { like: 'Smart%' }
    });
    console.log(`   Found: ${smartProducts.map(p => p.name).join(', ')}`);

    // 5. ILIKE (Case Insensitive)
    console.log('\n🔍 5. ILIKE (Name contains "mouse")');
    const mouseProducts = await productModel.findMany({
        name: { ilike: '%mouse%' }
    });
    console.log(`   Found: ${mouseProducts.map(p => p.name).join(', ')}`);

    // 6. Complex Filter
    console.log('\n🔍 6. Available Electronics under $1000');
    const cheapElectronics = await productModel.findMany({
        category: 'Electronics',
        isAvailable: true,
        price: { lt: 1000 }
    });
    console.log(`   Found: ${cheapElectronics.map(p => `${p.name} ($${p.price})`).join(', ')}`);

    console.log('\n✅ Filter Demo Complete!');
}

if (import.meta.main) {
    main().catch(console.error);
}
