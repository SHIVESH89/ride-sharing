const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes (IMPORTANT: use ../ because file is inside /api)
app.use('/api/auth', require('../routes/auth'));
app.use('/api/users', require('../routes/users'));
app.use('/api/drivers', require('../routes/drivers'));
app.use('/api/passengers', require('../routes/passengers'));
app.use('/api/rides', require('../routes/rides'));
app.use('/api/pricing', require('../routes/pricing'));
app.use('/api/payments', require('../routes/payments'));
app.use('/api/simulate', require('../routes/simulation'));
app.use('/api/schema', require('../routes/schema'));

// Example test route (optional but useful)
app.get('/api/test', (req, res) => {
    res.json({ message: "API is working" });
});

// Stats route (UPDATED for PostgreSQL)
app.get('/api/stats', async (req, res) => {
    try {
        const { getSQL } = require('../database/db');

        const totalUsers = await getSQL('SELECT COUNT(*) as count FROM "User"');
        const totalPassengers = await getSQL('SELECT COUNT(*) as count FROM "Passenger"');
        const totalDrivers = await getSQL('SELECT COUNT(*) as count FROM "Driver"');

        const activeRides = await getSQL(
            `SELECT COUNT(*) as count FROM "Ride" WHERE ride_status IN ('Pending','Ongoing')`
        );

        const completedRides = await getSQL(
            `SELECT COUNT(*) as count FROM "Ride" WHERE ride_status = 'Completed'`
        );

        const totalRevenue = await getSQL(
            `SELECT COALESCE(SUM(amount),0) as total FROM "Payment"`
        );

        const availableDrivers = await getSQL(
            `SELECT COUNT(*) as count FROM "Driver" WHERE status = 'Available'`
        );

        res.json({
            totalUsers: totalUsers.count,
            totalPassengers: totalPassengers.count,
            totalDrivers: totalDrivers.count,
            activeRides: activeRides.count,
            completedRides: completedRides.count,
            totalRevenue: totalRevenue.total,
            availableDrivers: availableDrivers.count
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 🚀 Vercel serverless handler
module.exports = async (req, res) => {
    try {
        return app(req, res);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
