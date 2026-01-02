/**
 * Database connection and helper functions
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../analytics.db');

// Create database connection
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL'); // Better performance for concurrent reads

export default db;

// Helper to get current timestamp in SQLite format
export function now() {
    return new Date().toISOString();
}

// Helper to get date string (YYYY-MM-DD)
export function today() {
    return new Date().toISOString().split('T')[0];
}
