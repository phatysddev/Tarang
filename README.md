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
- **Cross-Platform**: Works seamlessly in Node.js and Bun.

## Installation

```bash
npm install tarang-db google-auth-library googleapis
# or
bun add tarang-db google-auth-library googleapis
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
});
```

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

/*
Equivalent to:
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  birthDate: Date;
  isActive: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
*/

// Initialize Model
const userModel = new Model<User>(client, {
  sheetName: 'Users', // Name of the tab in Google Sheets
  schema: UserSchema,
});
```

### 3. CRUD Operations

#### Create
```typescript
const newUser = await userModel.create({
  name: 'Alice',
  email: 'alice@example.com',
  age: 25,
  birthDate: new Date('1998-01-01'),
  metadata: { role: 'admin' },
});
```

#### Find Many
```typescript
// Find all users aged 25
const users = await userModel.findMany({ age: 25 });

// Find with Pagination, Selection, and Sorting
const pagedUsers = await userModel.findMany(
  { isActive: true },
  { 
    select: { name: true, email: true },
    limit: 10,
    skip: 0,
    sortBy: 'age',
    sortOrder: 'desc'
  }
);

// Find including soft-deleted records
const allUsers = await userModel.findMany(undefined, { includeDeleted: true });
```

#### Find First
```typescript
const user = await userModel.findFirst({ email: 'alice@example.com' });
```

#### Update
```typescript
// Update all users named 'Alice'
// updatedAt will be automatically set
const updatedUsers = await userModel.update(
  { name: 'Alice' }, 
  { age: 26 }
);
```

#### Delete
```typescript
// Soft delete (sets deletedAt)
const deletedCount = await userModel.delete({ email: 'alice@example.com' });

// Hard delete (removes row)
const hardDeletedCount = await userModel.delete(
  { email: 'alice@example.com' }, 
  { force: true }
);
```

## Relationships

TarangDB supports defining relationships between models.

### Defining Relationships

```typescript
// Post Schema with Auto Increment ID
const PostSchema = new Schema({
  id: { type: DataTypes.Number, autoIncrement: true, unique: true },
  title: DataTypes.String,
  content: DataTypes.String,
  userId: DataTypes.String,
  createdAt: DataTypes.Date.createdAt(),
  updatedAt: DataTypes.Date.updatedAt(),
});

type Post = Infer<typeof PostSchema>;

// Post Model
const postModel = new Model<Post>(client, {
  sheetName: 'Posts',
  schema: PostSchema,
});

// User Model with Relations
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
```

### Querying with Relations

Use the `include` option to fetch related data.

```typescript
const userWithPosts = await userModel.findFirst(
  { email: 'alice@example.com' },
  { include: { posts: true } }
);

console.log(userWithPosts.posts); // Array of Post objects
```

## API Reference

### `DataTypes`
Use `DataTypes` to define your schema.

- `DataTypes.String`
- `DataTypes.Number`
- `DataTypes.Boolean`
- `DataTypes.JSON`
- `DataTypes.UUID`
- `DataTypes.CUID`
- `DataTypes.Date`

**Methods:**
- `DataTypes.Number.autoIncrement()`: Creates an auto-incrementing number column.
- `DataTypes.Date.createdAt()`: Automatically sets the current date when creating a record.
- `DataTypes.Date.updatedAt()`: Automatically updates the date when updating a record.
- `DataTypes.Date.deletedAt()`: Enables soft delete. When `delete()` is called, this field is set instead of removing the record.

### `Schema` Configuration
| Property | Type | Description |
|----------|------|-------------|
| `type` | `DataType` | Data type of the column. |
| `unique` | `boolean` | (Optional) Whether values must be unique. |
| `default` | `any` | (Optional) Default value if not provided. |
| `autoIncrement` | `boolean` | (Optional) Set to true for auto-incrementing numbers. |

### `Model` Methods

- **`findMany(filter?, options?)`**: Returns an array of records.
  - `options`: `{ include?, select?, limit?, skip?, sortBy?, sortOrder?, includeDeleted? }`
- **`findFirst(filter, options?)`**: Returns the first matching record or `null`.
- **`create(data)`**: Creates a new record. Auto-generates `uuid` and `cuid`. Populates `createdAt`.
- **`update(filter, data)`**: Updates matching records. Returns updated records. Updates `updatedAt`.
- **`delete(filter, options?)`**: Deletes matching records. Returns count of deleted records.
  - `options`: `{ force? }` - If true, performs hard delete. Otherwise, performs soft delete if `deletedAt` is configured.

## License

MIT

Turn your Google Sheets into a database with a simple, familiar API.

## Features

- **Type-safe Schema**: Define your schema in TypeScript with support for `string`, `number`, `boolean`, `json`, `uuid`, and `cuid`.
- **Auto-generation**: Built-in support for generating UUIDs and CUIDs.
- **Relationships**: Define `hasOne`, `hasMany`, and `belongsTo` relationships.
- **Eager Loading**: Fetch related data easily with `include`.
- **Advanced Querying**: Support for filtering, `select`, `limit`, and `skip`.
- **Cross-Platform**: Works seamlessly in Node.js and Bun.

## Installation

```bash
npm install tarang-db google-auth-library googleapis
# or
bun add tarang-db google-auth-library googleapis
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
});
```

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
 
// Define TypeScript Interface
type User = Infer<typeof UserSchema>;

/*
Equivalent to:
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  birthDate: Date;
  isActive: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
*/
 
// Initialize Model
const userModel = new Model<User>(client, {
  sheetName: 'Users', // Name of the tab in Google Sheets
  schema: UserSchema,
});
```
 
### 3. CRUD Operations
 
#### Create
```typescript
const newUser = await userModel.create({
  name: 'Alice',
  email: 'alice@example.com',
  age: 25,
  metadata: { role: 'admin' },
});
```
 
#### Find Many
```typescript
// Find all users aged 25
const users = await userModel.findMany({ age: 25 });
 
// Find with Pagination, Selection, and Sorting
const pagedUsers = await userModel.findMany(
  { isActive: true },
  { 
    select: { name: true, email: true },
    limit: 10,
    skip: 0,
    sortBy: 'age',
    sortOrder: 'desc'
  }
);
```
 
#### Find First
```typescript
const user = await userModel.findFirst({ email: 'alice@example.com' });
```
 
#### Update
```typescript
// Update all users named 'Alice'
const updatedUsers = await userModel.update(
  { name: 'Alice' }, 
  { age: 26 }
);
```
 
#### Delete
```typescript
// Delete user with specific email
const deletedCount = await userModel.delete({ email: 'alice@example.com' });
```
 
## Relationships
 
TarangDB supports defining relationships between models.
 
### Defining Relationships
 
```typescript
// Post Schema with Auto Increment ID
const PostSchema = new Schema({
  id: { type: DataTypes.Number, autoIncrement: true, unique: true },
  title: DataTypes.String,
  content: DataTypes.String,
  userId: DataTypes.String,
});
 
// Post Model
const postModel = new Model<Post>(client, {
  sheetName: 'Posts',
  schema: PostSchema,
});
 
// User Model with Relations
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
```

### Querying with Relations

Use the `include` option to fetch related data.

```typescript
const userWithPosts = await userModel.findFirst(
  { email: 'alice@example.com' },
  { include: { posts: true } }
);

console.log(userWithPosts.posts); // Array of Post objects
```

## API Reference

### `DataTypes`
Use `DataTypes` to define your schema.

- `DataTypes.String`
- `DataTypes.Number`
- `DataTypes.Boolean`
- `DataTypes.JSON`
- `DataTypes.UUID`
- `DataTypes.CUID`
- `DataTypes.Date`

**Methods:**
- `DataTypes.Number.autoIncrement()`: Creates an auto-incrementing number column.
- `DataTypes.Date.createdAt()`: Automatically sets the current date when creating a record.
- `DataTypes.Date.updatedAt()`: Automatically updates the date when updating a record.
- `DataTypes.Date.deletedAt()`: Enables soft delete. When `delete()` is called, this field is set instead of removing the record.

### `Schema` Configuration
| Property | Type | Description |
|----------|------|-------------|
| `type` | `DataType` | Data type of the column. |
| `unique` | `boolean` | (Optional) Whether values must be unique. |
| `default` | `any` | (Optional) Default value if not provided. |
| `autoIncrement` | `boolean` | (Optional) Set to true for auto-incrementing numbers. |

### `Model` Methods

- **`findMany(filter?, options?)`**: Returns an array of records.
  - `options`: `{ include?, select?, limit?, skip?, sortBy?, sortOrder? }`
- **`findFirst(filter, options?)`**: Returns the first matching record or `null`.
- **`create(data)`**: Creates a new record. Auto-generates `uuid` and `cuid`.
- **`update(filter, data)`**: Updates matching records. Returns updated records.
- **`delete(filter)`**: Deletes matching records. Returns count of deleted records.

## License

MIT
