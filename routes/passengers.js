const express = require('express');
const router = express.Router();
const { allSQL, getSQL, runSQL, transaction } = require('../database/db');

router.get('/', (req, res) => {
    try {
        const passengers = allSQL(`SELECT u.user_id, u.name, u.phone, u.trust_score
            FROM Passenger p JOIN User u ON p.user_id = u.user_id ORDER BY u.user_id`);
        res.json(passengers);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
    const { name, phone, trust_score } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
    try {
        const userId = transaction(() => {
            const r = runSQL('INSERT INTO User (name, phone, trust_score) VALUES (?, ?, ?)', [name, phone, trust_score || 5]);
            runSQL('INSERT INTO Passenger (user_id) VALUES (?)', [r.lastInsertRowid]);
            return r.lastInsertRowid;
        });
        const passenger = getSQL('SELECT u.* FROM User u JOIN Passenger p ON u.user_id = p.user_id WHERE u.user_id = ?', [userId]);
        req.app.get('broadcast')('passengerRegistered', passenger);
        res.status(201).json(passenger);
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Phone number already exists' });
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id', (req, res) => {
    const { name, phone } = req.body;
    try {
        const updates = [];
        const params = [];
        if (name) { updates.push('name = ?'); params.push(name); }
        if (phone) { updates.push('phone = ?'); params.push(phone); }
        if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
        params.push(+req.params.id);
        runSQL(`UPDATE User SET ${updates.join(', ')} WHERE user_id = ?`, params);
        const passenger = getSQL('SELECT u.* FROM User u JOIN Passenger p ON u.user_id = p.user_id WHERE u.user_id = ?', [+req.params.id]);
        res.json(passenger);
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Phone number already exists' });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
