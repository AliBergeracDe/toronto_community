const path = require('path');
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');

// Create the Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname));

// MySQL connection
let db; // Declare db outside the connect function
try {
    db = mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'ebesininami',
        database: process.env.DB_NAME || 'toronto_community'
    });
} catch (dbCreationError) {
    console.error('Error creating database connection:', dbCreationError);
    process.exit(1);
}

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL');
    // Initialize database tables if they don't exist
    initializeDatabase();
});

// Create database tables if they don't exist
function initializeDatabase() {
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const createItemsTable = `
        CREATE TABLE IF NOT EXISTS items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10, 2) NOT NULL,
            image_url VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `;

    const createEventsTable = `
        CREATE TABLE IF NOT EXISTS events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            location VARCHAR(255) NOT NULL,
            event_date DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `;

    db.query(createUsersTable, (err) => {
        if (err) console.error('Error creating users table:', err);
        else console.log('Users table ready');
    });

    db.query(createItemsTable, (err) => {
        if (err) console.error('Error creating items table:', err);
        else console.log('Items table ready');
    });

    db.query(createEventsTable, (err) => {
        if (err) console.error('Error creating events table:', err);
        else console.log('Events table ready');
    });
}

// User registration
app.post('/register', (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error("Bcrypt hashing error:", err);
            return res.status(500).json({ success: false, error: 'Error hashing password' });
        }

        db.query(
            'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
            [email, hashedPassword, name],
            (err, result) => {
                if (err) {
                    console.error("MySQL query error:", err);
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ success: false, error: 'Email already exists' });
                    }
                    return res.status(500).json({ success: false, error: err.message });
                }
                console.log("Registration successful, user ID:", result.insertId);
                res.status(201).json({ success: true, message: 'User registered successfully!' });
            }
        );
    });
});

// User sign-in
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error("DB error during login:", err);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        
        const user = results[0];
        
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error("Bcrypt compare error:", err);
                return res.status(500).json({ success: false, error: 'Error during password verification' });
            }
            
            if (!isMatch) {
                return res.status(401).json({ success: false, error: 'Invalid email or password' });
            }
            
            res.json({ success: true, message: 'Login successful!', user: { id: user.id, email: user.email, name: user.name } });
        });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
