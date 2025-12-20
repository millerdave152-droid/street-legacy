import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pool from './connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function seed() {
  const seedPath = join(__dirname, 'seed.sql');
  const seedSql = readFileSync(seedPath, 'utf-8');

  try {
    await pool.query(seedSql);
    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
