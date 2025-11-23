# TarangDB

A Google Sheets ORM for Node.js and Bun, inspired by Prisma.

## Features

- **Type-safe Schema**: Define your schema in TypeScript.
- **Easy Relationships**: Support for `hasOne` and `hasMany` with `include`.
- **Node & Bun Compatible**: Works seamlessly in both environments.
- **Simple API**: Familiar CRUD operations (`findMany`, `create`, `update`, `delete`).
- **Pagination & Selection**: Support for `limit`, `skip`, and `select`.

## Installation

```bash
npm install tarang-db google-auth-library googleapis
# or
bun add tarang-db google-auth-library googleapis
```

## Usage

### 1. Setup Client

```typescript
import { TarangClient } from 'tarang-db';

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
import { Model, Schema } from 'tarang-db';

const UserSchema: Schema = {
  id: { type: 'uuid', unique: true },
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
  name: 'Alice',
  email: 'alice@example.com',
  age: 25,
});

// Find
const users = await userModel.findMany({ age: 25 });

// Find with Select & Pagination
const selectedUsers = await userModel.findMany(
    { age: 25 },
    { 
        select: { name: true },
        limit: 10,
        skip: 0
    }
);

// Update
await userModel.update({ email: 'alice@example.com' }, { age: 26 });

// Delete
await userModel.delete({ email: 'alice@example.com' });
```

## Relationships

Define relationships in your model config:

```typescript
const userModel = new Model<User>(client, {
  sheetName: 'Users',
  schema: UserSchema,
  relations: {
    posts: {
      type: 'hasMany',
      targetModel: postModel,
      foreignKey: 'userId',
      localKey: 'id',
    },
  },
});

// Query with include
const usersWithPosts = await userModel.findMany(undefined, {
    include: { posts: true }
});
```

## License

MIT
