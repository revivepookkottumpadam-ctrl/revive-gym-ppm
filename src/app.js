// src/app.js
const express = require('express');
const fs = require('fs');
require('dotenv').config();

const corsMiddleware = require('./middleware/cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const membersRoutes = require('./routes/members');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Middleware
app.use(corsMiddleware);

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use(express.json());
app.use('/uploads', express.static('uploads'));


// ✅ Health check route 
app.get('/', (req, res) => {
  res.send('✅ Server is awake and running');
});

// Routes
app.use('/api/members', membersRoutes);
app.use('/api/dashboard', dashboardRoutes);

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

// Error handling
app.use(errorHandler);
app.use(notFoundHandler);

module.exports = app;
