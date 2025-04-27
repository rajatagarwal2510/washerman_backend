const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const app = express();
app.use(cors({
  origin: 'https://washerman_frontend.onrender.com' // Your frontend URL
}));
// Connect to MongoDB with improved error handling
mongoose.connect('mongodb://localhost:27017/washerman')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'laundryman', 'rider'], required: true }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.model('User', userSchema);

// Order Schema with expanded status options
const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: String,
  clothes: String,
  washType: String,
  returnTime: String,
  status: {
    type: String,
    enum: ['Pending', 'Picked Up', 'Washing', 'Ready', 'Delivered'],
    default: 'Pending'
  },
  rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ROUTES

// Registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    } // FIXED: Added missing closing curly brace here
    
    const user = new User({ username, password, role });
    await user.save();
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = await User.findOne({ username, role });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({
      success: true,
      id: user._id,
      username: user.username,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new order
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, clothes, washType, returnTime, customerName } = req.body;
    
    const order = new Order({
      customer: userId,
      customerName: customerName || req.body.username,
      clothes,
      washType,
      returnTime,
      status: 'Pending' // Initial status is Pending (waiting for pickup)
    });
    
    await order.save();
    res.status(201).json({ success: true, order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get orders by user ID
app.get('/api/orders/user/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.params.userId })
                            .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all orders (for laundryman and rider dashboards)
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update order status
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    // Validate status to ensure it's one of the allowed values
    const validStatuses = ['Pending', 'Picked Up', 'Washing', 'Ready', 'Delivered'];
    if (!validStatuses.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.json({ success: true, order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Assign rider to order
app.put('/api/orders/:id/rider', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { rider: req.body.riderId },
      { new: true }
    );
    res.json({ success: true, order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get orders by status
app.get('/api/orders/status/:status', async (req, res) => {
  try {
    const orders = await Order.find({ status: req.params.status })
                            .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
