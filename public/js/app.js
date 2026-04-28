/* ============================================
   RideShare — Main Application Controller
   ============================================ */
const API_BASE = '';
let currentUser = null;

// --- API Helper ---
const api = {
    async get(url) { const r = await fetch(API_BASE + url); if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); } return r.json(); },
    async post(url, data) { const r = await fetch(API_BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; },
    async patch(url, data) { const r = await fetch(API_BASE + url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; },
    async del(url) { const r = await fetch(API_BASE + url, { method: 'DELETE' }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; }
};

// --- Toast ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function statusBadge(status) {
    const s = (status || '').toLowerCase();
    return `<span class="badge badge-${s}">${status}</span>`;
}

// --- Auth UI ---
const AuthUI = {
    selectedRole: 'passenger',
    switchTab(tab) {
        document.getElementById('authTabLogin').classList.toggle('active', tab === 'login');
        document.getElementById('authTabRegister').classList.toggle('active', tab === 'register');
        document.getElementById('loginForm').style.display = tab === 'login' ? 'flex' : 'none';
        document.getElementById('registerForm').style.display = tab === 'register' ? 'flex' : 'none';
        document.getElementById('loginError').textContent = '';
        document.getElementById('registerError').textContent = '';
    },
    setRole(role) {
        this.selectedRole = role;
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        event.currentTarget.classList.add('active');
        document.getElementById('driverFields').classList.toggle('show', role === 'driver');
    },
    async login(e) {
        e.preventDefault();
        const name = document.getElementById('loginName').value.trim();
        const phone = document.getElementById('loginPhone').value.trim();
        try {
            const user = await api.post('/api/auth/login', { name, phone });
            currentUser = user;
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            this.enterApp();
        } catch (err) {
            document.getElementById('loginError').textContent = err.message;
        }
    },
    async register(e) {
        e.preventDefault();
        const data = {
            name: document.getElementById('regName').value.trim(),
            phone: document.getElementById('regPhone').value.trim(),
            role: this.selectedRole
        };
        if (this.selectedRole === 'driver') {
            data.license_no = document.getElementById('regLicense').value.trim();
            data.vehicle_type = document.getElementById('regVehicle').value;
            data.registration_no = document.getElementById('regRegNo').value.trim();
        }
        try {
            const user = await api.post('/api/auth/register', data);
            showToast('Account created! Please sign in.', 'success');
            this.switchTab('login');
            document.getElementById('loginName').value = data.name;
            document.getElementById('loginPhone').value = data.phone;
        } catch (err) {
            document.getElementById('registerError').textContent = err.message;
        }
    },
    enterApp() {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appShell').style.display = 'block';
        const role = currentUser.role;
        document.getElementById('panelPassenger').classList.toggle('active', role === 'passenger' || role === 'both');
        document.getElementById('panelDriver').classList.toggle('active', role === 'driver');
        document.getElementById('panelAdmin').classList.toggle('active', role === 'admin');

        if (role === 'passenger' || role === 'both') {
            document.getElementById('passengerGreeting').textContent = `Hello, ${currentUser.name}!`;
            Passenger.init();
        }
        if (role === 'driver') {
            document.getElementById('driverGreeting').textContent = `Hello, ${currentUser.name}!`;
            Driver.init();
        }
        if (role === 'admin') {
            document.getElementById('adminGreeting').textContent = 'Hello, Admin!';
            Admin.init();
        }
        initSSE();
    },
    logout() {
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        document.getElementById('appShell').style.display = 'none';
        document.getElementById('authScreen').style.display = 'flex';
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById('loginForm').reset();
    }
};

// --- SSE ---
function initSSE() {
    const evtSource = new EventSource('/api/events');
    const events = ['rideBooked', 'rideAccepted', 'rideCompleted', 'rideCancelled', 'rideJoined', 'rideRated',
        'passengerRegistered', 'driverRegistered', 'driverDeleted', 'userDeleted',
        'driverStatusChanged', 'zoneAdded', 'timeslotAdded'];
    events.forEach(evt => {
        evtSource.addEventListener(evt, () => {
            if (!currentUser) return;
            const role = currentUser.role;
            if (role === 'passenger' || role === 'both') Passenger.refresh();
            if (role === 'driver') Driver.refresh();
            if (role === 'admin') Admin.refresh();
        });
    });
    evtSource.onerror = () => {
        const el = document.getElementById('connectionStatus');
        if (el) el.textContent = 'Reconnecting...';
    };
    evtSource.onopen = () => {
        const el = document.getElementById('connectionStatus');
        if (el) el.textContent = 'Connected';
    };
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            AuthUI.enterApp();
        } catch (e) { sessionStorage.removeItem('currentUser'); }
    }
});

// --- Profile Modal ---
const ProfileModal = {
    open() {
        if (!currentUser || currentUser.role === 'admin') return;
        document.getElementById('profileModalAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('profileModalName').value = currentUser.name;
        document.getElementById('profileModalPhone').value = currentUser.phone;
        const isDriver = currentUser.role === 'driver' || currentUser.role === 'both';
        document.getElementById('profileDriverFields').style.display = isDriver ? 'block' : 'none';
        if (isDriver) {
            document.getElementById('profileModalLicense').value = currentUser.license_no || '';
            document.getElementById('profileModalVehicle').value = currentUser.vehicle_type || 'Sedan';
        }
        document.getElementById('profileModal').classList.remove('hidden');
    },
    close() { document.getElementById('profileModal').classList.add('hidden'); },
    async save(e) {
        e.preventDefault();
        const name = document.getElementById('profileModalName').value.trim();
        const phone = document.getElementById('profileModalPhone').value.trim();
        try {
            const isDriver = currentUser.role === 'driver' || currentUser.role === 'both';
            let updated;
            if (isDriver) {
                const data = { name, phone,
                    license_no: document.getElementById('profileModalLicense').value.trim(),
                    vehicle_type: document.getElementById('profileModalVehicle').value
                };
                updated = await api.patch(`/api/drivers/${currentUser.user_id}`, data);
            } else {
                updated = await api.patch(`/api/passengers/${currentUser.user_id}`, { name, phone });
            }
            currentUser.name = updated.name || name;
            currentUser.phone = updated.phone || phone;
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            showToast('Profile updated', 'success');
            this.close();
            // Update greetings
            const pg = document.getElementById('passengerGreeting');
            const dg = document.getElementById('driverGreeting');
            if (pg) pg.textContent = `Hello, ${currentUser.name}!`;
            if (dg) dg.textContent = `Hello, ${currentUser.name}!`;
        } catch (err) { showToast(err.message, 'error'); }
    }
};
