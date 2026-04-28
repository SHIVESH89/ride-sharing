/* ============================================
   RideShare — Admin Module
   ============================================ */
const Admin = {
    _bound: false,

    async init() {
        await RideMap.loadZones();
        RideMap.render('adminMap');
        this.loadStats();
        this.loadUsers();
        this.loadAllRides();
        this.loadZones();
        this.loadTimeslots();
        this.loadPayments();
        this.bindEvents();
    },

    refresh() { this.loadStats(); this.loadAllRides(); this.loadPayments(); },

    bindEvents() {
        if (this._bound) return;
        this._bound = true;
        document.getElementById('formAddZone').addEventListener('submit', (e) => { e.preventDefault(); this.addZone(); });
        document.getElementById('formAddTimeslot').addEventListener('submit', (e) => { e.preventDefault(); this.addTimeslot(); });
    },

    async loadStats() {
        try {
            const s = await api.get('/api/stats');
            document.getElementById('statUsers').textContent = s.totalUsers;
            document.getElementById('statDrivers').textContent = s.totalDrivers;
            document.getElementById('statActiveRides').textContent = s.activeRides;
            document.getElementById('statRevenue').textContent = Number(s.totalRevenue).toFixed(0);
        } catch (err) { console.error(err); }
    },

    async loadUsers() {
        try {
            const users = await api.get('/api/users');
            const tbody = document.getElementById('allUsersBody');
            if (!users.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users</td></tr>'; return; }
            tbody.innerHTML = users.map(u => {
                let role = '';
                if (u.is_passenger && u.is_driver) role = '<span class="badge badge-ongoing">Both</span>';
                else if (u.is_passenger) role = '<span class="badge badge-completed">Passenger</span>';
                else if (u.is_driver) role = '<span class="badge badge-pending">Driver</span>';
                else role = '<span class="badge badge-offline">User</span>';
                return `<tr>
                    <td>${u.user_id}</td><td>${u.name}</td><td>${u.phone}</td>
                    <td>${u.trust_score}</td><td>${role}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="Admin.deleteUser(${u.user_id},'${u.name}')">Delete</button></td>
                </tr>`;
            }).join('');
        } catch (err) { console.error(err); }
    },

    async deleteUser(id, name) {
        if (!confirm(`Delete user "${name}"?`)) return;
        try {
            await api.del(`/api/users/${id}`);
            showToast(`User "${name}" deleted`, 'success');
            this.loadUsers(); this.loadStats();
        } catch (err) { showToast(err.message, 'error'); }
    },

    async loadAllRides() {
        try {
            const rides = await api.get('/api/rides');
            const tbody = document.getElementById('allRidesBody');
            if (!rides.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No rides</td></tr>'; return; }
            tbody.innerHTML = rides.map(r => `<tr>
                <td><strong>#${r.ride_id}</strong></td><td>${r.pickup_location}</td><td>${r.drop_location}</td>
                <td>${r.passenger_name}</td><td>${r.driver_name || '--'}</td>
                <td><strong>${r.fare}</strong></td>
                <td>${r.booking_type === 'later' ? 'Scheduled' : 'Instant'}${r.is_pool ? ' <span class="badge badge-pool">POOL</span>' : ''}</td>
                <td>${statusBadge(r.ride_status)}</td>
            </tr>`).join('');
        } catch (err) { console.error(err); }
    },

    async loadZones() {
        try {
            const zones = await api.get('/api/pricing/zones');
            const tbody = document.getElementById('zonesBody');
            if (!zones.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No zones</td></tr>'; return; }
            tbody.innerHTML = zones.map(z => `<tr>
                <td>${z.zone_id}</td><td>${z.zone_name}</td><td>${z.base_fare}</td>
                <td><button class="btn btn-sm btn-danger" onclick="Admin.deleteZone(${z.zone_id})">Del</button></td>
            </tr>`).join('');
        } catch (err) { console.error(err); }
    },

    async addZone() {
        const zone_name = document.getElementById('addZoneName').value.trim();
        const base_fare = document.getElementById('addZoneFare').value;
        if (!zone_name || !base_fare) return showToast('Fill zone fields', 'error');
        try {
            await api.post('/api/pricing/zones', { zone_name, base_fare: +base_fare });
            showToast(`Zone "${zone_name}" added`, 'success');
            document.getElementById('formAddZone').reset();
            this.loadZones();
            RideMap.loadZones().then(() => RideMap.render('adminMap'));
        } catch (err) { showToast(err.message, 'error'); }
    },

    async deleteZone(id) {
        try { await api.del(`/api/pricing/zones/${id}`); showToast('Zone deleted', 'success'); this.loadZones(); }
        catch (err) { showToast(err.message, 'error'); }
    },

    async loadTimeslots() {
        try {
            const slots = await api.get('/api/pricing/timeslots');
            const tbody = document.getElementById('timeslotsBody');
            if (!slots.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No slots</td></tr>'; return; }
            tbody.innerHTML = slots.map(s => `<tr>
                <td>${s.timeslot_id}</td><td>${s.start_time}</td><td>${s.end_time}</td>
                <td><strong>x${s.surge_multiplier}</strong></td>
                <td><button class="btn btn-sm btn-danger" onclick="Admin.deleteTimeslot(${s.timeslot_id})">Del</button></td>
            </tr>`).join('');
        } catch (err) { console.error(err); }
    },

    async addTimeslot() {
        const start_time = document.getElementById('addTsStart').value;
        const end_time = document.getElementById('addTsEnd').value;
        const surge_multiplier = document.getElementById('addTsMultiplier').value;
        if (!start_time || !end_time || !surge_multiplier) return showToast('Fill all fields', 'error');
        try {
            await api.post('/api/pricing/timeslots', { start_time, end_time, surge_multiplier: +surge_multiplier });
            showToast('Time slot added', 'success');
            document.getElementById('formAddTimeslot').reset();
            this.loadTimeslots();
        } catch (err) { showToast(err.message, 'error'); }
    },

    async deleteTimeslot(id) {
        try { await api.del(`/api/pricing/timeslots/${id}`); showToast('Slot deleted', 'success'); this.loadTimeslots(); }
        catch (err) { showToast(err.message, 'error'); }
    },

    async loadPayments() {
        try {
            const payments = await api.get('/api/payments');
            const tbody = document.getElementById('allPaymentsBody');
            if (!payments.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No payments</td></tr>'; return; }
            tbody.innerHTML = payments.map(p => `<tr>
                <td>${p.payment_id}</td><td>#${p.ride_id}</td><td>${p.passenger_name || '--'}</td>
                <td><strong>${p.amount}</strong></td><td>${p.payment_mode}</td>
            </tr>`).join('');
        } catch (err) { console.error(err); }
    },

    // --- Schema Modal ---
    async openSchemaModal() {
        document.getElementById('schemaModal').classList.remove('hidden');
        try {
            const [tables, relationships] = await Promise.all([
                api.get('/api/schema/tables'),
                api.get('/api/schema/relationships')
            ]);
            const tableInfos = [];
            for (const name of tables) {
                const info = await api.get(`/api/schema/tables/${name}`);
                tableInfos.push(info);
            }
            this.renderERDiagram(tableInfos, relationships);
        } catch (err) { console.error('DB Vis error:', err); }
    },

    closeSchemaModal() {
        document.getElementById('schemaModal').classList.add('hidden');
    },

    renderERDiagram(tables, relationships) {
        const container = document.getElementById('dbVisSvg');
        const W = 1100, H = 700;
        // Spread tables more to avoid overlap — especially Ride/Ride_Passenger
        const positions = {
            'User': {x:30,y:20}, 'Passenger': {x:10,y:260}, 'Driver': {x:210,y:260},
            'Vehicle': {x:210,y:480}, 'Surge_Zone': {x:420,y:20}, 'Time_Slot': {x:680,y:20},
            'Ride': {x:440,y:230}, 'Ride_Passenger': {x:440,y:500}, 'Payment': {x:750,y:500},
            'Rating': {x:900,y:230}
        };
        let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#FAFAF7">`;
        // Relationship lines
        for (const rel of relationships) {
            const from = positions[rel.from_table];
            const to = positions[rel.to_table];
            if (from && to) {
                const tw = 160;
                svg += `<line class="db-relation-line" x1="${from.x+tw/2}" y1="${from.y+30}" x2="${to.x+tw/2}" y2="${to.y+30}"/>`;
            }
        }
        // Tables
        for (const t of tables) {
            const pos = positions[t.name] || {x:10, y:10};
            const tw = 160;
            const rowH = 16;
            const headerH = 24;
            const th = headerH + t.columns.length * rowH + 6;
            svg += `<g class="db-table-box" onclick="Admin.showTableData('${t.name}')">`;
            svg += `<rect x="${pos.x}" y="${pos.y}" width="${tw}" height="${th}" rx="6" fill="white" stroke="#D8C4B6" stroke-width="1"/>`;
            svg += `<rect x="${pos.x}" y="${pos.y}" width="${tw}" height="${headerH}" rx="6" fill="#213555"/>`;
            svg += `<rect x="${pos.x}" y="${pos.y+18}" width="${tw}" height="6" fill="#213555"/>`;
            svg += `<text class="db-table-header" x="${pos.x+tw/2}" y="${pos.y+16}" text-anchor="middle">${t.name}</text>`;
            t.columns.forEach((col, i) => {
                const cy = pos.y + headerH + 4 + i * rowH + 11;
                const cls = col.pk ? 'db-table-col db-table-col-pk' : 'db-table-col';
                svg += `<text class="${cls}" x="${pos.x+8}" y="${cy}">${col.pk ? 'PK ' : ''}${col.name} <tspan fill="#8B7E74">${col.type || ''}</tspan></text>`;
            });
            svg += `</g>`;
        }
        svg += `</svg>`;
        container.innerHTML = svg;
    },

    async showTableData(tableName) {
        try {
            const rows = await api.get(`/api/schema/tables/${tableName}/data`);
            const container = document.getElementById('dbTableData');
            if (!rows.length) { container.innerHTML = `<p style="color:var(--text-muted);padding:0.5rem">Table "${tableName}" is empty</p>`; return; }
            const cols = Object.keys(rows[0]);
            let html = `<div class="card-header"><h2>${tableName} Data</h2><span class="card-badge">${rows.length} rows</span></div>`;
            html += '<div class="table-wrap"><table class="data-table"><thead><tr>';
            cols.forEach(c => html += `<th>${c}</th>`);
            html += '</tr></thead><tbody>';
            rows.forEach(r => {
                html += '<tr>';
                cols.forEach(c => html += `<td>${r[c] !== null && r[c] !== undefined ? r[c] : '--'}</td>`);
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } catch (err) { showToast(err.message, 'error'); }
    }
};
