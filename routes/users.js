const express = require('express');
const router = express.Router();
const { allSQL, getSQL, runSQL } = require('../database/db');

router.get('/', (req, res) => {
    try {
        const users = allSQL(`
            SELECT u.*, 
                CASE WHEN p.user_id IS NOT NULL THEN 1 ELSE 0 END as is_passenger,
                CASE WHEN d.user_id IS NOT NULL THEN 1 ELSE 0 END as is_driver
            FROM User u LEFT JOIN Passenger p ON u.user_id = p.user_id
            LEFT JOIN Driver d ON u.user_id = d.user_id ORDER BY u.user_id
        `);
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', (req, res) => {
    try {
        const user = getSQL('SELECT * FROM User WHERE user_id = ?', [+req.params.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
    try {
        runSQL('DELETE FROM Ride_Passenger WHERE passenger_user_id = ?', [+req.params.id]);
        runSQL('DELETE FROM Payment WHERE passenger_user_id = ?', [+req.params.id]);
        runSQL('DELETE FROM Vehicle WHERE driver_user_id = ?', [+req.params.id]);
        runSQL('DELETE FROM Driver WHERE user_id = ?', [+req.params.id]);
        runSQL('DELETE FROM Passenger WHERE user_id = ?', [+req.params.id]);
        const result = runSQL('DELETE FROM User WHERE user_id = ?', [+req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
        req.app.get('broadcast')('userDeleted', { user_id: req.params.id });
        res.json({ message: 'User deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
