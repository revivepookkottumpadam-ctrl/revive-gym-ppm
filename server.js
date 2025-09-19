// server.js
const app = require('./src/app');
const { initializeDatabase, pool } = require('./src/config/database');
const { autoExpireMembers } = require('./src/services/memberService');

const PORT = process.env.PORT || 5000;

// Add process error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server only after database is initialized
async function startServer() {
  try {
    await initializeDatabase();
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('🔧 Cloudinary configured:', !!process.env.CLOUDINARY_CLOUD_NAME);
      console.log('⏰ Auto-expire running every hour');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
        process.exit(1);
      }
    });

    // Set up periodic auto-expire (every hour)
    setInterval(async () => {
      console.log('Running periodic auto-expire check...');
      await autoExpireMembers();
    }, 60 * 60 * 1000);

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();