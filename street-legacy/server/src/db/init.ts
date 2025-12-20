import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pool from './connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function init() {
  const schemaPath = join(__dirname, 'schema.sql');
  const seedPath = join(__dirname, 'seed.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  const seed = readFileSync(seedPath, 'utf-8');

  try {
    // Run schema first (creates tables)
    console.log('Creating database schema...');
    await pool.query(schema);
    console.log('Database schema created successfully');

    // Then run seed data
    console.log('Seeding database...');
    await pool.query(seed);
    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
