/* ============================================
   RideShare — Passenger Module
   ============================================ */
const Passenger = {
    _bound: false,
    zones: [],
    timeslots: [],

    async init() {
        await RideMap.loadZones();
        this.zones = RideMap.zones;
        RideMap.render('passengerMap');
        this.populateLocations();
        await this.loadTimeslots();
        this.loadMyRides();
        this.loadShareableRides();
        this.bindEvents();
    },

    refresh() { this.loadMyRides(); this.loadShareableRides(); },

    bindEvents() {
        if (this._bound) return;
        this._bound = true;
        document.getElementById('bookPickup').addEventListener('change', () => this.onLocationChange());
        document.getElementById('bookDrop').addEventListener('change', () => this.onLocationChange());
    },

    populateLocations() {
        const pickupSel = document.getElementById('bookPickup');
        const dropSel = document.getElementById('bookDrop');
        const opts = '<option value="">Select location</option>' +
            this.zones.map(z => `<option value="${z.zone_name}">${z.zone_name} (Base: ${z.base_fare})</option>`).join('');
        pickupSel.innerHTML = opts;
        dropSel.innerHTML = opts;
    },

    async loadTimeslots() {
        try {
            this.timeslots = await api.get('/api/pricing/timeslots');
            const sel = document.getElementById('bookTimeslot');
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const currentTime = `${hh}:${mm}`;
            const future = this.timeslots.filter(s => {
                if (s.end_time === '00:00') return s.start_time > currentTime;
                return s.start_time >= currentTime || s.end_time > currentTime;
            });
            sel.innerHTML = '<option value="">Select time slot</option>' +
                future.map(s => `<option value="${s.timeslot_id}">${s.start_time} - ${s.end_time} (x${s.surge_multiplier})</option>`).join('');
        } catch (e) { console.error(e); }
    },

    onLocationChange() {
        const pickup = document.getElementById('bookPickup').value;
        const drop = document.getElementById('bookDrop').value;

        // Prevent same pickup and drop
        if (pickup && drop && pickup === drop) {
            showToast('Pickup and drop location must be different', 'error');
            document.getElementById('bookDrop').value = '';
            return;
        }

        RideMap.clearHighlights('passengerMap');
        if (pickup) RideMap.highlightZone('passengerMap', pickup, 'pickup');
        if (drop) RideMap.highlightZone('passengerMap', drop, 'dropoff');
        if (pickup && drop) RideMap.drawRoute('passengerMap', pickup, drop);
        this.previewFare();
    },

    async previewFare() {
        const pickup = document.getElementById('bookPickup').value;
        const fareAmount = document.getElementById('fareAmount');
        const fareFormula = document.getElementById('fareFormula');
        if (!pickup) { fareAmount.textContent = '--'; fareFormula.textContent = 'Select pickup location'; return; }
        try {
            const zone = this.zones.find(z => z.zone_name === pickup);
            const currentSlot = await api.get('/api/pricing/timeslots/current');
            if (zone && currentSlot) {
                const fare = (zone.base_fare * currentSlot.surge_multiplier).toFixed(2);
                fareAmount.textContent = `${fare}`;
                fareFormula.textContent = `${zone.base_fare} x ${currentSlot.surge_multiplier} (${currentSlot.start_time}-${currentSlot.end_time})`;
            }
        } catch (e) { fareAmount.textContent = '--'; fareFormula.textContent = 'Error'; }
    },

    validateBooking() {
        const pickup = document.getElementById('bookPickup').value;
        const drop = document.getElementById('bookDrop').value;
        if (!pickup || !drop) { showToast('Select pickup and drop locations', 'error'); return false; }
        if (pickup === drop) { showToast('Pickup and drop must be different', 'error'); return false; }
        return true;
    },

    async bookNow() {
        if (!this.validateBooking()) return;
        const pickup = document.getElementById('bookPickup').value;
        const drop = document.getElementById('bookDrop').value;
        try {
            const zone = this.zones.find(z => z.zone_name === pickup);
            const currentSlot = await api.get('/api/pricing/timeslots/current');
            if (!zone || !currentSlot) return showToast('Could not determine zone/timeslot', 'error');
            const isPool = document.getElementById('bookPool').checked;
            const data = {
                passenger_user_id: currentUser.user_id,
                pickup_location: pickup, drop_location: drop,
                zone_id: zone.zone_id, timeslot_id: currentSlot.timeslot_id,
                booking_type: 'now', is_pool: isPool,
                max_seats: isPool ? +document.getElementById('bookMaxSeats').value : 1,
                min_driver_rating: +document.getElementById('bookMinRating').value,
                vehicle_type_filter: document.getElementById('bookVehicleFilter').value
            };
            const ride = await api.post('/api/rides', data);
            showToast(`Ride #${ride.ride_id} booked! Fare: ${ride.fare}`, 'success');
            this.loadMyRides();
            this.loadShareableRides();
        } catch (err) { showToast(err.message, 'error'); }
    },

    showBookLater() {
        const sec = document.getElementById('bookLaterSection');
        sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
        this.loadTimeslots();
    },

    async bookLater() {
        if (!this.validateBooking()) return;
        const pickup = document.getElementById('bookPickup').value;
        const drop = document.getElementById('bookDrop').value;
        const timeslotId = document.getElementById('bookTimeslot').value;
        if (!timeslotId) return showToast('Select a time slot', 'error');
        try {
            const zone = this.zones.find(z => z.zone_name === pickup);
            if (!zone) return showToast('Invalid pickup zone', 'error');
            const slot = this.timeslots.find(s => s.timeslot_id == timeslotId);
            const isPool = document.getElementById('bookPool').checked;
            const data = {
                passenger_user_id: currentUser.user_id,
                pickup_location: pickup, drop_location: drop,
                zone_id: zone.zone_id, timeslot_id: +timeslotId,
                booking_type: 'later', scheduled_time: slot ? `${slot.start_time}-${slot.end_time}` : '',
                is_pool: isPool,
                max_seats: isPool ? +document.getElementById('bookMaxSeats').value : 1,
                min_driver_rating: +document.getElementById('bookMinRating').value,
                vehicle_type_filter: document.getElementById('bookVehicleFilter').value
            };
            const ride = await api.post('/api/rides', data);
            showToast(`Scheduled ride #${ride.ride_id}! Fare: ${ride.fare}`, 'success');
            document.getElementById('bookLaterSection').style.display = 'none';
            this.loadMyRides();
        } catch (err) { showToast(err.message, 'error'); }
    },

    async loadMyRides() {
        if (!currentUser) return;
        try {
            const rides = await api.get(`/api/rides?passenger_id=${currentUser.user_id}`);
            const tbody = document.getElementById('myRidesBody');
            if (!rides.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No rides yet</td></tr>'; this.hideActiveRide(); return; }

            const activeRides = rides.filter(r => r.ride_status === 'Ongoing' || r.ride_status === 'Pending');
            if (activeRides.length > 0) this.showActiveRides(activeRides);
            else this.hideActiveRide();

            // Check for unrated completed rides via API
            this.checkUnratedRides(rides.filter(r => r.ride_status === 'Completed' && r.driver_user_id));

            tbody.innerHTML = rides.map(r => `<tr>
                <td><strong>#${r.ride_id}</strong></td>
                <td>${r.pickup_location}</td><td>${r.drop_location}</td>
                <td><strong>${r.fare}</strong></td>
                <td>${statusBadge(r.ride_status)}${r.is_pool ? ' <span class="badge badge-pool">POOL</span>' : ''}</td>
                <td>${r.driver_name || (r.ride_status === 'Cancelled' ? '<span style="color:var(--text-muted)">N/A</span>' : '<span style="color:var(--text-muted)">Waiting...</span>')}</td>
                <td>${(r.ride_status === 'Pending' || r.ride_status === 'Ongoing') ? `<button class="btn btn-sm btn-danger" onclick="Passenger.cancelRide(${r.ride_id})">Cancel</button>` : ''}</td>
            </tr>`).join('');
        } catch (err) { console.error(err); }
    },

    showActiveRides(rides) {
        const sec = document.getElementById('activeRideSection');
        sec.style.display = 'block';
        let html = '<div style="display:flex;flex-direction:column;gap:0.85rem">';
        for (const ride of rides) {
            const isOngoing = ride.ride_status === 'Ongoing';
            const borderColor = isOngoing ? 'var(--accent-border)' : 'var(--warning)';
            const dotColor = isOngoing ? 'var(--success)' : 'var(--warning)';
            const label = isOngoing ? 'Ride in Progress' : 'Waiting for Driver';
            html += `<div class="ride-progress" style="border-color:${borderColor}">
                <h3><span class="pulse-dot" style="background:${dotColor}"></span>${label}</h3>
                <div class="ride-detail-row"><span>Ride ID</span><strong>#${ride.ride_id}</strong></div>
                <div class="ride-detail-row"><span>Route</span><strong>${ride.pickup_location} → ${ride.drop_location}</strong></div>
                <div class="ride-detail-row"><span>Fare</span><strong>${ride.fare}</strong></div>
                <div class="ride-detail-row"><span>Driver</span><strong>${ride.driver_name || 'Waiting...'}</strong></div>
                <div class="ride-detail-row"><span>Type</span><strong>${ride.booking_type === 'later' ? 'Scheduled' : 'Instant'}${ride.is_pool ? ' (Pool)' : ''}</strong></div>
                <div style="margin-top:0.6rem"><button class="btn btn-danger btn-sm" onclick="Passenger.cancelRide(${ride.ride_id})">Cancel Ride</button></div>
            </div>`;
        }
        html += '</div>';
        document.getElementById('activeRideContent').innerHTML = html;
        // Show first active ride on map
        const first = rides[0];
        if (first) RideMap.showRideOnMap('passengerMap', first.pickup_location, first.drop_location);
    },



    hideActiveRide() {
        document.getElementById('activeRideSection').style.display = 'none';
    },

    async checkUnratedRides(completedRides) {
        for (const ride of completedRides.slice(0, 5)) {
            try {
                const result = await api.get(`/api/rides/${ride.ride_id}/has-rated?user_id=${currentUser.user_id}`);
                if (!result.rated && ride.driver_user_id) {
                    this.showRatingModal(ride);
                    break;
                }
            } catch (e) { /* skip */ }
        }
    },

    showRatingModal(ride) {
        document.getElementById('ratingRideId').value = ride.ride_id;
        document.getElementById('ratingDriverId').value = ride.driver_user_id;
        document.getElementById('ratingDriverName').textContent = ride.driver_name || 'Your Driver';
        const container = document.getElementById('starRating');
        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            star.setAttribute('viewBox', '0 0 24 24');
            star.setAttribute('class', 'star');
            star.setAttribute('data-value', i);
            star.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>';
            star.onclick = () => {
                container.querySelectorAll('.star').forEach((s, idx) => s.classList.toggle('active', idx < i));
            };
            container.appendChild(star);
        }
        document.getElementById('ratingModal').classList.remove('hidden');
    },

    async submitRating() {
        const rideId = document.getElementById('ratingRideId').value;
        const driverId = document.getElementById('ratingDriverId').value;
        const activeStars = document.querySelectorAll('#starRating .star.active').length;
        if (!activeStars) return showToast('Please select a rating', 'error');
        try {
            await api.post(`/api/rides/${rideId}/rate`, {
                from_user_id: currentUser.user_id, to_user_id: +driverId, stars: activeStars
            });
            document.getElementById('ratingModal').classList.add('hidden');
            showToast(`Rated ${activeStars} stars!`, 'success');
        } catch (err) { showToast(err.message, 'error'); }
    },

    async cancelRide(rideId) {
        try {
            await api.patch(`/api/rides/${rideId}/cancel`, {});
            showToast('Ride cancelled', 'success');
            this.loadMyRides();
            this.loadShareableRides();
        } catch (err) { showToast(err.message, 'error'); }
    },

    async loadShareableRides() {
        try {
            const rides = await api.get('/api/rides/shareable');
            const tbody = document.getElementById('shareableRidesBody');
            const filtered = currentUser ? rides.filter(r => r.passenger_user_id !== currentUser.user_id) : rides;
            if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No pool rides available</td></tr>'; return; }
            tbody.innerHTML = filtered.map(r => `<tr>
                <td><strong>#${r.ride_id}</strong></td>
                <td>${r.pickup_location}</td><td>${r.drop_location}</td>
                <td>${(r.fare / (r.booked_seats + 1)).toFixed(2)}/person</td>
                <td><span class="badge badge-pending">${r.available_seats} left</span></td>
                <td><button class="btn btn-sm btn-primary" onclick="Passenger.joinRide(${r.ride_id})">Join</button></td>
            </tr>`).join('');
        } catch (err) { console.error(err); }
    },

    async joinRide(rideId) {
        try {
            await api.post(`/api/rides/${rideId}/join`, { passenger_user_id: currentUser.user_id });
            showToast(`Joined ride #${rideId}!`, 'success');
            this.loadShareableRides();
            this.loadMyRides();
        } catch (err) { showToast(err.message, 'error'); }
    }
};
