import { TarangClient, Model, Schema, DataTypes, Infer } from '../src';

// --- Schema ---

const EmployeeSchema = new Schema({
    id: { type: DataTypes.Number, autoIncrement: true },
    employeeId: { type: DataTypes.String, unique: true }, // e.g., EMP-001
    fullName: DataTypes.String,
    department: DataTypes.String,
    salary: DataTypes.Number,
    isActive: { type: DataTypes.Boolean, default: true },
    hiredAt: DataTypes.Date,
    updatedAt: DataTypes.Date.updatedAt(),
    deletedAt: DataTypes.Date.deletedAt(), // Soft delete
});

type Employee = Infer<typeof EmployeeSchema>;

async function main() {
    console.log('🏢 Starting Employee Management Demo...\n');

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

    const empModel = new Model<Employee>(client, {
        sheetName: 'Employees',
        schema: EmployeeSchema,
    });

    // 1. Batch Onboarding (CreateMany)
    console.log('🚀 Onboarding new batch of employees...');
    const newHires = await empModel.createMany([
        { employeeId: 'EMP-101', fullName: 'John Smith', department: 'Engineering', salary: 80000, hiredAt: new Date() },
        { employeeId: 'EMP-102', fullName: 'Sarah Jones', department: 'Design', salary: 75000, hiredAt: new Date() },
        { employeeId: 'EMP-103', fullName: 'Mike Brown', department: 'Marketing', salary: 70000, hiredAt: new Date() },
    ]);
    console.log(`   Onboarded ${newHires.length} employees.`);

    // 2. Annual Review (Upsert)
    // Scenario: We have a list of updates. Some might be new employees, some existing.
    console.log('\n📈 Processing Annual Reviews (Upsert)...');

    // Update existing
    const updatedEmp = await empModel.upsert({
        where: { employeeId: 'EMP-101' },
        update: { salary: 85000 }, // Raise for John
        create: { employeeId: 'EMP-101', fullName: 'John Smith', department: 'Engineering', salary: 80000, hiredAt: new Date() } // Fallback
    });
    console.log(`   Updated ${updatedEmp.fullName}'s salary to $${updatedEmp.salary}`);

    // Add new via upsert
    const newExec = await empModel.upsert({
        where: { employeeId: 'EMP-999' },
        update: { salary: 200000 },
        create: { employeeId: 'EMP-999', fullName: 'Alice CEO', department: 'Executive', salary: 200000, hiredAt: new Date() }
    });
    console.log(`   Upserted Executive: ${newExec.fullName}`);

    // 3. Offboarding (Soft Delete)
    console.log('\n👋 Offboarding Mike Brown...');
    await empModel.delete({ employeeId: 'EMP-103' });

    // Verify he is gone from default view
    const activeEmployees = await empModel.findMany();
    const mikeIsActive = activeEmployees.some(e => e.employeeId === 'EMP-103');
    console.log(`   Is Mike in active list? ${mikeIsActive ? 'Yes' : 'No'}`);

    // Check archives
    const allEmployees = await empModel.findMany({}, { includeDeleted: true });
    const mikeInArchive = allEmployees.find(e => e.employeeId === 'EMP-103');
    console.log(`   Is Mike in archive? ${mikeInArchive ? 'Yes' : 'No'} (Deleted At: ${mikeInArchive?.deletedAt})`);

    // 4. Department Audit (Aggregation/Filtering)
    console.log('\n📊 Engineering Department Audit...');
    const engineers = await empModel.findMany({ department: 'Engineering' });
    console.log(`   Found ${engineers.length} engineers.`);

    console.log('\n✅ Employee Demo Complete!');
}

if (import.meta.main) {
    main().catch(console.error);
}
