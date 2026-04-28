const express = require('express');
const router = express.Router();
const { allSQL, getSQL, runSQL, transaction } = require('../database/db');

// GET all rides (with filters)
router.get('/', (req, res) => {
    try {
        const { status, passenger_id, driver_id, vehicle_type, min_rating } = req.query;
        let sql = `SELECT r.*, u_p.name as passenger_name, u_d.name as driver_name,
            sz.zone_name, sz.base_fare, ts.start_time, ts.end_time, ts.surge_multiplier
            FROM Ride r JOIN User u_p ON r.passenger_user_id = u_p.user_id
            LEFT JOIN User u_d ON r.driver_user_id = u_d.user_id
            JOIN Surge_Zone sz ON r.zone_id = sz.zone_id
            JOIN Time_Slot ts ON r.timeslot_id = ts.timeslot_id`;
        const conditions = [];
        const params = [];
        if (status) { conditions.push('r.ride_status = ?'); params.push(status); }
        if (passenger_id) { conditions.push('(r.passenger_user_id = ? OR r.ride_id IN (SELECT ride_id FROM Ride_Passenger WHERE passenger_user_id = ?))'); params.push(+passenger_id, +passenger_id); }
        if (driver_id) { conditions.push('r.driver_user_id = ?'); params.push(+driver_id); }
        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY r.ride_id DESC';
        res.json(allSQL(sql, params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET shareable rides (pool rides with available seats)
router.get('/shareable', (req, res) => {
    try {
        res.json(allSQL(`SELECT r.*, u_p.name as passenger_name, u_d.name as driver_name,
            sz.zone_name, sz.base_fare, ts.surge_multiplier,
            (r.max_seats - r.booked_seats) as available_seats
            FROM Ride r JOIN User u_p ON r.passenger_user_id = u_p.user_id
            LEFT JOIN User u_d ON r.driver_user_id = u_d.user_id
            JOIN Surge_Zone sz ON r.zone_id = sz.zone_id
            JOIN Time_Slot ts ON r.timeslot_id = ts.timeslot_id
            WHERE r.ride_status = 'Pending' AND r.is_pool = 1 AND r.booked_seats < r.max_seats
            ORDER BY r.ride_id DESC`));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET passengers in a ride
router.get('/:id/passengers', (req, res) => {
    try {
        res.json(allSQL(`SELECT rp.*, u.name, u.phone FROM Ride_Passenger rp
            JOIN User u ON rp.passenger_user_id = u.user_id WHERE rp.ride_id = ?`, [+req.params.id]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET check if user has rated a ride
router.get('/:id/has-rated', (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
        const rating = getSQL('SELECT * FROM Rating WHERE ride_id = ? AND from_user_id = ?', [+req.params.id, +user_id]);
        res.json({ rated: !!rating });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST book new ride
router.post('/', (req, res) => {
    const { passenger_user_id, pickup_location, drop_location, zone_id, timeslot_id, max_seats,
            booking_type, scheduled_time, is_pool, min_driver_rating, vehicle_type_filter } = req.body;
    if (!passenger_user_id || !pickup_location || !drop_location || !zone_id || !timeslot_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const zone = getSQL('SELECT base_fare FROM Surge_Zone WHERE zone_id = ?', [+zone_id]);
        const slot = getSQL('SELECT surge_multiplier FROM Time_Slot WHERE timeslot_id = ?', [+timeslot_id]);
        if (!zone || !slot) return res.status(400).json({ error: 'Invalid zone or timeslot' });
        const fare = parseFloat((zone.base_fare * slot.surge_multiplier).toFixed(2));
        const seats = max_seats || 4;
        const pool = is_pool ? 1 : 0;
        const minRating = min_driver_rating || 3.0;
        const vFilter = vehicle_type_filter || 'ANY';
        const bType = booking_type || 'now';

        const rideId = transaction(() => {
            const r = runSQL(`INSERT INTO Ride (pickup_location, drop_location, ride_status, fare, max_seats, booked_seats,
                booking_type, scheduled_time, is_pool, min_driver_rating, vehicle_type_filter,
                passenger_user_id, zone_id, timeslot_id)
                VALUES (?, ?, 'Pending', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [pickup_location, drop_location, fare, seats, bType, scheduled_time || null,
                 pool, minRating, vFilter, +passenger_user_id, +zone_id, +timeslot_id]);
            runSQL('INSERT INTO Ride_Passenger (ride_id, passenger_user_id, fare_share) VALUES (?, ?, ?)',
                [r.lastInsertRowid, +passenger_user_id, fare]);
            return r.lastInsertRowid;
        });

        const ride = getSQL(`SELECT r.*, sz.zone_name, sz.base_fare, ts.surge_multiplier, u.name as passenger_name
            FROM Ride r JOIN Surge_Zone sz ON r.zone_id = sz.zone_id
            JOIN Time_Slot ts ON r.timeslot_id = ts.timeslot_id
            JOIN User u ON r.passenger_user_id = u.user_id WHERE r.ride_id = ?`, [rideId]);
        req.app.get('broadcast')('rideBooked', ride);
        res.status(201).json(ride);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST join shared ride
router.post('/:id/join', (req, res) => {
    const { passenger_user_id } = req.body;
    const rideId = +req.params.id;
    if (!passenger_user_id) return res.status(400).json({ error: 'passenger_user_id required' });
    try {
        const ride = getSQL('SELECT * FROM Ride WHERE ride_id = ?', [rideId]);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.booked_seats >= ride.max_seats) return res.status(400).json({ error: 'Ride is full' });
        if (ride.ride_status === 'Completed' || ride.ride_status === 'Cancelled') {
            return res.status(400).json({ error: 'Cannot join completed/cancelled ride' });
        }
        const existing = getSQL('SELECT * FROM Ride_Passenger WHERE ride_id = ? AND passenger_user_id = ?', [rideId, +passenger_user_id]);
        if (existing) return res.status(400).json({ error: 'Already in this ride' });

        transaction(() => {
            const newSeats = ride.booked_seats + 1;
            const fareShare = parseFloat((ride.fare / newSeats).toFixed(2));
            runSQL('UPDATE Ride SET booked_seats = ? WHERE ride_id = ?', [newSeats, rideId]);
            runSQL('INSERT INTO Ride_Passenger (ride_id, passenger_user_id, fare_share) VALUES (?, ?, ?)', [rideId, +passenger_user_id, fareShare]);
            runSQL('UPDATE Ride_Passenger SET fare_share = ? WHERE ride_id = ?', [fareShare, rideId]);
        });

        const updatedRide = getSQL('SELECT * FROM Ride WHERE ride_id = ?', [rideId]);
        req.app.get('broadcast')('rideJoined', { ride_id: rideId, passenger_user_id });
        res.json({ message: 'Joined ride successfully', ride: updatedRide });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH accept ride
router.patch('/:id/accept', (req, res) => {
    const { driver_user_id } = req.body;
    if (!driver_user_id) return res.status(400).json({ error: 'driver_user_id required' });
    try {
        const ride = getSQL('SELECT * FROM Ride WHERE ride_id = ?', [+req.params.id]);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.ride_status !== 'Pending') return res.status(400).json({ error: 'Ride is not pending' });

        // Check driver rating requirement
        const driver = getSQL('SELECT * FROM Driver WHERE user_id = ?', [+driver_user_id]);
        if (!driver) return res.status(400).json({ error: 'Driver not found' });
        if (driver.rating < ride.min_driver_rating) {
            return res.status(403).json({ error: `Your rating (${driver.rating}) is below the minimum required (${ride.min_driver_rating})` });
        }

        // Check vehicle type filter
        if (ride.vehicle_type_filter && ride.vehicle_type_filter !== 'ANY') {
            const vehicle = getSQL('SELECT * FROM Vehicle WHERE driver_user_id = ?', [+driver_user_id]);
            if (vehicle && vehicle.vehicle_type !== ride.vehicle_type_filter) {
                return res.status(403).json({ error: `Ride requires ${ride.vehicle_type_filter} but you have ${vehicle.vehicle_type}` });
            }
        }

        // Check pool ride: must be full before driver can accept
        if (ride.is_pool && ride.booked_seats < ride.max_seats) {
            return res.status(400).json({ error: `Pool ride not full yet (${ride.booked_seats}/${ride.max_seats} seats filled)` });
        }

        transaction(() => {
            runSQL("UPDATE Ride SET driver_user_id = ?, ride_status = 'Ongoing' WHERE ride_id = ?", [+driver_user_id, +req.params.id]);
            runSQL("UPDATE Driver SET status = 'Busy' WHERE user_id = ?", [+driver_user_id]);
        });
        req.app.get('broadcast')('rideAccepted', { ride_id: req.params.id, driver_user_id });
        res.json({ message: 'Ride accepted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH complete ride
router.patch('/:id/complete', (req, res) => {
    const { payment_mode } = req.body;
    try {
        const ride = getSQL('SELECT * FROM Ride WHERE ride_id = ?', [+req.params.id]);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.ride_status !== 'Ongoing') return res.status(400).json({ error: 'Ride is not ongoing' });
        transaction(() => {
            runSQL("UPDATE Ride SET ride_status = 'Completed' WHERE ride_id = ?", [+req.params.id]);
            if (ride.driver_user_id) runSQL("UPDATE Driver SET status = 'Available' WHERE user_id = ?", [ride.driver_user_id]);
            const passengers = allSQL('SELECT * FROM Ride_Passenger WHERE ride_id = ?', [+req.params.id]);
            passengers.forEach(p => {
                runSQL('INSERT INTO Payment (amount, payment_mode, ride_id, passenger_user_id) VALUES (?, ?, ?, ?)',
                    [p.fare_share, payment_mode || 'UPI', +req.params.id, p.passenger_user_id]);
            });
        });
        req.app.get('broadcast')('rideCompleted', { ride_id: req.params.id });
        res.json({ message: 'Ride completed, payments created' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST rate a driver after ride completion
router.post('/:id/rate', (req, res) => {
    const { from_user_id, to_user_id, stars } = req.body;
    if (!from_user_id || !to_user_id || !stars) return res.status(400).json({ error: 'Missing rating fields' });
    if (stars < 1 || stars > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
    try {
        const ride = getSQL('SELECT * FROM Ride WHERE ride_id = ?', [+req.params.id]);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.ride_status !== 'Completed') return res.status(400).json({ error: 'Can only rate completed rides' });

        const existing = getSQL('SELECT * FROM Rating WHERE ride_id = ? AND from_user_id = ?', [+req.params.id, +from_user_id]);
        if (existing) return res.status(400).json({ error: 'Already rated this ride' });

        transaction(() => {
            runSQL('INSERT INTO Rating (ride_id, from_user_id, to_user_id, stars) VALUES (?, ?, ?, ?)',
                [+req.params.id, +from_user_id, +to_user_id, +stars]);
            // Update driver's average rating
            const avg = getSQL('SELECT AVG(stars) as avg_rating FROM Rating WHERE to_user_id = ?', [+to_user_id]);
            if (avg && avg.avg_rating) {
                runSQL('UPDATE Driver SET rating = ? WHERE user_id = ?', [parseFloat(avg.avg_rating.toFixed(2)), +to_user_id]);
            }
        });
        const updatedDriver = getSQL('SELECT rating FROM Driver WHERE user_id = ?', [+to_user_id]);
        req.app.get('broadcast')('rideRated', { ride_id: req.params.id, new_rating: updatedDriver ? updatedDriver.rating : null });
        res.json({ message: 'Rating submitted', new_rating: updatedDriver ? updatedDriver.rating : null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH cancel ride
router.patch('/:id/cancel', (req, res) => {
    try {
        const ride = getSQL('SELECT * FROM Ride WHERE ride_id = ?', [+req.params.id]);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        transaction(() => {
            runSQL("UPDATE Ride SET ride_status = 'Cancelled' WHERE ride_id = ?", [+req.params.id]);
            if (ride.driver_user_id) runSQL("UPDATE Driver SET status = 'Available' WHERE user_id = ?", [ride.driver_user_id]);
        });
        req.app.get('broadcast')('rideCancelled', { ride_id: req.params.id });
        res.json({ message: 'Ride cancelled' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
