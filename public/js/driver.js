/* ============================================
   RideShare — Driver Module
   ============================================ */
const Driver = {
    _bound: false,
    driverInfo: null,

    async init() {
        await RideMap.loadZones();
        RideMap.render('driverMap');
        await this.loadDriverInfo();
        this.loadPendingRides();
        this.loadDriverRides();
        this.bindEvents();
    },

    refresh() {
        this.loadDriverInfo();
        this.loadPendingRides();
        this.loadDriverRides();
    },

    bindEvents() {
        if (this._bound) return;
        this._bound = true;
    },

    async loadDriverInfo() {
        try {
            const drivers = await api.get('/api/drivers');
            const d = drivers.find(x => x.user_id === currentUser.user_id);
            if (d) {
                this.driverInfo = d;
                document.getElementById('driverAvatar').textContent = d.name.charAt(0).toUpperCase();
                document.getElementById('driverInfoName').textContent = d.name;
                document.getElementById('driverInfoVehicle').textContent = `${d.vehicle_type || '--'} | ${d.registration_no || '--'}`;
                document.getElementById('driverInfoRating').textContent = d.rating ? parseFloat(d.rating).toFixed(1) + '/5' : '--';
                document.getElementById('driverInfoStatus').innerHTML = statusBadge(d.status);
                document.getElementById('driverInfoLicense').textContent = d.license_no || '--';
            }
        } catch (err) { console.error(err); }
    },

    async setStatus(status) {
        try {
            await api.patch(`/api/drivers/${currentUser.user_id}/status`, { status });
            showToast(`Status: ${status}`, 'success');
            this.loadDriverInfo();
            this.loadPendingRides();
        } catch (err) { showToast(err.message, 'error'); }
    },

    async loadPendingRides() {
        try {
            const rides = await api.get('/api/rides?status=Pending');
            const tbody = document.getElementById('pendingRidesBody');
            if (!rides.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No pending rides</td></tr>'; return; }

            const myRating = this.driverInfo ? parseFloat(this.driverInfo.rating) : 0;
            const myVehicle = this.driverInfo ? this.driverInfo.vehicle_type : '';

            tbody.innerHTML = rides.map(r => {
                const ratingTooLow = myRating < r.min_driver_rating;
                const wrongVehicle = r.vehicle_type_filter && r.vehicle_type_filter !== 'ANY' && r.vehicle_type_filter !== myVehicle;
                const poolNotFull = r.is_pool && r.booked_seats < r.max_seats;
                const canAccept = !ratingTooLow && !wrongVehicle && !poolNotFull;
                const rowClass = canAccept ? '' : 'greyed-out';
                let disableReason = '';
                if (ratingTooLow) disableReason = `Rating ${myRating} < ${r.min_driver_rating}`;
                else if (wrongVehicle) disableReason = `Needs ${r.vehicle_type_filter}`;
                else if (poolNotFull) disableReason = `Pool: ${r.booked_seats}/${r.max_seats}`;

                return `<tr class="${rowClass}" onclick="Driver.previewRide('${r.pickup_location}','${r.drop_location}')" style="cursor:pointer">
                    <td><strong>#${r.ride_id}</strong></td>
                    <td>${r.pickup_location}</td><td>${r.drop_location}</td>
                    <td><strong>${r.fare}</strong></td>
                    <td>${r.is_pool ? '<span class="badge badge-pool">POOL</span>' : 'Solo'}${r.booking_type === 'later' ? ' <span class="badge badge-pending">Later</span>' : ''}</td>
                    <td>${r.min_driver_rating}+</td>
                    <td>${r.vehicle_type_filter || 'ANY'}</td>
                    <td>${canAccept
                        ? `<button class="btn btn-sm btn-success" onclick="event.stopPropagation();Driver.acceptRide(${r.ride_id})">Accept</button>`
                        : `<span style="font-size:0.72rem;color:var(--danger)">${disableReason}</span>`
                    }</td>
                </tr>`;
            }).join('');
        } catch (err) { console.error(err); }
    },

    previewRide(pickup, drop) {
        RideMap.showRideOnMap('driverMap', pickup, drop);
    },

    async acceptRide(rideId) {
        try {
            await api.patch(`/api/rides/${rideId}/accept`, { driver_user_id: currentUser.user_id });
            showToast(`Ride #${rideId} accepted!`, 'success');
            this.loadPendingRides();
            this.loadDriverRides();
            this.loadDriverInfo();
        } catch (err) { showToast(err.message, 'error'); }
    },

    async completeRide(rideId) {
        try {
            await api.patch(`/api/rides/${rideId}/complete`, { payment_mode: 'UPI' });
            showToast(`Ride #${rideId} completed!`, 'success');
            // Refresh everything so pending rides update
            this.loadDriverRides();
            this.loadPendingRides();
            this.loadDriverInfo();
            RideMap.clearHighlights('driverMap');
        } catch (err) { showToast(err.message, 'error'); }
    },

    async loadDriverRides() {
        try {
            const rides = await api.get(`/api/rides?driver_id=${currentUser.user_id}`);
            const tbody = document.getElementById('driverRidesBody');
            if (!rides.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No ride history</td></tr>'; return; }
            tbody.innerHTML = rides.map(r => `<tr onclick="Driver.previewRide('${r.pickup_location}','${r.drop_location}')" style="cursor:pointer">
                <td><strong>#${r.ride_id}</strong></td>
                <td>${r.pickup_location}</td><td>${r.drop_location}</td>
                <td>${r.passenger_name}</td><td><strong>${r.fare}</strong></td>
                <td>${statusBadge(r.ride_status)}</td>
                <td>${r.ride_status === 'Ongoing' ? `<button class="btn btn-sm btn-accent" onclick="event.stopPropagation();Driver.completeRide(${r.ride_id})">Complete</button>` : '--'}</td>
            </tr>`).join('');
        } catch (err) { console.error(err); }
    }
};
