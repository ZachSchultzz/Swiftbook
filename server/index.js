const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
let db;

async function connectToMongo() {
  try {
    await client.connect();
    db = client.db('swiftbook');
    console.log('Connected to MongoDB');
    await db.command({ ping: 1 });
    console.log('MongoDB ping successful');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Stack trace:', err.stack);
    throw err;
  }
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

async function startServer() {
  app.get('/api', (req, res) => {
    res.send('SwiftBook API is running');
  });

  app.post('/api/business', async (req, res) => {
    console.log('Received POST request to /api/business');
    console.log('Request body:', req.body);

    const { name } = req.body;
    if (!name) {
      console.log('Missing business name');
      return res.status(400).json({ message: 'Business name is required' });
    }

    try {
      console.log('Attempting to insert business into MongoDB');
      const business = { name, createdAt: new Date() };
      if (!db) {
        console.error('Database not initialized');
        return res.status(500).json({ message: 'Database not initialized' });
      }
      console.log('Database connection status:', db ? 'Connected' : 'Not connected');
      console.log('Inserting business:', business);
      const result = await db.collection('businesses').insertOne(business);
      console.log('Business inserted successfully:', result.insertedId);
      res.status(201).json({ message: 'Business created', businessId: result.insertedId });
      console.log('Response sent for /api/business');
    } catch (err) {
      console.error('Error in /api/business:', err.message);
      console.error('Stack trace:', err.stack);
      res.status(500).json({ message: 'Error creating business', error: err.message });
      console.log('Error response sent for /api/business');
    }
  });

  app.post('/api/signup', async (req, res) => {
    const { name, email, password, businessId } = req.body;
    if (!name || !email || !password || !businessId) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    try {
      const business = await db.collection('businesses').findOne({ _id: new ObjectId(businessId) });
      if (!business) return res.status(400).json({ message: 'Business not found' });

      const existingUser = await db.collection('users').findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'User already exists' });

      const businessIdStr = businessId.toString();
      console.log('Business ID (string):', businessIdStr);
      console.log('Querying users with businessId:', businessIdStr);
      const businessUsers = await db.collection('users').find({ businessId: businessIdStr }).toArray();
      console.log('Found users:', businessUsers);
      const role = businessUsers.length === 0 ? 'admin' : 'member';
      console.log('Assigned role:', role);

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = {
        name,
        email,
        password: hashedPassword,
        businessId: businessIdStr,
        role,
        createdAt: new Date(),
      };
      const result = await db.collection('users').insertOne(user);

      const token = jwt.sign({ id: result.insertedId, email, businessId: businessIdStr, role }, 'your-secret-key', { expiresIn: '1h' });
      res.status(201).json({ message: 'User created', token, role });
    } catch (err) {
      res.status(500).json({ message: 'Error signing up', error: err.message });
    }
  });

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    try {
      const user = await db.collection('users').findOne({ email });
      if (!user) return res.status(400).json({ message: 'User not found' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

      const token = jwt.sign({ id: user._id, email: user.email, businessId: user.businessId.toString(), role: user.role }, 'your-secret-key', { expiresIn: '1h' });
      res.json({ message: 'Login successful', token, role: user.role });
    } catch (err) {
      res.status(500).json({ message: 'Error logging in', error: err.message });
    }
  });

  app.get('/api/business-data', authenticateToken, async (req, res) => {
    try {
      const business = await db.collection('businesses').findOne({ _id: new ObjectId(req.user.businessId) });
      if (!business) return res.status(404).json({ message: 'Business not found' });
      res.json({ business });
    } catch (err) {
      res.status(500).json({ message: 'Error fetching business data', error: err.message });
    }
  });

  app.get('/api/admin-only', authenticateToken, requireAdmin, (req, res) => {
    res.json({ message: 'This is an admin-only route', user: req.user });
  });

  // New route for admins to create users
  app.post('/api/create-user', authenticateToken, requireAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields (name, email, password, role) are required' });
    }

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Role must be either "admin" or "member"' });
    }

    try {
      const existingUser = await db.collection('users').findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'User already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = {
        name,
        email,
        password: hashedPassword,
        businessId: req.user.businessId, // Use the admin's businessId
        role,
        createdAt: new Date(),
      };
      const result = await db.collection('users').insertOne(user);

      res.status(201).json({ message: 'User created successfully', userId: result.insertedId });
    } catch (err) {
      res.status(500).json({ message: 'Error creating user', error: err.message });
    }
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

connectToMongo().then(() => {
  startServer();
}).catch((err) => {
  console.error('Failed to start server due to MongoDB connection error:', err);
  process.exit(1);
});