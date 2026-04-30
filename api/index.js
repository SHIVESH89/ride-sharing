const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('../database/db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// SSE
let sseClients = [];

app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseClients.push(res);

    req.on('close', () => {
        sseClients = sseClients.filter(c => c !== res);
    });
});

function broadcast(event, data) {
    sseClients.forEach(client => {
        client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
}

app.set('broadcast', broadcast);

// Routes
app.use('/api/auth', require('../routes/auth'));
app.use('/api/users', require('../routes/users'));
app.use('/api/drivers', require('../routes/drivers'));
app.use('/api/passengers', require('../routes/passengers'));
app.use('/api/rides', require('../routes/rides'));
app.use('/api/pricing', require('../routes/pricing'));
app.use('/api/payments', require('../routes/payments'));
app.use('/api/simulate', require('../routes/simulation'));
app.use('/api/schema', require('../routes/schema'));

// Stats
app.get('/api/stats', async (req, res) => {
    const { getSQL } = require('../database/db');
    try {
        const [totalUsers, totalPassengers, totalDrivers, activeRides, completedRides, totalRevenue, availableDrivers] = await Promise.all([
            getSQL('SELECT COUNT(*) as count FROM User'),
            getSQL('SELECT COUNT(*) as count FROM Passenger'),
            getSQL('SELECT COUNT(*) as count FROM Driver'),
            getSQL("SELECT COUNT(*) as count FROM Ride WHERE ride_status IN ('Pending','Ongoing')"),
            getSQL("SELECT COUNT(*) as count FROM Ride WHERE ride_status = 'Completed'"),
            getSQL('SELECT COALESCE(SUM(amount),0) as total FROM Payment'),
            getSQL("SELECT COUNT(*) as count FROM Driver WHERE status = 'Available'")
        ]);

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
        res.status(500).json({ error: err.message });
    }
});

// Initialize DB and start server
const PORT = process.env.PORT || 3000;

initDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ Failed to initialize database:', err.message);
        process.exit(1);
    });

module.exports = app;