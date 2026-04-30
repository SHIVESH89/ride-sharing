# **RideShare — Dynamic Pricing & Ride Management System**

## **Description**
RideShare is a comprehensive, full-stack ride management platform built to simulate real-world ride-hailing economics. It features a robust dynamic surge pricing engine, interactive map routing, carpooling logic, and role-based access control. The application provides dedicated, real-time dashboards for Passengers, Drivers, and Administrators, all backed by a robust **MySQL database** and an **Express.js API**. This system effectively demonstrates complex relational data management, asynchronous API routing, real-time status updates, and dynamic fare calculation based on location zones and time slots.

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
* **Backend API:** Node.js with Express.js for RESTful routing and API endpoints.
* **Database Management:** MySQL utilizing the `mysql2/promise` driver for asynchronous database connection pooling.
* **Data Persistence:** MySQL Relational Database Management System.

## **Project Structure & Files**
* **`public/index.html`**: The main application shell containing all modal overlays, authentication screens, and role-specific dashboard layouts.
* **`public/style.css`**: The custom theme definitions, animations, map styling, and responsive media queries.
* **`public/app.js`**: Core frontend controller handling API requests, authentication state, Server-Sent Events (SSE) for live updates, and global UI elements (toasts, modals).
* **`api/index.js`**: The main Express server entry point that initializes the database and starts the API server.
* **`routes/`**: Directory containing all modular Express API route handlers (e.g., `passengers.js`, `drivers.js`, `rides.js`).
* **`database/db.js`**: The backend database interface using `mysql2/promise`, handling connection pooling, async queries, and transaction management.
* **`database/schema.sql`**: The structural blueprint of the MySQL database, defining tables, foreign key relationships, constraints, and initial seed data.

## **Database Schema & Management**
The system operates on a highly relational **MySQL** schema. Key tables include:
* **User / Passenger / Driver:** Inheritance-style relationship managing user roles, credentials, and trust scores.
* **Ride / Ride_Passenger:** Manages individual trips and junction data for carpool fare splitting.
* **Surge_Zone / Time_Slot:** Core tables dictating the dynamic pricing algorithm based on pickup location base fares and current time multipliers.
* **Vehicle / Payment / Rating:** Supplementary tables for fleet management, transaction tracking, and driver feedback.
