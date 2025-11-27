import { TarangClient, Model, Schema, DataTypes, Infer } from '../src';

// --- Schema ---

const InvoiceItemSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    description: DataTypes.String,
    quantity: DataTypes.Number,
    unitPrice: DataTypes.Number,
    // Formula field: We define it as a Number because the result will be a number
    total: DataTypes.Number,
});

type InvoiceItem = Infer<typeof InvoiceItemSchema>;

async function main() {
    console.log('🧮 Starting Formula Demo...\n');

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

    const invoiceModel = new Model<InvoiceItem>(client, {
        sheetName: 'Invoice',
        schema: InvoiceItemSchema,
    });

    // 1. Create items with formulas
    console.log('📝 Creating invoice items with formulas...');

    // Note: We insert the formula string into the 'total' field.
    // TarangDB allows string injection for any field type to support formulas.
    // In Google Sheets, if a cell starts with '=', it's treated as a formula.
    // We assume columns are: A=id, B=description, C=quantity, D=unitPrice, E=total
    // So for row 2, total = C2 * D2

    // However, since we don't know the exact row number beforehand in a real concurrent app,
    // we might need to use INDIRECT or R[0]C[-2] style if supported, or just simple A1 notation 
    // if we are appending and know the logic.
    // 
    // A more robust way in Sheets is using ARRAYFORMULA in the header, but here we demonstrate
    // per-row formulas.
    //
    // Let's assume we are appending and we can use INDIRECT with ROW() to be safe, 
    // or just use the fact that we are inserting specific values.
    //
    // Actually, a common pattern is: =INDIRECT("C" & ROW()) * INDIRECT("D" & ROW())

    const formula = '=INDIRECT("C" & ROW()) * INDIRECT("D" & ROW())';

    await invoiceModel.createMany([
        { description: 'Widget A', quantity: 5, unitPrice: 10, total: formula },
        { description: 'Widget B', quantity: 2, unitPrice: 25, total: formula },
        { description: 'Service Fee', quantity: 1, unitPrice: 100, total: formula },
    ]);
    console.log('   Items created.');

    // 2. Read back values
    // When we read back, Google Sheets API (valueRenderOption='FORMATTED_VALUE' by default)
    // returns the calculated result, not the formula.
    console.log('\n🔍 Reading back calculated values...');
    const items = await invoiceModel.findMany();

    items.forEach(item => {
        console.log(`   - ${item.description}: ${item.quantity} x $${item.unitPrice} = $${item.total}`);
    });

    // 3. Verify calculation
    const grandTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    console.log(`\n💰 Grand Total: $${grandTotal}`);

    console.log('\n✅ Formula Demo Complete!');
}

if (import.meta.main) {
    main().catch(console.error);
}
