const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

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

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: `Access denied: ${roles.join(' or ')} role required` });
  }
  next();
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinBusiness', (businessId) => {
    socket.join(businessId);
    console.log(`User ${socket.id} joined business room: ${businessId}`);
  });

  socket.on('sendMessage', async ({ businessId, senderId, message }) => {
    try {
      const chatMessage = {
        businessId,
        senderId,
        message,
        timestamp: new Date(),
      };
      await db.collection('messages').insertOne(chatMessage);
      io.to(businessId).emit('receiveMessage', chatMessage);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

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
      const role = businessUsers.length === 0 ? 'owner' : 'employee';
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

  app.get('/api/admin-only', authenticateToken, requireRole(['owner', 'admin']), (req, res) => {
    res.json({ message: 'This is an admin-only route', user: req.user });
  });

  app.post('/api/create-user', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields (name, email, password, role) are required' });
    }

    if (!['owner', 'admin', 'manager', 'employee'].includes(role)) {
      return res.status(400).json({ message: 'Role must be either "owner", "admin", "manager", or "employee"' });
    }

    try {
      const existingUser = await db.collection('users').findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'User already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = {
        name,
        email,
        password: hashedPassword,
        businessId: req.user.businessId,
        role,
        createdAt: new Date(),
      };
      const result = await db.collection('users').insertOne(user);

      res.status(201).json({ message: 'User created successfully', userId: result.insertedId });
    } catch (err) {
      res.status(500).json({ message: 'Error creating user', error: err.message });
    }
  });

  app.get('/api/messages/:businessId', authenticateToken, async (req, res) => {
    try {
      const { businessId } = req.params;
      if (businessId !== req.user.businessId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const messages = await db.collection('messages').find({ businessId }).toArray();
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching messages', error: err.message });
    }
  });

  app.post('/api/clients', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    const { name, email, phone, notes } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    try {
      const existingClient = await db.collection('clients').findOne({ email, businessId: req.user.businessId });
      if (existingClient) return res.status(400).json({ message: 'Client with this email already exists' });

      const client = {
        name,
        email,
        phone: phone || '',
        notes: notes || '',
        businessId: req.user.businessId,
        createdAt: new Date(),
      };
      const result = await db.collection('clients').insertOne(client);
      res.status(201).json({ message: 'Client created successfully', clientId: result.insertedId });
    } catch (err) {
      res.status(500).json({ message: 'Error creating client', error: err.message });
    }
  });

  app.get('/api/clients', authenticateToken, async (req, res) => {
    try {
      const clients = await db.collection('clients').find({ businessId: req.user.businessId }).toArray();
      res.json(clients);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching clients', error: err.message });
    }
  });

  app.put('/api/clients/:clientId', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    const { clientId } = req.params;
    const { name, email, phone, notes } = req.body;

    try {
      const client = await db.collection('clients').findOne({ _id: new ObjectId(clientId), businessId: req.user.businessId });
      if (!client) return res.status(404).json({ message: 'Client not found' });

      const updatedClient = {
        name: name || client.name,
        email: email || client.email,
        phone: phone || client.phone,
        notes: notes || client.notes,
        businessId: req.user.businessId,
        updatedAt: new Date(),
      };

      await db.collection('clients').updateOne(
        { _id: new ObjectId(clientId) },
        { $set: updatedClient }
      );
      res.json({ message: 'Client updated successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Error updating client', error: err.message });
    }
  });

  app.delete('/api/clients/:clientId', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    const { clientId } = req.params;

    try {
      const result = await db.collection('clients').deleteOne({ _id: new ObjectId(clientId), businessId: req.user.businessId });
      if (result.deletedCount === 0) return res.status(404).json({ message: 'Client not found' });
      res.json({ message: 'Client deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Error deleting client', error: err.message });
    }
  });

  app.get('/api/hierarchy', authenticateToken, async (req, res) => {
    try {
      console.log('Fetching hierarchy for businessId:', req.user.businessId);
      const users = await db.collection('users')
        .find({ businessId: req.user.businessId })
        .sort({ role: 1 })
        .toArray();
      console.log('Found users:', users);
      res.json(users);
    } catch (err) {
      console.error('Error in /api/hierarchy:', err.message);
      res.status(500).json({ message: 'Error fetching hierarchy', error: err.message });
    }
  });

  // Time Card Routes
  // Submit a time card (all roles can submit)
  app.post('/api/timecards', authenticateToken, async (req, res) => {
    const { date, hoursWorked, description } = req.body;
    if (!date || !hoursWorked) {
      return res.status(400).json({ message: 'Date and hours worked are required' });
    }

    try {
      const timeCard = {
        userId: req.user.id,
        businessId: req.user.businessId,
        date: new Date(date),
        hoursWorked: parseFloat(hoursWorked),
        description: description || '',
        status: 'pending', // Can be 'pending', 'approved', or 'rejected'
        createdAt: new Date(),
      };
      const result = await db.collection('timecards').insertOne(timeCard);
      res.status(201).json({ message: 'Time card submitted successfully', timeCardId: result.insertedId });
    } catch (err) {
      res.status(500).json({ message: 'Error submitting time card', error: err.message });
    }
  });

  // Get all time cards for the business (visible to managers, admins, owners; employees see only their own)
  app.get('/api/timecards', authenticateToken, async (req, res) => {
    try {
      let timeCards;
      if (['manager', 'admin', 'owner'].includes(req.user.role)) {
        // Managers, admins, and owners can see all time cards in the business
        timeCards = await db.collection('timecards')
          .find({ businessId: req.user.businessId })
          .toArray();
      } else {
        // Employees can only see their own time cards
        timeCards = await db.collection('timecards')
          .find({ userId: req.user.id, businessId: req.user.businessId })
          .toArray();
      }
      res.json(timeCards);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching time cards', error: err.message });
    }
  });

  // Approve or reject a time card (managers, admins, owners only)
  app.put('/api/timecards/:timeCardId', authenticateToken, requireRole(['manager', 'admin', 'owner']), async (req, res) => {
    const { timeCardId } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "approved" or "rejected"' });
    }

    try {
      const timeCard = await db.collection('timecards').findOne({ _id: new ObjectId(timeCardId), businessId: req.user.businessId });
      if (!timeCard) return res.status(404).json({ message: 'Time card not found' });

      await db.collection('timecards').updateOne(
        { _id: new ObjectId(timeCardId) },
        { $set: { status, updatedAt: new Date() } }
      );
      res.json({ message: `Time card ${status} successfully` });
    } catch (err) {
      res.status(500).json({ message: 'Error updating time card', error: err.message });
    }
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

connectToMongo().then(() => {
  startServer();
}).catch((err) => {
  console.error('Failed to start server due to MongoDB connection error:', err);
  process.exit(1);
});