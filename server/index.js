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
  if (!token) {
    console.log('No token provided in request');
    return res.status(401).json({ message: 'Access denied' });
  }

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid token' });
    }
    console.log('Token verified, user:', user);
    req.user = user;
    next();
  });
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    console.log(`Access denied for user with role ${req.user.role}, required roles: ${roles}`);
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

  socket.on('joinDM', ({ senderId, recipientId }) => {
    const room = [senderId, recipientId].sort().join('-');
    socket.join(room);
    console.log(`User ${socket.id} joined DM room: ${room}`);
  });

  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
    console.log(`User ${socket.id} joined group room: ${groupId}`);
  });

  socket.on('sendMessage', async ({ type, businessId, senderId, recipientId, groupId, message }) => {
    try {
      const chatMessage = {
        type, // 'business', 'dm', or 'group'
        businessId,
        senderId,
        recipientId: type === 'dm' ? recipientId : undefined,
        groupId: type === 'group' ? groupId : undefined,
        message,
        timestamp: new Date(),
      };
      await db.collection('messages').insertOne(chatMessage);

      if (type === 'business') {
        io.to(businessId).emit('receiveMessage', chatMessage);
      } else if (type === 'dm') {
        const room = [senderId, recipientId].sort().join('-');
        io.to(room).emit('receiveMessage', chatMessage);
      } else if (type === 'group') {
        io.to(groupId).emit('receiveMessage', chatMessage);
      }
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
      console.log('Missing required fields for signup:', { name, email, password, businessId });
      return res.status(400).json({ message: 'All fields are required' });
    }

    try {
      const business = await db.collection('businesses').findOne({ _id: new ObjectId(businessId) });
      if (!business) {
        console.log('Business not found for businessId:', businessId);
        return res.status(400).json({ message: 'Business not found' });
      }

      const existingUser = await db.collection('users').findOne({ email });
      if (existingUser) {
        console.log('User already exists with email:', email);
        return res.status(400).json({ message: 'User already exists' });
      }

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
        phone: '',
        preferences: { theme: 'light', notifications: true },
        createdAt: new Date(),
      };
      const result = await db.collection('users').insertOne(user);
      console.log('User inserted:', user);

      const token = jwt.sign({ id: result.insertedId, email, businessId: businessIdStr, role }, 'your-secret-key', { expiresIn: '1h' });
      console.log('Generated token for signup:', token);
      res.status(201).json({ message: 'User created', token, role });
    } catch (err) {
      console.error('Error signing up:', err.message);
      res.status(500).json({ message: 'Error signing up', error: err.message });
    }
  });

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      console.log('Missing email or password for login:', { email, password });
      return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
      const user = await db.collection('users').findOne({ email });
      if (!user) {
        console.log('User not found for email:', email);
        return res.status(400).json({ message: 'User not found' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log('Invalid credentials for email:', email);
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user._id, email: user.email, businessId: user.businessId.toString(), role: user.role }, 'your-secret-key', { expiresIn: '1h' });
      console.log('Generated token for login:', token);
      res.json({ message: 'Login successful', token, role: user.role });
    } catch (err) {
      console.error('Error logging in:', err.message);
      res.status(500).json({ message: 'Error logging in', error: err.message });
    }
  });

  app.get('/api/business-data', authenticateToken, async (req, res) => {
    try {
      console.log('Fetching business data for businessId:', req.user.businessId);
      const business = await db.collection('businesses').findOne({ _id: new ObjectId(req.user.businessId) });
      if (!business) {
        console.log('Business not found for businessId:', req.user.businessId);
        return res.status(404).json({ message: 'Business not found' });
      }
      res.json({ business });
    } catch (err) {
      console.error('Error fetching business data:', err.message);
      res.status(500).json({ message: 'Error fetching business data', error: err.message });
    }
  });

  app.get('/api/admin-only', authenticateToken, requireRole(['owner', 'admin']), (req, res) => {
    res.json({ message: 'This is an admin-only route', user: req.user });
  });

  app.post('/api/create-user', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      console.log('Missing required fields for create-user:', { name, email, password, role });
      return res.status(400).json({ message: 'All fields (name, email, password, role) are required' });
    }

    if (!['owner', 'admin', 'manager', 'employee'].includes(role)) {
      console.log('Invalid role for create-user:', role);
      return res.status(400).json({ message: 'Role must be either "owner", "admin", "manager", or "employee"' });
    }

    try {
      const existingUser = await db.collection('users').findOne({ email });
      if (existingUser) {
        console.log('User already exists with email:', email);
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = {
        name,
        email,
        password: hashedPassword,
        businessId: req.user.businessId,
        role,
        phone: '',
        preferences: { theme: 'light', notifications: true },
        createdAt: new Date(),
      };
      const result = await db.collection('users').insertOne(user);
      console.log('Created user:', user);

      res.status(201).json({ message: 'User created successfully', userId: result.insertedId });
    } catch (err) {
      console.error('Error creating user:', err.message);
      res.status(500).json({ message: 'Error creating user', error: err.message });
    }
  });

  app.get('/api/messages/:businessId', authenticateToken, async (req, res) => {
    try {
      const { businessId } = req.params;
      if (businessId !== req.user.businessId) {
        console.log('Unauthorized access to messages for businessId:', businessId);
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const messages = await db.collection('messages').find({ type: 'business', businessId }).toArray();
      res.json(messages);
    } catch (err) {
      console.error('Error fetching messages:', err.message);
      res.status(500).json({ message: 'Error fetching messages', error: err.message });
    }
  });

  app.post('/api/clients', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    const { name, email, phone, notes } = req.body;
    if (!name || !email) {
      console.log('Missing required fields for create-client:', { name, email, phone, notes });
      return res.status(400).json({ message: 'Name and email are required' });
    }

    try {
      const existingClient = await db.collection('clients').findOne({ email, businessId: req.user.businessId });
      if (existingClient) {
        console.log('Client already exists with email:', email);
        return res.status(400).json({ message: 'Client with this email already exists' });
      }

      const client = {
        name,
        email,
        phone: phone || '',
        notes: notes || '',
        businessId: req.user.businessId,
        createdAt: new Date(),
      };
      const result = await db.collection('clients').insertOne(client);
      console.log('Created client:', client);
      res.status(201).json({ message: 'Client created successfully', clientId: result.insertedId });
    } catch (err) {
      console.error('Error creating client:', err.message);
      res.status(500).json({ message: 'Error creating client', error: err.message });
    }
  });

  app.get('/api/clients', authenticateToken, async (req, res) => {
    try {
      const clients = await db.collection('clients').find({ businessId: req.user.businessId }).toArray();
      res.json(clients);
    } catch (err) {
      console.error('Error fetching clients:', err.message);
      res.status(500).json({ message: 'Error fetching clients', error: err.message });
    }
  });

  app.put('/api/clients/:clientId', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    const { clientId } = req.params;
    const { name, email, phone, notes } = req.body;

    try {
      const client = await db.collection('clients').findOne({ _id: new ObjectId(clientId), businessId: req.user.businessId });
      if (!client) {
        console.log('Client not found for clientId:', clientId);
        return res.status(404).json({ message: 'Client not found' });
      }

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
      console.log('Updated client:', updatedClient);
      res.json({ message: 'Client updated successfully' });
    } catch (err) {
      console.error('Error updating client:', err.message);
      res.status(500).json({ message: 'Error updating client', error: err.message });
    }
  });

  app.delete('/api/clients/:clientId', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    const { clientId } = req.params;

    try {
      const result = await db.collection('clients').deleteOne({ _id: new ObjectId(clientId), businessId: req.user.businessId });
      if (result.deletedCount === 0) {
        console.log('Client not found for clientId:', clientId);
        return res.status(404).json({ message: 'Client not found' });
      }
      console.log('Deleted client with clientId:', clientId);
      res.json({ message: 'Client deleted successfully' });
    } catch (err) {
      console.error('Error deleting client:', err.message);
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
  app.post('/api/timecards', authenticateToken, async (req, res) => {
    const { date, hoursWorked, description } = req.body;
    if (!date || !hoursWorked) {
      console.log('Missing required fields for time card:', { date, hoursWorked, description });
      return res.status(400).json({ message: 'Date and hours worked are required' });
    }

    try {
      const timeCard = {
        userId: req.user.id,
        businessId: req.user.businessId,
        date: new Date(date),
        hoursWorked: parseFloat(hoursWorked),
        description: description || '',
        status: 'pending',
        createdAt: new Date(),
      };
      const result = await db.collection('timecards').insertOne(timeCard);
      console.log('Submitted time card:', timeCard);
      res.status(201).json({ message: 'Time card submitted successfully', timeCardId: result.insertedId });
    } catch (err) {
      console.error('Error submitting time card:', err.message);
      res.status(500).json({ message: 'Error submitting time card', error: err.message });
    }
  });

  app.get('/api/timecards', authenticateToken, async (req, res) => {
    try {
      console.log('Fetching time cards for user:', req.user);
      let timeCards;
      if (['manager', 'admin', 'owner'].includes(req.user.role)) {
        timeCards = await db.collection('timecards')
          .find({ businessId: req.user.businessId })
          .toArray();
      } else {
        timeCards = await db.collection('timecards')
          .find({ userId: req.user.id, businessId: req.user.businessId })
          .toArray();
      }
      console.log('Found time cards:', timeCards);
      res.json(timeCards);
    } catch (err) {
      console.error('Error fetching time cards:', err.message);
      res.status(500).json({ message: 'Error fetching time cards', error: err.message });
    }
  });

  app.put('/api/timecards/:timeCardId', authenticateToken, requireRole(['manager', 'admin', 'owner']), async (req, res) => {
    const { timeCardId } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      console.log('Invalid status for time card update:', status);
      return res.status(400).json({ message: 'Status must be "approved" or "rejected"' });
    }

    try {
      const timeCard = await db.collection('timecards').findOne({ _id: new ObjectId(timeCardId), businessId: req.user.businessId });
      if (!timeCard) {
        console.log('Time card not found for timeCardId:', timeCardId);
        return res.status(404).json({ message: 'Time card not found' });
      }

      await db.collection('timecards').updateOne(
        { _id: new ObjectId(timeCardId) },
        { $set: { status, updatedAt: new Date() } }
      );
      console.log(`Updated time card ${timeCardId} to status: ${status}`);
      res.json({ message: `Time card ${status} successfully` });
    } catch (err) {
      console.error('Error updating time card:', err.message);
      res.status(500).json({ message: 'Error updating time card', error: err.message });
    }
  });

  // Profile Routes
  app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
      const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
      if (!user) {
        console.log('User not found for id:', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({
        name: user.name,
        email: user.email,
        phone: user.phone,
        preferences: user.preferences,
        role: user.role,
        businessId: user.businessId,
      });
    } catch (err) {
      console.error('Error fetching profile:', err.message);
      res.status(500).json({ message: 'Error fetching profile', error: err.message });
    }
  });

  app.put('/api/profile', authenticateToken, async (req, res) => {
    const { name, phone, preferences } = req.body;

    try {
      const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
      if (!user) {
        console.log('User not found for id:', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }

      const updatedProfile = {
        name: name || user.name,
        phone: phone || user.phone,
        preferences: preferences || user.preferences,
        updatedAt: new Date(),
      };

      await db.collection('users').updateOne(
        { _id: new ObjectId(req.user.id) },
        { $set: updatedProfile }
      );
      console.log('Updated profile for user:', req.user.id, updatedProfile);
      res.json({ message: 'Profile updated successfully', profile: updatedProfile });
    } catch (err) {
      console.error('Error updating profile:', err.message);
      res.status(500).json({ message: 'Error updating profile', error: err.message });
    }
  });

  // Chat Routes
  app.get('/api/users/:businessId', authenticateToken, async (req, res) => {
    try {
      const { businessId } = req.params;
      if (businessId !== req.user.businessId) {
        console.log('Unauthorized access to users for businessId:', businessId);
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const users = await db.collection('users')
        .find({ businessId })
        .project({ _id: 1, name: 1, email: 1 })
        .toArray();
      res.json(users);
    } catch (err) {
      console.error('Error fetching users:', err.message);
      res.status(500).json({ message: 'Error fetching users', error: err.message });
    }
  });

  app.post('/api/groups', authenticateToken, async (req, res) => {
    const { name, memberIds } = req.body;
    if (!name || !memberIds || !Array.isArray(memberIds)) {
      console.log('Missing required fields for group creation:', { name, memberIds });
      return res.status(400).json({ message: 'Group name and member IDs are required' });
    }

    try {
      const members = await db.collection('users')
        .find({ _id: { $in: memberIds.map(id => new ObjectId(id)) }, businessId: req.user.businessId })
        .toArray();
      if (members.length !== memberIds.length) {
        console.log('Some members not found or not in the same business');
        return res.status(400).json({ message: 'Some members not found or not in the same business' });
      }

      const group = {
        name,
        businessId: req.user.businessId,
        memberIds: memberIds,
        createdBy: req.user.id,
        createdAt: new Date(),
      };
      const result = await db.collection('groups').insertOne(group);
      console.log('Created group:', group);
      res.status(201).json({ message: 'Group created successfully', groupId: result.insertedId });
    } catch (err) {
      console.error('Error creating group:', err.message);
      res.status(500).json({ message: 'Error creating group', error: err.message });
    }
  });

  app.get('/api/groups/:businessId', authenticateToken, async (req, res) => {
    try {
      const { businessId } = req.params;
      if (businessId !== req.user.businessId) {
        console.log('Unauthorized access to groups for businessId:', businessId);
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const groups = await db.collection('groups')
        .find({ businessId, memberIds: req.user.id })
        .toArray();
      res.json(groups);
    } catch (err) {
      console.error('Error fetching groups:', err.message);
      res.status(500).json({ message: 'Error fetching groups', error: err.message });
    }
  });

  app.get('/api/dm/:recipientId', authenticateToken, async (req, res) => {
    try {
      const { recipientId } = req.params;
      const recipient = await db.collection('users').findOne({ _id: new ObjectId(recipientId), businessId: req.user.businessId });
      if (!recipient) {
        console.log('Recipient not found or not in the same business:', recipientId);
        return res.status(404).json({ message: 'Recipient not found or not in the same business' });
      }

      const messages = await db.collection('messages')
        .find({
          type: 'dm',
          businessId: req.user.businessId,
          $or: [
            { senderId: req.user.id, recipientId },
            { senderId: recipientId, recipientId: req.user.id },
          ],
        })
        .toArray();
      res.json(messages);
    } catch (err) {
      console.error('Error fetching DM messages:', err.message);
      res.status(500).json({ message: 'Error fetching DM messages', error: err.message });
    }
  });

  app.get('/api/group-messages/:groupId', authenticateToken, async (req, res) => {
    try {
      const { groupId } = req.params;
      const group = await db.collection('groups').findOne({ _id: new ObjectId(groupId), businessId: req.user.businessId });
      if (!group) {
        console.log('Group not found for groupId:', groupId);
        return res.status(404).json({ message: 'Group not found' });
      }
      if (!group.memberIds.includes(req.user.id)) {
        console.log('User not a member of group:', groupId);
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const messages = await db.collection('messages')
        .find({ type: 'group', groupId })
        .toArray();
      res.json(messages);
    } catch (err) {
      console.error('Error fetching group messages:', err.message);
      res.status(500).json({ message: 'Error fetching group messages', error: err.message });
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