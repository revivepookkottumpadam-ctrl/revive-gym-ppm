// src/app.js
const express = require('express');
const fs = require('fs');
require('dotenv').config();

const corsMiddleware = require('./middleware/cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const membersRoutes = require('./routes/members');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Middleware - CORRECT ORDER
app.use(corsMiddleware);
app.use(express.json()); // ⬅️ MOVE THIS UP, BEFORE LOGGING
app.use('/uploads', express.static('uploads'));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body); // Add req.body to see data
  next();
});

// ✅ Health check route 
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '✅ Server is awake and running'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', authenticateToken, membersRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);

// Auto-expire endpoint
app.post('/api/auto-expire', async (req, res) => {
  try {
    const { autoExpireMembers } = require('./services/memberService');
    const expiredMembers = await autoExpireMembers();
    res.json({
      success: true,
      message: `Auto-expired ${expiredMembers.length} members`,
      expiredMembers: expiredMembers
    });
  } catch (err) {
    console.error('Error in auto-expire endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling - THESE MUST BE LAST
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;