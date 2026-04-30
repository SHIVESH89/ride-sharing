# **RideShare — Dynamic Pricing & Ride Management System**

## **Description**
RideShare is a comprehensive, full-stack ride management platform built to simulate real-world ride-hailing economics. It features a robust dynamic surge pricing engine, interactive map routing, carpooling logic, and role-based access control. The application provides dedicated, real-time dashboards for Passengers, Drivers, and Administrators, all backed by a lightweight, embedded SQLite database. This system effectively demonstrates complex relational data management, real-time status updates, and dynamic fare calculation based on location zones and time slots.

## **Key Features**
* **Dynamic Surge Pricing:** Fares are calculated in real-time using a combination of base zone rates and time-based surge multipliers.
* **Role-Based Dashboards:** Distinct user interfaces and capabilities for Passengers, Drivers, and Admins.
* **Interactive Mapping:** Integrated Leaflet.js maps for visual route plotting, zone identification, and live ride tracking.
* **Carpooling (Pool Rides):** Shared ride logic allowing multiple passengers to split fares while respecting vehicle seat limits.
* **Scheduled Booking:** Options for instant "Book Now" rides or "Book Later" scheduled time slots.
* **Live Database Visualization:** An interactive ER diagram generator built directly into the Admin dashboard to view schema relationships and live table data.

## **User Roles & Capabilities**
* **Passenger:** Can request solo or pool rides, schedule rides in advance, preview dynamic fares, view active ride progress on the map, and rate drivers.
* **Driver:** Can toggle availability status, view incoming ride requests (filtered by their vehicle type and rating), accept/complete rides, and track earnings.
* **Admin:** Has full system oversight. Can monitor total revenue, manage users, adjust dynamic pricing parameters (Surge Zones and Time Slots), and interact with the database visually.

## **Technology Stack**
* **Frontend:** HTML5, CSS3 (Custom responsive styling, CSS Grid/Flexbox), Vanilla JavaScript.
* **Map Integration:** Leaflet.js with OpenStreetMap tiles.
* **Backend / Database Management:** Node.js environment utilizing `sql.js` for an embedded SQLite database.
* **Data Persistence:** File-based SQLite database.

## **Project Structure & Files**
* **`index.html`**: The main application shell containing all modal overlays, authentication screens, and role-specific dashboard layouts.
* **`style.css`**: The custom theme definitions, animations, map styling, and responsive media queries.
* **`app.js`**: Core application controller handling API requests, authentication state, Server-Sent Events (SSE) for live updates, and global UI elements (toasts, modals).
* **`map.js`**: Leaflet map configurations, custom zone markers, coordinate mapping, and route drawing logic.
* **`passenger.js`**: Passenger-specific logic including fare calculation, ride booking, pool joining, and active ride tracking.
* **`driver.js`**: Driver-specific logic for managing availability status, filtering pending rides, and completing trips.
* **`admin.js`**: Administrator dashboard logic for system statistics, user management, pricing adjustments, and rendering the SVG-based database ER diagram.
* **`db.js`**: The backend database interface using `sql.js`, handling file read/write operations and transaction management.
* **`schema.sql`**: The structural blueprint of the SQLite database, defining tables, foreign key relationships, constraints, and initial seed data.
* **`ridesharing.db`**: The binary SQLite database file storing persistent application data.

## **Database Schema & Management**
The system operates on a highly relational SQLite schema. Key tables include:
* **User / Passenger / Driver:** Inheritance-style relationship managing user roles, credentials, and trust scores.
* **Ride / Ride_Passenger:** Manages individual trips and junction data for carpool fare splitting.
* **Surge_Zone / Time_Slot:** Core tables dictating the dynamic pricing algorithm based on pickup location base fares and current time multipliers.
* **Vehicle / Payment / Rating:** Supplementary tables for fleet management, transaction tracking, and driver feedback.

   ```bash
   npm install sql.js
