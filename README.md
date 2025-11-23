# Tarang

A Google Sheets ORM for Node.js and Bun, inspired by Prisma.

## Features

- **Type-safe Schema**: Define your schema in TypeScript.
- **Easy Relationships**: Support for `hasOne` and `hasMany`.
- **Node & Bun Compatible**: Works seamlessly in both environments.
- **Simple API**: Familiar CRUD operations (`findMany`, `create`, `update`, `delete`).

## Installation

```bash
npm install tarang google-auth-library googleapis
# or
bun add tarang google-auth-library googleapis
```

## Usage

### 1. Setup Client

```typescript
import { TarangClient } from 'tarang';

const client = new TarangClient({
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  auth: {
    clientEmail: 'YOUR_SERVICE_ACCOUNT_EMAIL',
    privateKey: 'YOUR_PRIVATE_KEY',
  },
});
```

### 2. Define Schema & Model

```typescript
import { Model, Schema } from 'tarang';

const UserSchema: Schema = {
  id: { type: 'string', unique: true },
  name: { type: 'string' },
  email: { type: 'string' },
  age: { type: 'number' },
};

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

const userModel = new Model<User>(client, {
  sheetName: 'Users',
  schema: UserSchema,
});
```

### 3. Perform Operations

```typescript
// Create
await userModel.create({
  id: '1',
  name: 'Alice',
  email: 'alice@example.com',
  age: 25,
});

// Find
const users = await userModel.findMany({ age: 25 });

// Update
await userModel.update({ id: '1' }, { age: 26 });

// Delete
await userModel.delete({ id: '1' });
```

## Relationships

Use the `Relation` helper to handle relationships.

```typescript
import { Relation } from 'tarang';

// Assuming you have userModel and postModel
const posts = await Relation.hasMany(userModel, postModel, 'userId', 'id', user.id);
```

## License

MIT
