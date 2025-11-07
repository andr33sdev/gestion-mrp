// backend/db.js
const { Pool } = require('pg');

// Render nos dará esta variable 'DATABASE_URL' automáticamente
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;