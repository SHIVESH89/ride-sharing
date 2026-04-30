const express = require('express');
const router = express.Router();
const { allSQL, getSQL, runSQL, transaction } = require('../database/db');

router.get('/', async (req, res) => {
    try {
        const passengers = await allSQL(`SELECT u.user_id, u.name, u.phone, u.trust_score
            FROM Passenger p JOIN User u ON p.user_id = u.user_id ORDER BY u.user_id`);
        res.json(passengers);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
    const { name, phone, trust_score } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
    try {
        const userId = await transaction(async ({ run }) => {
            const r = await run('INSERT INTO User (name, phone, trust_score) VALUES (?, ?, ?)', [name, phone, trust_score || 5]);
            await run('INSERT INTO Passenger (user_id) VALUES (?)', [r.lastInsertRowid]);
            return r.lastInsertRowid;
        });
        const passenger = await getSQL('SELECT u.* FROM User u JOIN Passenger p ON u.user_id = p.user_id WHERE u.user_id = ?', [userId]);
        req.app.get('broadcast')('passengerRegistered', passenger);
        res.status(201).json(passenger);
    } catch (err) {
        if (err.message.includes('Duplicate')) return res.status(409).json({ error: 'Phone number already exists' });
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id', async (req, res) => {
    const { name, phone } = req.body;
    try {
        const updates = [];
        const params = [];
        if (name) { updates.push('name = ?'); params.push(name); }
        if (phone) { updates.push('phone = ?'); params.push(phone); }
        if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
        params.push(+req.params.id);
        await runSQL(`UPDATE User SET ${updates.join(', ')} WHERE user_id = ?`, params);
        const passenger = await getSQL('SELECT u.* FROM User u JOIN Passenger p ON u.user_id = p.user_id WHERE u.user_id = ?', [+req.params.id]);
        res.json(passenger);
    } catch (err) {
        if (err.message.includes('Duplicate')) return res.status(409).json({ error: 'Phone number already exists' });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
