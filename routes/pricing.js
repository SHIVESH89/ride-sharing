const express = require('express');
const router = express.Router();
const { allSQL, getSQL, runSQL } = require('../database/db');

router.get('/zones', (req, res) => {
    try { res.json(allSQL('SELECT * FROM Surge_Zone ORDER BY zone_id')); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/zones', (req, res) => {
    const { zone_name, base_fare } = req.body;
    if (!zone_name || !base_fare) return res.status(400).json({ error: 'zone_name and base_fare required' });
    try {
        const r = runSQL('INSERT INTO Surge_Zone (zone_name, base_fare) VALUES (?, ?)', [zone_name, +base_fare]);
        const zone = getSQL('SELECT * FROM Surge_Zone WHERE zone_id = ?', [r.lastInsertRowid]);
        req.app.get('broadcast')('zoneAdded', zone);
        res.status(201).json(zone);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/zones/:id', (req, res) => {
    const { zone_name, base_fare } = req.body;
    try {
        const updates = []; const params = [];
        if (zone_name) { updates.push('zone_name = ?'); params.push(zone_name); }
        if (base_fare !== undefined) { updates.push('base_fare = ?'); params.push(+base_fare); }
        if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
        params.push(+req.params.id);
        runSQL(`UPDATE Surge_Zone SET ${updates.join(', ')} WHERE zone_id = ?`, params);
        res.json(getSQL('SELECT * FROM Surge_Zone WHERE zone_id = ?', [+req.params.id]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/zones/:id', (req, res) => {
    try { runSQL('DELETE FROM Surge_Zone WHERE zone_id = ?', [+req.params.id]); res.json({ message: 'Zone deleted' }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/timeslots', (req, res) => {
    try { res.json(allSQL('SELECT * FROM Time_Slot ORDER BY timeslot_id')); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// GET current timeslot based on server time
router.get('/timeslots/current', (req, res) => {
    try {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const currentTime = `${hh}:${mm}`;
        const slots = allSQL('SELECT * FROM Time_Slot ORDER BY timeslot_id');
        let matched = null;
        for (const s of slots) {
            if (s.end_time === '00:00') {
                if (currentTime >= s.start_time || currentTime < '00:00') { matched = s; break; }
            } else {
                if (currentTime >= s.start_time && currentTime < s.end_time) { matched = s; break; }
            }
        }
        if (!matched) matched = slots[0];
        res.json(matched);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/timeslots', (req, res) => {
    const { start_time, end_time, surge_multiplier } = req.body;
    if (!start_time || !end_time || !surge_multiplier) return res.status(400).json({ error: 'All fields required' });
    try {
        const r = runSQL('INSERT INTO Time_Slot (start_time, end_time, surge_multiplier) VALUES (?, ?, ?)', [start_time, end_time, +surge_multiplier]);
        const slot = getSQL('SELECT * FROM Time_Slot WHERE timeslot_id = ?', [r.lastInsertRowid]);
        req.app.get('broadcast')('timeslotAdded', slot);
        res.status(201).json(slot);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/timeslots/:id', (req, res) => {
    const { start_time, end_time, surge_multiplier } = req.body;
    try {
        const updates = []; const params = [];
        if (start_time) { updates.push('start_time = ?'); params.push(start_time); }
        if (end_time) { updates.push('end_time = ?'); params.push(end_time); }
        if (surge_multiplier !== undefined) { updates.push('surge_multiplier = ?'); params.push(+surge_multiplier); }
        if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
        params.push(+req.params.id);
        runSQL(`UPDATE Time_Slot SET ${updates.join(', ')} WHERE timeslot_id = ?`, params);
        res.json(getSQL('SELECT * FROM Time_Slot WHERE timeslot_id = ?', [+req.params.id]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/timeslots/:id', (req, res) => {
    try { runSQL('DELETE FROM Time_Slot WHERE timeslot_id = ?', [+req.params.id]); res.json({ message: 'Deleted' }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/calculate', (req, res) => {
    const { zone_id, timeslot_id } = req.query;
    if (!zone_id || !timeslot_id) return res.status(400).json({ error: 'zone_id and timeslot_id required' });
    try {
        const zone = getSQL('SELECT * FROM Surge_Zone WHERE zone_id = ?', [+zone_id]);
        const slot = getSQL('SELECT * FROM Time_Slot WHERE timeslot_id = ?', [+timeslot_id]);
        if (!zone || !slot) return res.status(404).json({ error: 'Zone or timeslot not found' });
        const fare = parseFloat((zone.base_fare * slot.surge_multiplier).toFixed(2));
        res.json({ zone_name: zone.zone_name, base_fare: zone.base_fare, time_range: `${slot.start_time} - ${slot.end_time}`,
            surge_multiplier: slot.surge_multiplier, calculated_fare: fare, formula: `${zone.base_fare} x ${slot.surge_multiplier} = ${fare}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET zone by name (for auto-matching pickup to zone)
router.get('/zone-by-name', (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const zone = getSQL('SELECT * FROM Surge_Zone WHERE zone_name = ?', [name]);
        if (!zone) return res.status(404).json({ error: 'Zone not found for location' });
        res.json(zone);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
