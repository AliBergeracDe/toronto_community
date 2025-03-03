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
app.use(express.static('static'));

// MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'ebesininami',
    database: process.env.DB_NAME || 'toronto_community'
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL');
});

// User registration
app.post('/register', (req, res) => {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) return res.status(500).json({ success: false, error: 'Error hashing password' });

        db.query(
            'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
            [email, hashedPassword, name],
            (err, result) => {
                if (err) {
                    console.error("db.query error: ", err);  // Log the actual error
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ success: false, error: 'Email already exists' });
                    }
                    return res.status(500).json({ success: false, error: err.message });
                }

                console.log("db.query result: ", result); // Log the result
                res.status(201).json({ success: true, message: 'User registered successfully!' });
            }
        );
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
