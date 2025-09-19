// src/middleware/errorHandler.js
const multer = require('multer');

const errorHandler = (error, req, res, next) => {
  console.error('Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  if (error.message) {
    return res.status(400).json({ error: error.message });
  }
  
  res.status(500).json({ error: 'Internal server error' });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'Route not found' });
};

module.exports = { errorHandler, notFoundHandler };