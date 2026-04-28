const express = require('express');
const router = express.Router();
const { allSQL, getSQL, runSQL, transaction } = require('../database/db');

router.get('/', (req, res) => {
    try {
        const drivers = allSQL(`SELECT u.user_id, u.name, u.phone, u.trust_score,
            d.license_no, d.status, d.rating,
            v.vehicle_id, v.vehicle_type, v.registration_no
            FROM Driver d JOIN User u ON d.user_id = u.user_id
            LEFT JOIN Vehicle v ON v.driver_user_id = d.user_id ORDER BY u.user_id`);
        res.json(drivers);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
    const { name, phone, trust_score, license_no, vehicle_type, registration_no } = req.body;
    if (!name || !phone || !license_no || !vehicle_type || !registration_no) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    try {
        const userId = transaction(() => {
            const r = runSQL('INSERT INTO User (name, phone, trust_score) VALUES (?, ?, ?)', [name, phone, trust_score || 5]);
            runSQL('INSERT INTO Driver (user_id, license_no, status, rating) VALUES (?, ?, ?, ?)', [r.lastInsertRowid, license_no, 'Available', 4.0]);
            runSQL('INSERT INTO Vehicle (vehicle_type, registration_no, driver_user_id) VALUES (?, ?, ?)', [vehicle_type, registration_no, r.lastInsertRowid]);
            return r.lastInsertRowid;
        });
        const driver = getSQL(`SELECT u.user_id, u.name, u.phone, u.trust_score, d.license_no, d.status, d.rating,
            v.vehicle_id, v.vehicle_type, v.registration_no
            FROM Driver d JOIN User u ON d.user_id = u.user_id
            LEFT JOIN Vehicle v ON v.driver_user_id = d.user_id WHERE u.user_id = ?`, [userId]);
        req.app.get('broadcast')('driverRegistered', driver);
        res.status(201).json(driver);
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Phone, license, or registration already exists' });
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id/status', (req, res) => {
    const { status } = req.body;
    if (!['Available', 'Busy', 'Offline'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    try {
        runSQL('UPDATE Driver SET status = ? WHERE user_id = ?', [status, +req.params.id]);
        req.app.get('broadcast')('driverStatusChanged', { user_id: req.params.id, status });
        res.json({ message: 'Status updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update driver profile
router.patch('/:id', (req, res) => {
    const { name, phone, license_no, vehicle_type, registration_no } = req.body;
    try {
        if (name || phone) {
            const updates = [];
            const params = [];
            if (name) { updates.push('name = ?'); params.push(name); }
            if (phone) { updates.push('phone = ?'); params.push(phone); }
            params.push(+req.params.id);
            runSQL(`UPDATE User SET ${updates.join(', ')} WHERE user_id = ?`, params);
        }
        if (license_no) {
            runSQL('UPDATE Driver SET license_no = ? WHERE user_id = ?', [license_no, +req.params.id]);
        }
        if (vehicle_type || registration_no) {
            const updates = [];
            const params = [];
            if (vehicle_type) { updates.push('vehicle_type = ?'); params.push(vehicle_type); }
            if (registration_no) { updates.push('registration_no = ?'); params.push(registration_no); }
            params.push(+req.params.id);
            runSQL(`UPDATE Vehicle SET ${updates.join(', ')} WHERE driver_user_id = ?`, params);
        }
        const driver = getSQL(`SELECT u.user_id, u.name, u.phone, u.trust_score, d.license_no, d.status, d.rating,
            v.vehicle_id, v.vehicle_type, v.registration_no
            FROM Driver d JOIN User u ON d.user_id = u.user_id
            LEFT JOIN Vehicle v ON v.driver_user_id = d.user_id WHERE u.user_id = ?`, [+req.params.id]);
        res.json(driver);
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Duplicate value detected' });
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', (req, res) => {
    try {
        transaction(() => {
            runSQL('DELETE FROM Vehicle WHERE driver_user_id = ?', [+req.params.id]);
            runSQL('DELETE FROM Driver WHERE user_id = ?', [+req.params.id]);
            runSQL('DELETE FROM User WHERE user_id = ?', [+req.params.id]);
        });
        req.app.get('broadcast')('driverDeleted', { user_id: req.params.id });
        res.json({ message: 'Driver deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
