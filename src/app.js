// src/app.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

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

// ===== CORS CONFIGURATION (ONLY HERE!) =====
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Blocked by CORS:', origin);
      console.log('✅ Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

app.use(express.json());
app.use('/uploads', express.static('uploads'));

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

// Error handling
app.use(errorHandler);
app.use(notFoundHandler);

module.exports = app;