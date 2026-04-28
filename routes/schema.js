const express = require('express');
const router = express.Router();
const { allSQL, getSQL, runSQL } = require('../database/db');

// GET /api/schema/tables — list all tables
router.get('/tables', (req, res) => {
    try {
        const tables = allSQL("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        res.json(tables.map(t => t.name));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/schema/tables/:name — get table info (columns + foreign keys)
router.get('/tables/:name', (req, res) => {
    const tableName = req.params.name;
    try {
        const columns = allSQL(`PRAGMA table_info("${tableName}")`);
        const fks = allSQL(`PRAGMA foreign_key_list("${tableName}")`);
        if (!columns.length) return res.status(404).json({ error: 'Table not found' });
        res.json({
            name: tableName,
            columns: columns.map(c => ({ name: c.name, type: c.type, notnull: c.notnull, pk: c.pk, default_value: c.dflt_value })),
            foreign_keys: fks.map(f => ({ from: f.from, table: f.table, to: f.to }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/schema/tables/:name/data — get all rows from a table
router.get('/tables/:name/data', (req, res) => {
    const tableName = req.params.name;
    try {
        const rows = allSQL(`SELECT * FROM "${tableName}" LIMIT 500`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/schema/relationships — get all foreign key relationships
router.get('/relationships', (req, res) => {
    try {
        const tables = allSQL("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        const relationships = [];
        for (const t of tables) {
            const fks = allSQL(`PRAGMA foreign_key_list("${t.name}")`);
            for (const fk of fks) {
                relationships.push({ from_table: t.name, from_column: fk.from, to_table: fk.table, to_column: fk.to });
            }
        }
        res.json(relationships);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
