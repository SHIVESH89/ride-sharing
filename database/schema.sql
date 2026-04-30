-- ============================================
-- Ride Sharing System with Dynamic Pricing
-- Database Schema (MySQL) — v2.0
-- ============================================

-- USER Table
CREATE TABLE IF NOT EXISTS User (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL UNIQUE,
    trust_score INT NOT NULL DEFAULT 5
);

-- PASSENGER Table
CREATE TABLE IF NOT EXISTS Passenger (
    user_id INT PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- DRIVER Table
CREATE TABLE IF NOT EXISTS Driver (
    user_id INT PRIMARY KEY,
    license_no VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'Available',
    rating DECIMAL(3,2) NOT NULL DEFAULT 4.00,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- VEHICLE Table
CREATE TABLE IF NOT EXISTS Vehicle (
    vehicle_id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_type VARCHAR(50) NOT NULL,
    registration_no VARCHAR(50) NOT NULL UNIQUE,
    driver_user_id INT NOT NULL,
    FOREIGN KEY (driver_user_id) REFERENCES Driver(user_id) ON DELETE CASCADE
);

-- SURGE_ZONE Table
CREATE TABLE IF NOT EXISTS Surge_Zone (
    zone_id INT PRIMARY KEY AUTO_INCREMENT,
    zone_name VARCHAR(100) NOT NULL,
    base_fare DECIMAL(8,2) NOT NULL
);

-- TIME_SLOT Table
CREATE TABLE IF NOT EXISTS Time_Slot (
    timeslot_id INT PRIMARY KEY AUTO_INCREMENT,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    surge_multiplier DECIMAL(4,2) NOT NULL
);

-- RIDE Table
CREATE TABLE IF NOT EXISTS Ride (
    ride_id INT PRIMARY KEY AUTO_INCREMENT,
    pickup_location VARCHAR(150) NOT NULL,
    drop_location VARCHAR(150) NOT NULL,
    ride_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    fare DECIMAL(8,2) NOT NULL DEFAULT 0,
    max_seats INT NOT NULL DEFAULT 4,
    booked_seats INT NOT NULL DEFAULT 1,
    booking_type VARCHAR(10) NOT NULL DEFAULT 'now',
    scheduled_time VARCHAR(50) DEFAULT NULL,
    is_pool TINYINT(1) NOT NULL DEFAULT 0,
    min_driver_rating DECIMAL(3,2) NOT NULL DEFAULT 3.00,
    vehicle_type_filter VARCHAR(50) DEFAULT 'ANY',
    passenger_user_id INT NOT NULL,
    driver_user_id INT DEFAULT NULL,
    zone_id INT NOT NULL,
    timeslot_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (passenger_user_id) REFERENCES Passenger(user_id),
    FOREIGN KEY (driver_user_id) REFERENCES Driver(user_id),
    FOREIGN KEY (zone_id) REFERENCES Surge_Zone(zone_id),
    FOREIGN KEY (timeslot_id) REFERENCES Time_Slot(timeslot_id)
);

-- RIDE_PASSENGER Table (carpooling junction)
CREATE TABLE IF NOT EXISTS Ride_Passenger (
    ride_id INT NOT NULL,
    passenger_user_id INT NOT NULL,
    fare_share DECIMAL(8,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (ride_id, passenger_user_id),
    FOREIGN KEY (ride_id) REFERENCES Ride(ride_id) ON DELETE CASCADE,
    FOREIGN KEY (passenger_user_id) REFERENCES Passenger(user_id)
);

-- PAYMENT Table
CREATE TABLE IF NOT EXISTS Payment (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    amount DECIMAL(8,2) NOT NULL,
    payment_mode VARCHAR(30) NOT NULL,
    ride_id INT NOT NULL,
    passenger_user_id INT DEFAULT NULL,
    FOREIGN KEY (ride_id) REFERENCES Ride(ride_id),
    FOREIGN KEY (passenger_user_id) REFERENCES Passenger(user_id)
);

-- RATING Table
CREATE TABLE IF NOT EXISTS Rating (
    rating_id INT PRIMARY KEY AUTO_INCREMENT,
    ride_id INT NOT NULL,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    stars INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES Ride(ride_id),
    FOREIGN KEY (from_user_id) REFERENCES User(user_id),
    FOREIGN KEY (to_user_id) REFERENCES User(user_id)
);

-- ============================================
-- Seed Data
-- ============================================

INSERT IGNORE INTO User (user_id, name, phone, trust_score) VALUES
(1, 'Rohit Kumar', '9876543210', 8),
(2, 'Neha Singh', '9123456789', 7),
(3, 'Arjun Patel', '9012345678', 9),
(4, 'Ananya Roy', '9988776655', 8),
(5, 'Vikram Singh', '9871234567', 7),
(6, 'Priya Nair', '9123987654', 9),
(7, 'Rahul Sharma', '9001122334', 8),
(8, 'Sneha Gupta', '9098765432', 6);

INSERT IGNORE INTO Passenger (user_id) VALUES (1),(2),(4),(5),(6);

INSERT IGNORE INTO Driver (user_id, license_no, status, rating) VALUES
(3, 'DL-4567890', 'Available', 4.60),
(7, 'DL-7891234', 'Available', 4.40),
(8, 'DL-6543210', 'Available', 4.20);

INSERT IGNORE INTO Vehicle (vehicle_id, vehicle_type, registration_no, driver_user_id) VALUES
(101, 'Sedan', 'TN09AB4567', 3),
(102, 'SUV', 'TN10CD5678', 7),
(103, 'Hatchback', 'TN11EF9012', 8);

INSERT IGNORE INTO Surge_Zone (zone_id, zone_name, base_fare) VALUES
(1, 'City Center', 80.00),
(2, 'Airport Road', 120.00),
(3, 'Tech Park', 150.00),
(4, 'University Area', 90.00),
(5, 'SRM Gate', 70.00),
(6, 'Tambaram Station', 85.00),
(7, 'Central Mall', 95.00),
(8, 'Railway Junction', 100.00),
(9, 'Bus Terminal', 75.00),
(10, 'Hospital Road', 110.00);

INSERT IGNORE INTO Time_Slot (timeslot_id, start_time, end_time, surge_multiplier) VALUES
(1,  '00:00', '02:00', 1.0),
(2,  '02:00', '04:00', 1.0),
(3,  '04:00', '06:00', 1.1),
(4,  '06:00', '08:00', 1.3),
(5,  '08:00', '10:00', 1.5),
(6,  '10:00', '12:00', 1.2),
(7,  '12:00', '14:00', 1.2),
(8,  '14:00', '16:00', 1.1),
(9,  '16:00', '18:00', 1.3),
(10, '18:00', '20:00', 2.0),
(11, '20:00', '22:00', 1.5),
(12, '22:00', '00:00', 1.8);

INSERT IGNORE INTO Ride (ride_id, pickup_location, drop_location, ride_status, fare, max_seats, booked_seats, booking_type, is_pool, min_driver_rating, vehicle_type_filter, passenger_user_id, driver_user_id, zone_id, timeslot_id) VALUES
(5001, 'SRM Gate', 'Tambaram Station', 'Completed', 140.00, 4, 1, 'now', 0, 3.0, 'ANY', 1, 3, 5, 10),
(5002, 'City Center', 'Tech Park', 'Completed', 120.00, 4, 1, 'now', 0, 3.0, 'ANY', 4, 7, 1, 5),
(5003, 'University Area', 'Airport Road', 'Completed', 180.00, 4, 1, 'now', 0, 3.0, 'ANY', 5, 3, 4, 10),
(5004, 'Tech Park', 'City Center', 'Completed', 180.00, 4, 1, 'now', 0, 3.0, 'ANY', 6, 8, 3, 7),
(5005, 'Airport Road', 'City Center', 'Completed', 240.00, 4, 1, 'now', 0, 3.0, 'ANY', 2, 7, 2, 10);

INSERT IGNORE INTO Ride_Passenger (ride_id, passenger_user_id, fare_share) VALUES
(5001, 1, 140.00),(5002, 4, 120.00),(5003, 5, 180.00),(5004, 6, 180.00),(5005, 2, 240.00);

INSERT IGNORE INTO Payment (payment_id, amount, payment_mode, ride_id, passenger_user_id) VALUES
(9001, 140.00, 'UPI',  5001, 1),
(9002, 120.00, 'Card', 5002, 4),
(9003, 180.00, 'Cash', 5003, 5),
(9004, 180.00, 'UPI',  5004, 6),
(9005, 240.00, 'Card', 5005, 2);

INSERT IGNORE INTO Rating (rating_id, ride_id, from_user_id, to_user_id, stars) VALUES
(1, 5001, 1, 3, 4),
(2, 5002, 4, 7, 5),
(3, 5003, 5, 3, 4),
(4, 5004, 6, 8, 3),
(5, 5005, 2, 7, 5);
