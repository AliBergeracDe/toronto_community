// server.js

const path = require('path');
const express = require('express');
const { Pool } = require('pg');  // PostgreSQL client
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname));

// Trim environment variables to remove accidental spaces
const dbHost = process.env.DB_HOST ? process.env.DB_HOST.trim() : '';
const dbUser = process.env.DB_USER ? process.env.DB_USER.trim() : '';
const dbPassword = process.env.DB_PASSWORD ? process.env.DB_PASSWORD.trim() : '';
const dbName = process.env.DB_NAME ? process.env.DB_NAME.trim() : '';
const dbPort = process.env.DB_PORT ? process.env.DB_PORT.trim() : 5432;

// Debug output for environment variables
console.log('DB_HOST:', dbHost);
console.log('DB_USER:', dbUser);
console.log('DB_NAME:', dbName);
console.log('DB_PORT:', dbPort);

// Create a connection pool for PostgreSQL
const pool = new Pool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  port: dbPort,
});

// Initialize the database tables if they don't exist
async function initializeDatabase() {
  try {
    // Create 'users' table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create 'items' table with a new "category" column
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        user_id INT,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Create 'events' table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255) NOT NULL,
        event_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    console.log('Database tables are ready.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Call the initialization function at startup
initializeDatabase();

// ---------------------
//  User Registration
// ---------------------
app.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const queryText = `
      INSERT INTO users (email, password, name)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const values = [email, hashedPassword, name];
    await pool.query(queryText, values);
    res.status(201).json({ success: true, message: 'User registered successfully!' });
  } catch (err) {
    console.error('Error during registration:', err);
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------
//  User Sign-In
// ---------------------
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ---------------------
//  Post an Ad Endpoint
// ---------------------
// This endpoint accepts a new ad posting. It expects title, category, description, price,
// and optionally image_url (which can be a URL or handled later via file upload middleware).
app.post('/post-ad', async (req, res) => {
  const { title, category, description, price, image_url } = req.body;
  if (!title || !category || !description || !price) {
    return res.status(400).json({ success: false, error: 'Title, category, description, and price are required' });
  }
  try {
    const queryText = `
      INSERT INTO items (title, category, description, price, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const values = [title, category, description, price, image_url || null];
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, message: 'Ad posted successfully!', adId: result.rows[0].id });
  } catch (err) {
    console.error('Error posting ad:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------
//  Start the Server
// ---------------------
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
