# TarangDB

A lightweight, type-safe Google Sheets ORM for Node.js and Bun, inspired by Prisma.

Turn your Google Sheets into a database with a simple, familiar API.

## Features

- **Type-safe Schema**: Define your schema in TypeScript with support for `string`, `number`, `boolean`, `json`, `uuid`, `cuid`, and `date`.
- **Schema Inference**: Automatically generate TypeScript interfaces from your schema definitions.
- **Auto-generation**: Built-in support for generating UUIDs, CUIDs, and Auto-incrementing numbers.
- **Timestamps**: Automatic `createdAt`, `updatedAt`, and soft delete support with `deletedAt`.
- **Relationships**: Define `hasOne`, `hasMany`, and `belongsTo` relationships.
- **Eager Loading**: Fetch related data easily with `include`.
- **Advanced Querying**: Support for filtering, `select`, `limit`, `skip`, `sortBy`, and `sortOrder`.
- **Formula Support**: Pass Google Sheets formulas to any field for calculated columns.
- **Cross-Platform**: Works seamlessly in Node.js and Bun.

## Installation

```bash
npm install tarang-db
# or
bun add tarang-db
```

## Prerequisites

1.  **Google Cloud Project**: Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2.  **Enable Sheets API**: Enable the Google Sheets API for your project.
3.  **Service Account**: Create a service account and download the JSON key file.
4.  **Share Sheet**: Share your Google Sheet with the service account email address (e.g., `tarang-db@your-project.iam.gserviceaccount.com`) with **Editor** access.

## Quick Start

### 1. Initialize Client

```typescript
import { TarangClient } from 'tarang-db';

const client = new TarangClient({
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  auth: {
    clientEmail: 'YOUR_SERVICE_ACCOUNT_EMAIL',
    privateKey: 'YOUR_PRIVATE_KEY', // from service account JSON
  },
  cacheTTL: 60000, // Optional: Cache read results for 60 seconds (default)
  maxCacheSize: 100, // Optional: Max number of entries in cache (default 100)
});
```

### Optimization & Caching

TarangDB includes a built-in in-memory cache to reduce Google Sheets API quota usage.

- **Read Operations**: `findMany`, `findFirst`, and internal lookups are cached.
- **Write Operations**: `create`, `update`, `delete` automatically invalidate the cache for the **specific sheet** being modified.
- **Configuration**:
  - `cacheTTL`: Time to live in milliseconds (default: 60000). Set to `0` to disable.
  - `maxCacheSize`: Maximum number of cache entries (default: 100). Oldest entries are evicted when limit is reached.

### 2. Define Schema & Model

```typescript
import { Model, Schema, DataTypes, Infer } from 'tarang-db';

// Define Schema
const UserSchema = new Schema({
  id: { type: DataTypes.UUID, unique: true }, // Auto-generated UUID
  name: DataTypes.String, // Shorthand
  email: { type: DataTypes.String, unique: true },
  age: DataTypes.Number, // Shorthand
  birthDate: DataTypes.Date, // Plain Date field
  isActive: { type: DataTypes.Boolean, default: true },
  metadata: DataTypes.JSON,
  createdAt: DataTypes.Date.createdAt(),
  updatedAt: DataTypes.Date.updatedAt(),
  deletedAt: DataTypes.Date.deletedAt(), // Enables soft delete
});

// Infer TypeScript Interface
type User = Infer<typeof UserSchema>;

// Initialize Model
const userModel = new Model<User>(client, {
  sheetName: 'Users', // Name of the tab in Google Sheets
  schema: UserSchema,
});
```

## Schema Definition

TarangDB uses a schema definition object where keys are column names and values are column definitions.

### Data Types

| Type | Description |
|------|-------------|
| `DataTypes.String` | Text string |
| `DataTypes.Number` | Numeric value |
| `DataTypes.Boolean` | Boolean value (true/false) |
| `DataTypes.Date` | Date object (stored as ISO string) |
| `DataTypes.JSON` | JSON object (stored as stringified JSON) |
| `DataTypes.UUID` | UUID v4 string |
| `DataTypes.CUID` | CUID string |

### Modifiers

| Modifier | Description |
|----------|-------------|
| `unique` | Ensures values in the column are unique. |
| `default` | Sets a default value if none is provided. |
| `autoIncrement` | (Number only) Auto-increments the value. |
| `createdAt()` | (Date only) Sets current date on creation. |
| `updatedAt()` | (Date only) Updates date on modification. |
| `deletedAt()` | (Date only) Used for soft deletes. |

## CRUD Operations

### Create

```typescript
const user = await userModel.create({
  name: 'Alice',
  email: 'alice@example.com',
  age: 25,
});
```

### Create Many

Batch create multiple records.

```typescript
const users = await userModel.createMany([
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' },
]);
```

### Read (Find Many)

```typescript
// Find all
const allUsers = await userModel.findMany();

// Filter
const adults = await userModel.findMany({ age: { gte: 18 } });

// Pagination & Sorting
const pagedUsers = await userModel.findMany(
  { isActive: true },
  { 
    limit: 10, 
    skip: 0, 
    sortBy: 'createdAt', 
    sortOrder: 'desc' 
  }
);

// Select specific fields
const namesOnly = await userModel.findMany({}, { select: { name: true } });
```

### Read (Find First)

```typescript
const user = await userModel.findFirst({ email: 'alice@example.com' });
```

### Update

```typescript
// Update by filter
const updated = await userModel.update(
  { email: 'alice@example.com' },
  { age: 26 }
);
```

### Upsert

Create if not exists, otherwise update.

```typescript
const user = await userModel.upsert({
  where: { email: 'alice@example.com' },
  update: { age: 26 },
  create: { 
    name: 'Alice', 
    email: 'alice@example.com', 
    age: 26 
  },
});
```

### Delete

```typescript
// Soft delete (if deletedAt is defined in schema)
await userModel.delete({ email: 'alice@example.com' });

// Hard delete (permanently remove row)
await userModel.delete({ email: 'alice@example.com' }, { force: true });
```

## Advanced Filtering

TarangDB supports the following operators:

- `gt`: Greater than
- `lt`: Less than
- `gte`: Greater than or equal
- `lte`: Less than or equal
- `ne`: Not equal
- `like`: String matching (case-sensitive, supports `%` and `_`)
- `ilike`: String matching (case-insensitive, supports `%` and `_`)

```typescript
// Users between 20 and 30
const users = await userModel.findMany({
  age: { gte: 20, lte: 30 }
});

// Users starting with 'A'
const aUsers = await userModel.findMany({
  name: { like: 'A%' }
});

// Users containing 'john' (case-insensitive)
const johns = await userModel.findMany({
  name: { ilike: '%john%' }
});
```

## Relationships

Define relationships in the `Model` configuration.

### Types

- **hasOne**: One-to-one relationship.
- **hasMany**: One-to-many relationship.
- **belongsTo**: Inverse of hasOne or hasMany.

### Example

```typescript
// ... Schema definitions for User and Post ...

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

const postModel = new Model<Post>(client, {
  sheetName: 'Posts',
  schema: PostSchema,
  relations: {
    author: {
      type: 'belongsTo',
      targetModel: userModel,
      foreignKey: 'userId',
      localKey: 'id',
    },
  },
});

// Query with relations
const userWithPosts = await userModel.findFirst(
  { email: 'alice@example.com' }, 
  { 
    include: { 
      posts: true,
      // Nested include with select
      profile: {
        select: { bio: true }
      }
    } 
  }
);
```

## Advanced Operations

### Create Many

Batch create multiple records efficiently.

```typescript
const users = await userModel.createMany([
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' },
]);
```

### Upsert

Create a record if it doesn't exist, or update it if it does.

```typescript
const user = await userModel.upsert({
  where: { email: 'alice@example.com' },
  update: { age: 27 },
  create: { 
    name: 'Alice', 
    email: 'alice@example.com', 
    age: 26 
  },
});
```

### Soft Delete

If your schema includes a `deletedAt` field using `DataTypes.Date.deletedAt()`, the `delete` method will perform a soft delete by default.

```typescript
// Soft delete (sets deletedAt timestamp)
await userModel.delete({ email: 'alice@example.com' });

// Hard delete (permanently removes the row)
await userModel.delete({ email: 'alice@example.com' }, { force: true });

// Include soft-deleted records in queries
const allUsersIncludingDeleted = await userModel.findMany(
  {}, 
  { includeDeleted: true }
);
```

## Formula Support

You can pass Google Sheets formulas to any field. This is useful for calculated columns.

```typescript
await productModel.create({
  name: 'iPhone',
  price: 30000,
  qty: 2,
  // Formula to calculate total: price * qty
  total: '=INDIRECT("R[0]C[-2]", FALSE) * INDIRECT("R[0]C[-1]", FALSE)' 
});
```



## License

MIT