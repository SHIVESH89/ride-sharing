const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// ─── MySQL Connection Config ───────────────────────────────────────────────────
// Edit these values to match your MySQL server credentials
const DB_CONFIG = {
    host: 'localhost',
    port: 3306,
    user: 'root',       // ← change if needed
    password: 'abcd',       // ← change to your MySQL root password
    database: 'ridesharing',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true
};

let pool = null;

async function initDB() {
    // 1. Create a temp connection (no DB selected) to create the database if needed
    const tempConn = await mysql.createConnection({
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password,
        multipleStatements: true
    });

    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await tempConn.end();

    // 2. Create the connection pool targeting the DB
    pool = mysql.createPool(DB_CONFIG);

    // 3. Run schema (CREATE TABLE IF NOT EXISTS + seeds)
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    const conn = await pool.getConnection();
    try {
        await conn.query(schema);
    } finally {
        conn.release();
    }

    console.log('✅ MySQL Database initialized successfully');
    return pool;
}

function getPool() {
    return pool;
}

// ─── Helper: run INSERT / UPDATE / DELETE ─────────────────────────────────────
// Returns { changes, lastInsertRowid } to stay compatible with old sync API shape
async function runSQL(sql, params = []) {
    const conn = await pool.getConnection();
    try {
        const [result] = await conn.execute(sql, params);
        return {
            changes: result.affectedRows,
            lastInsertRowid: result.insertId
        };
    } finally {
        conn.release();
    }
}

// ─── Helper: get all rows ─────────────────────────────────────────────────────
async function allSQL(sql, params = []) {
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.execute(sql, params);
        return rows;
    } finally {
        conn.release();
    }
}

// ─── Helper: get one row ──────────────────────────────────────────────────────
async function getSQL(sql, params = []) {
    const rows = await allSQL(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

// ─── Helper: run multiple statements in a transaction ─────────────────────────
// fn must be an async function that receives the connection
async function transaction(fn) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        // Provide thin wrappers so fn() can call run/get/all on the same connection
        const txRun = async (sql, params = []) => {
            const [result] = await conn.execute(sql, params);
            return { changes: result.affectedRows, lastInsertRowid: result.insertId };
        };
        const txAll = async (sql, params = []) => {
            const [rows] = await conn.execute(sql, params);
            return rows;
        };
        const txGet = async (sql, params = []) => {
            const rows = await txAll(sql, params);
            return rows.length > 0 ? rows[0] : null;
        };

        const result = await fn({ run: txRun, all: txAll, get: txGet });
        await conn.commit();
        return result;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = { initDB, getPool, runSQL, allSQL, getSQL, transaction };
