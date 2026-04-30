const express = require('express');
const router = express.Router();
const { allSQL, getSQL, runSQL, transaction } = require('../database/db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    if (name.toLowerCase() === 'admin' && phone === 'admin123') {
        return res.json({ user_id: 0, name: 'Admin', role: 'admin' });
    }

    try {
        const user = await getSQL('SELECT * FROM User WHERE name = ? AND phone = ?', [name.trim(), phone.trim()]);
        if (!user) return res.status(401).json({ error: 'No account found with that name and phone number' });

        const isPassenger = await getSQL('SELECT user_id FROM Passenger WHERE user_id = ?', [user.user_id]);
        const isDriver = await getSQL(`SELECT d.*, v.vehicle_type, v.registration_no FROM Driver d
            LEFT JOIN Vehicle v ON v.driver_user_id = d.user_id WHERE d.user_id = ?`, [user.user_id]);

        let role = 'user';
        if (isPassenger && isDriver) role = 'both';
        else if (isPassenger) role = 'passenger';
        else if (isDriver) role = 'driver';

        const result = { user_id: user.user_id, name: user.name, phone: user.phone, trust_score: user.trust_score, role };
        if (isDriver) {
            result.license_no = isDriver.license_no;
            result.status = isDriver.status;
            result.rating = isDriver.rating;
            result.vehicle_type = isDriver.vehicle_type;
            result.registration_no = isDriver.registration_no;
        }
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, phone, role, license_no, vehicle_type, registration_no } = req.body;
    if (!name || !phone || !role) return res.status(400).json({ error: 'Name, phone, and role are required' });
    if (role === 'driver' && (!license_no || !vehicle_type || !registration_no)) {
        return res.status(400).json({ error: 'Driver registration requires license, vehicle type, and registration number' });
    }

    try {
        const existing = await getSQL('SELECT * FROM User WHERE phone = ?', [phone.trim()]);
        if (existing) {
            if (role === 'passenger') {
                const alreadyPassenger = await getSQL('SELECT user_id FROM Passenger WHERE user_id = ?', [existing.user_id]);
                if (alreadyPassenger) return res.status(409).json({ error: 'Already registered as passenger' });
                await runSQL('INSERT INTO Passenger (user_id) VALUES (?)', [existing.user_id]);
                return res.status(201).json({ user_id: existing.user_id, name: existing.name, phone: existing.phone, role: 'passenger' });
            } else {
                const alreadyDriver = await getSQL('SELECT user_id FROM Driver WHERE user_id = ?', [existing.user_id]);
                if (alreadyDriver) return res.status(409).json({ error: 'Already registered as driver' });
                await transaction(async ({ run }) => {
                    await run('INSERT INTO Driver (user_id, license_no, status, rating) VALUES (?, ?, ?, ?)', [existing.user_id, license_no, 'Available', 4.0]);
                    await run('INSERT INTO Vehicle (vehicle_type, registration_no, driver_user_id) VALUES (?, ?, ?)', [vehicle_type, registration_no, existing.user_id]);
                });
                return res.status(201).json({ user_id: existing.user_id, name: existing.name, phone: existing.phone, role: 'driver' });
            }
        }

        const userId = await transaction(async ({ run }) => {
            const r = await run('INSERT INTO User (name, phone, trust_score) VALUES (?, ?, ?)', [name.trim(), phone.trim(), 5]);
            if (role === 'passenger') {
                await run('INSERT INTO Passenger (user_id) VALUES (?)', [r.lastInsertRowid]);
            } else {
                await run('INSERT INTO Driver (user_id, license_no, status, rating) VALUES (?, ?, ?, ?)', [r.lastInsertRowid, license_no, 'Available', 4.0]);
                await run('INSERT INTO Vehicle (vehicle_type, registration_no, driver_user_id) VALUES (?, ?, ?)', [vehicle_type, registration_no, r.lastInsertRowid]);
            }
            return r.lastInsertRowid;
        });

        res.status(201).json({ user_id: userId, name: name.trim(), phone: phone.trim(), role });
    } catch (err) {
        if (err.message.includes('Duplicate')) return res.status(409).json({ error: 'Phone, license, or registration number already exists' });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
