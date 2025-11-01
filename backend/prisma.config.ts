import { defineConfig, env } from 'prisma/config';
import { config } from 'dotenv';
import path from 'path';

// Load .env file
config();

// Determine which schema to use based on CLI args
const schemaArg = process.argv.find((arg) => arg.includes('--schema='));

let schemaPath = path.resolve('prisma/postgres/schema.prisma'); // Default to Postgres
let migrationsPath = path.resolve('prisma/postgres/migrations');
let datasourceUrl = env('DATABASE_URL');

if (schemaArg) {
  if (schemaArg.includes('mongodb')) {
    schemaPath = path.resolve('prisma/mongodb/schema.prisma');
    migrationsPath = path.resolve('prisma/mongodb/migrations');
    datasourceUrl = env('MONGODB_URL');
  } else if (schemaArg.includes('postgres')) {
    schemaPath = path.resolve('prisma/postgres/schema.prisma');
    migrationsPath = path.resolve('prisma/postgres/migrations');
    datasourceUrl = env('DATABASE_URL');
  }
}

export default defineConfig({
  schema: schemaPath,
  migrations: {
    path: migrationsPath,
  },
  engine: 'classic',
  datasource: {
    url: datasourceUrl,
  },
});
