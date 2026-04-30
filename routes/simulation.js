const express = require('express');
const router = express.Router();
const { allSQL, getSQL, runSQL, transaction } = require('../database/db');

const PAYMENT_MODES = ['UPI', 'Card', 'Cash'];
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Simulate ride request
router.post('/request-ride', async (req, res) => {
    try {
        const passengers = await allSQL('SELECT user_id FROM Passenger');
        if (!passengers.length) return res.status(400).json({ error: 'No passengers registered' });
        const zones = await allSQL('SELECT * FROM Surge_Zone');
        const slots = await allSQL('SELECT * FROM Time_Slot');
        if (!zones.length || !slots.length) return res.status(400).json({ error: 'No zones or timeslots' });

        const passenger = randomFrom(passengers);
        const pickupZone = randomFrom(zones);
        const dropZone = randomFrom(zones.filter(z => z.zone_id !== pickupZone.zone_id));
        const slot = randomFrom(slots);
        const fare = parseFloat((pickupZone.base_fare * slot.surge_multiplier).toFixed(2));
        const maxSeats = Math.random() > 0.5 ? 4 : 2;
        const isPool = Math.random() > 0.7 ? 1 : 0;

        const rideId = await transaction(async ({ run }) => {
            const r = await run(`INSERT INTO Ride (pickup_location, drop_location, ride_status, fare, max_seats, booked_seats,
                booking_type, is_pool, min_driver_rating, vehicle_type_filter, passenger_user_id, zone_id, timeslot_id)
                VALUES (?, ?, 'Pending', ?, ?, 1, 'now', ?, 3.0, 'ANY', ?, ?, ?)`,
                [pickupZone.zone_name, dropZone.zone_name, fare, maxSeats, isPool, passenger.user_id, pickupZone.zone_id, slot.timeslot_id]);
            await run('INSERT INTO Ride_Passenger (ride_id, passenger_user_id, fare_share) VALUES (?, ?, ?)',
                [r.lastInsertRowid, passenger.user_id, fare]);
            return r.lastInsertRowid;
        });

        const ride = await getSQL(`SELECT r.*, u.name as passenger_name, sz.zone_name, ts.surge_multiplier
            FROM Ride r JOIN User u ON r.passenger_user_id = u.user_id
            JOIN Surge_Zone sz ON r.zone_id = sz.zone_id JOIN Time_Slot ts ON r.timeslot_id = ts.timeslot_id
            WHERE r.ride_id = ?`, [rideId]);
        req.app.get('broadcast')('rideBooked', ride);
        res.json({ message: `Ride #${rideId} requested by ${ride.passenger_name} | ${pickupZone.zone_name} to ${dropZone.zone_name} | Fare: ${fare}`, ride });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Simulate driver accept
router.post('/accept-ride', async (req, res) => {
    try {
        const pendingRide = await getSQL("SELECT * FROM Ride WHERE ride_status = 'Pending' AND (is_pool = 0 OR booked_seats >= max_seats) ORDER BY ride_id ASC LIMIT 1");
        if (!pendingRide) return res.status(400).json({ error: 'No pending rides available (pool rides may not be full yet)' });
        const driver = await getSQL(`SELECT d.*, v.vehicle_type FROM Driver d LEFT JOIN Vehicle v ON v.driver_user_id = d.user_id
            WHERE d.status = 'Available' AND d.rating >= ? LIMIT 1`, [pendingRide.min_driver_rating]);
        if (!driver) return res.status(400).json({ error: 'No available drivers meeting rating requirements' });

        await transaction(async ({ run }) => {
            await run("UPDATE Ride SET driver_user_id = ?, ride_status = 'Ongoing' WHERE ride_id = ?", [driver.user_id, pendingRide.ride_id]);
            await run("UPDATE Driver SET status = 'Busy' WHERE user_id = ?", [driver.user_id]);
        });

        const driverUser = await getSQL('SELECT name FROM User WHERE user_id = ?', [driver.user_id]);
        req.app.get('broadcast')('rideAccepted', { ride_id: pendingRide.ride_id, driver_user_id: driver.user_id });
        res.json({ message: `Driver ${driverUser.name} accepted Ride #${pendingRide.ride_id}`, ride_id: pendingRide.ride_id, driver: driverUser.name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Simulate ride complete
router.post('/complete-ride', async (req, res) => {
    try {
        const ride = await getSQL("SELECT * FROM Ride WHERE ride_status = 'Ongoing' ORDER BY ride_id ASC LIMIT 1");
        if (!ride) return res.status(400).json({ error: 'No ongoing rides' });
        const mode = randomFrom(PAYMENT_MODES);
        await transaction(async ({ run, all }) => {
            await run("UPDATE Ride SET ride_status = 'Completed' WHERE ride_id = ?", [ride.ride_id]);
            if (ride.driver_user_id) await run("UPDATE Driver SET status = 'Available' WHERE user_id = ?", [ride.driver_user_id]);
            const passengers = await all('SELECT * FROM Ride_Passenger WHERE ride_id = ?', [ride.ride_id]);
            for (const p of passengers) {
                await run('INSERT INTO Payment (amount, payment_mode, ride_id, passenger_user_id) VALUES (?, ?, ?, ?)',
                    [p.fare_share, mode, ride.ride_id, p.passenger_user_id]);
            }
        });
        req.app.get('broadcast')('rideCompleted', { ride_id: ride.ride_id });
        res.json({ message: `Ride #${ride.ride_id} completed. Payment: ${ride.fare} via ${mode}`, ride_id: ride.ride_id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
