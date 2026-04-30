const express = require('express');
const router = express.Router();
const { allSQL } = require('../database/db');

router.get('/', async (req, res) => {
    try {
        res.json(await allSQL(`SELECT p.*, r.pickup_location, r.drop_location, u.name as passenger_name
            FROM Payment p JOIN Ride r ON p.ride_id = r.ride_id
            LEFT JOIN User u ON p.passenger_user_id = u.user_id ORDER BY p.payment_id DESC`));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ride/:ride_id', async (req, res) => {
    try {
        res.json(await allSQL(`SELECT p.*, u.name as passenger_name FROM Payment p
            LEFT JOIN User u ON p.passenger_user_id = u.user_id WHERE p.ride_id = ?`, [+req.params.ride_id]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
