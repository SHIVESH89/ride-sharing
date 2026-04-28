const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Run INSERT/UPDATE/DELETE
async function runSQL(sql, params = []) {
  const result = await pool.query(sql, params);
  return {
    changes: result.rowCount,
    lastInsertRowid: result.rows?.[0]?.id || null
  };
}

// Get all rows
async function allSQL(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// Get single row
async function getSQL(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

// Transaction support
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  runSQL,
  allSQL,
  getSQL,
  transaction
};
