// server.js

const path = require('path');
const express = require('express');
const { Pool } = require('pg'); // PostgreSQL client
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer'); // For file uploads

// Configure Multer to store files in the "uploads" folder with the original extension preserved.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname));

// Serve files from the "uploads" folder as static assets.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Trim environment variables to remove accidental spaces
const dbHost = process.env.DB_HOST ? process.env.DB_HOST.trim() : '';
const dbUser = process.env.DB_USER ? process.env.DB_USER.trim() : '';
const dbPassword = process.env.DB_PASSWORD ? process.env.DB_PASSWORD.trim() : '';
const dbName = process.env.DB_NAME ? process.env.DB_NAME.trim() : '';
const dbPort = process.env.DB_PORT ? process.env.DB_PORT.trim() : 5432;

// Debug output for environment variables (mask sensitive data in production)
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

    // Create 'items' table with a "category" column.
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
initializeDatabase();

// ---------------------
// User Registration Endpoint
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
// User Sign-In Endpoint
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
// Post an Ad Endpoint (with file upload using Multer)
// ---------------------
app.post('/post-ad', upload.single('photo'), async (req, res) => {
  const { title, category, description, price } = req.body;
  if (!title || !category || !description || !price) {
    return res.status(400).json({ success: false, error: 'Title, category, description, and price are required' });
  }
  
  // Build image URL if file was uploaded
  let imageUrl = null;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }
  
  try {
    const queryText = `
      INSERT INTO items (title, category, description, price, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const values = [title, category, description, price, imageUrl];
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, message: 'Ad posted successfully!', adId: result.rows[0].id });
  } catch (err) {
    console.error('Error posting ad:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------
// GET Items Endpoint (optionally filtered by category)
// ---------------------
app.get('/items', async (req, res) => {
  try {
    let query = 'SELECT * FROM items';
    let values = [];
    if (req.query.category) {
      query += ' WHERE category = $1';
      values.push(req.query.category);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, values);
    res.json({ success: true, items: result.rows });
  } catch (err) {
    console.error('Error retrieving items:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------
// GET Item Details Endpoint (fetch a single ad by id)
// ---------------------
app.get('/item/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Error retrieving item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------
// Start the Server
// ---------------------
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
