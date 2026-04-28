const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'ridesharing.db');
let db = null;
let inTransaction = false;

async function initDB() {
    const SQL = await initSqlJs();

    // Load existing DB or create new
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON;');

    // Initialize schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    // Execute each statement separately for sql.js compatibility
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
        try { db.run(stmt + ';'); } catch (e) { /* ignore duplicate inserts */ }
    }

    // Save to disk
    saveDB();
    console.log('✅ Database initialized successfully');
    return db;
}

function saveDB() {
    if (db && !inTransaction) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

function getDB() {
    return db;
}

// Helper: run a query that modifies data, returns { changes, lastInsertRowid }
function runSQL(sql, params = []) {
    db.run(sql, params);
    const changes = db.getRowsModified();
    const lastId = db.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = lastId.length > 0 ? lastId[0].values[0][0] : 0;
    if (!inTransaction) saveDB();
    return { changes, lastInsertRowid };
}

// Helper: get all rows
function allSQL(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

// Helper: get one row
function getSQL(sql, params = []) {
    const rows = allSQL(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

// Helper: run multiple statements in transaction
function transaction(fn) {
    inTransaction = true;
    db.run('BEGIN TRANSACTION;');
    try {
        const result = fn();
        db.run('COMMIT;');
        inTransaction = false;
        saveDB();
        return result;
    } catch (err) {
        try { db.run('ROLLBACK;'); } catch (e) { /* already rolled back */ }
        inTransaction = false;
        throw err;
    }
}

module.exports = { initDB, getDB, runSQL, allSQL, getSQL, transaction, saveDB };
