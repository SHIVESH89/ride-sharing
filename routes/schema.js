const express = require('express');
const router = express.Router();
const { allSQL, getSQL } = require('../database/db');

// GET /api/schema/tables — list all tables in the ridesharing database
router.get('/tables', async (req, res) => {
    try {
        const tables = await allSQL(
            "SELECT TABLE_NAME as name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
        );
        res.json(tables.map(t => t.name));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/schema/tables/:name — get table columns + foreign keys
router.get('/tables/:name', async (req, res) => {
    const tableName = req.params.name;
    try {
        const columns = await allSQL(
            `SELECT COLUMN_NAME as name, COLUMN_TYPE as type,
                    IS_NULLABLE as nullable, COLUMN_KEY as \`key\`, COLUMN_DEFAULT as default_value
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
             ORDER BY ORDINAL_POSITION`, [tableName]
        );
        if (!columns.length) return res.status(404).json({ error: 'Table not found' });

        const fks = await allSQL(
            `SELECT kcu.COLUMN_NAME as \`from\`, kcu.REFERENCED_TABLE_NAME as \`table\`, kcu.REFERENCED_COLUMN_NAME as \`to\`
             FROM information_schema.KEY_COLUMN_USAGE kcu
             JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
               ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
             WHERE kcu.TABLE_SCHEMA = DATABASE() AND kcu.TABLE_NAME = ?`, [tableName]
        );

        res.json({
            name: tableName,
            columns: columns.map(c => ({ name: c.name, type: c.type, notnull: c.nullable === 'NO' ? 1 : 0, pk: c.key === 'PRI' ? 1 : 0, default_value: c.default_value })),
            foreign_keys: fks.map(f => ({ from: f.from, table: f.table, to: f.to }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/schema/tables/:name/data
router.get('/tables/:name/data', async (req, res) => {
    const tableName = req.params.name;
    try {
        const rows = await allSQL(`SELECT * FROM \`${tableName}\` LIMIT 500`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/schema/relationships — all foreign key relationships
router.get('/relationships', async (req, res) => {
    try {
        const relationships = await allSQL(
            `SELECT kcu.TABLE_NAME as from_table, kcu.COLUMN_NAME as from_column,
                    kcu.REFERENCED_TABLE_NAME as to_table, kcu.REFERENCED_COLUMN_NAME as to_column
             FROM information_schema.KEY_COLUMN_USAGE kcu
             JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
               ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
             WHERE kcu.TABLE_SCHEMA = DATABASE() AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`
        );
        res.json(relationships);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
