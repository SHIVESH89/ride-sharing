const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database/db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SSE (NOTE: may not fully work on Vercel)
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
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/passengers', require('./routes/passengers'));
app.use('/api/rides', require('./routes/rides'));
app.use('/api/pricing', require('./routes/pricing'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/simulate', require('./routes/simulation'));
app.use('/api/schema', require('./routes/schema'));

// Stats
app.get('/api/stats', (req, res) => {
    const { getSQL } = require('./database/db');
    try {
        const totalUsers = getSQL('SELECT COUNT(*) as count FROM User').count;
        const totalPassengers = getSQL('SELECT COUNT(*) as count FROM Passenger').count;
        const totalDrivers = getSQL('SELECT COUNT(*) as count FROM Driver').count;
        const activeRides = getSQL("SELECT COUNT(*) as count FROM Ride WHERE ride_status IN ('Pending','Ongoing')").count;
        const completedRides = getSQL("SELECT COUNT(*) as count FROM Ride WHERE ride_status = 'Completed'").count;
        const totalRevenue = getSQL('SELECT COALESCE(SUM(amount),0) as total FROM Payment').total;
        const availableDrivers = getSQL("SELECT COUNT(*) as count FROM Driver WHERE status = 'Available'").count;

        res.json({
            totalUsers,
            totalPassengers,
            totalDrivers,
            activeRides,
            completedRides,
            totalRevenue,
            availableDrivers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// IMPORTANT: initialize DB once
let isInitialized = false;

module.exports = async (req, res) => {
    if (!isInitialized) {
        await initDB();
        isInitialized = true;
    }
    return app(req, res);
};