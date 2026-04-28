/* ============================================
   RideShare — Leaflet Map with Real Tiles
   Dark theme tiles + fake location overlays
   ============================================ */
const RideMap = {
    zones: [],
    _maps: {},      // Leaflet map instances
    _markers: {},   // zone markers per map
    _routeLine: {}, // route polyline per map

    // Fake locations mapped to real-ish Chennai coordinates
    COORDS: {
        'City Center':      [13.0827, 80.2707],
        'Airport Road':     [12.9841, 80.1759],
        'Tech Park':        [12.9616, 80.2492],
        'University Area':  [13.0108, 80.2354],
        'SRM Gate':         [12.8731, 80.0521],
        'Tambaram Station': [12.9249, 80.1300],
        'Central Mall':     [13.0604, 80.2526],
        'Railway Junction': [13.0732, 80.2109],
        'Bus Terminal':     [13.0694, 80.2025],
        'Hospital Road':    [13.0487, 80.2785]
    },

    async loadZones() {
        try { this.zones = await api.get('/api/pricing/zones'); } catch (e) { this.zones = []; }
    },

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Destroy existing map if re-rendering
        if (this._maps[containerId]) {
            this._maps[containerId].remove();
            delete this._maps[containerId];
        }

        // Create Leaflet map
        const map = L.map(containerId, {
            center: [13.00, 80.18],
            zoom: 11,
            zoomControl: true,
            attributionControl: false
        });

        // Standard OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18
        }).addTo(map);

        // Attribution (small)
        L.control.attribution({ position: 'bottomright', prefix: false })
            .addAttribution('<a href="https://www.openstreetmap.org/copyright" style="color:#666;font-size:9px">OSM</a>')
            .addTo(map);

        this._maps[containerId] = map;
        this._markers[containerId] = {};

        // Add zone markers
        for (const zone of this.zones) {
            const coords = this.COORDS[zone.zone_name];
            if (!coords) continue;

            // Custom div icon with zone name + fare
            const icon = L.divIcon({
                className: 'zone-marker',
                html: `<div class="zone-marker-inner" data-zone="${zone.zone_name}">
                    <div class="zone-marker-name">${zone.zone_name}</div>
                    <div class="zone-marker-fare">Base: ${zone.base_fare}</div>
                </div>`,
                iconSize: [100, 40],
                iconAnchor: [50, 20]
            });

            const marker = L.marker(coords, { icon }).addTo(map);
            marker.on('click', () => this.onZoneClick(containerId, zone.zone_name, zone.zone_id));
            this._markers[containerId][zone.zone_name] = marker;
        }

        // Fit bounds to show all markers
        const allCoords = this.zones.map(z => this.COORDS[z.zone_name]).filter(Boolean);
        if (allCoords.length > 1) {
            map.fitBounds(allCoords, { padding: [30, 30] });
        }
    },

    highlightZone(containerId, zoneName, type) {
        const marker = this._markers[containerId]?.[zoneName];
        if (!marker) return;
        const el = marker.getElement();
        if (el) {
            const inner = el.querySelector('.zone-marker-inner');
            if (inner) inner.classList.add(type);
        }
    },

    clearHighlights(containerId) {
        const markers = this._markers[containerId];
        if (!markers) return;
        for (const name in markers) {
            const el = markers[name].getElement();
            if (el) {
                const inner = el.querySelector('.zone-marker-inner');
                if (inner) inner.classList.remove('pickup', 'dropoff');
            }
        }
        // Remove route line
        if (this._routeLine[containerId]) {
            this._maps[containerId].removeLayer(this._routeLine[containerId]);
            delete this._routeLine[containerId];
        }
    },

    drawRoute(containerId, pickupName, dropName) {
        const map = this._maps[containerId];
        if (!map) return;
        const ca = this.COORDS[pickupName], cb = this.COORDS[dropName];
        if (!ca || !cb) return;

        // Remove old route
        if (this._routeLine[containerId]) {
            map.removeLayer(this._routeLine[containerId]);
        }

        this._routeLine[containerId] = L.polyline([ca, cb], {
            color: '#E8725C',
            weight: 3,
            dashArray: '8 5',
            opacity: 0.85
        }).addTo(map);
    },

    showRideOnMap(containerId, pickup, drop) {
        this.clearHighlights(containerId);
        this.highlightZone(containerId, pickup, 'pickup');
        this.highlightZone(containerId, drop, 'dropoff');
        this.drawRoute(containerId, pickup, drop);
    },

    onZoneClick(containerId, zoneName, zoneId) {
        if (containerId === 'passengerMap') {
            const pickupSel = document.getElementById('bookPickup');
            const dropSel = document.getElementById('bookDrop');
            if (pickupSel && pickupSel.value !== zoneName) {
                pickupSel.value = zoneName;
                pickupSel.dispatchEvent(new Event('change'));
            } else if (dropSel) {
                dropSel.value = zoneName;
                dropSel.dispatchEvent(new Event('change'));
            }
        }
        if (containerId === 'driverMap') {
            this.clearHighlights(containerId);
            this.highlightZone(containerId, zoneName, 'pickup');
        }
    }
};
