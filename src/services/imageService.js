// src/services/imageService.js
const cloudinary = require('../config/cloudinary');

const uploadToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'gym-members',
        public_id: `member-${Date.now()}-${Math.round(Math.random() * 1E9)}`,
        transformation: [
          { width: 300, height: 300, crop: 'fill', gravity: 'face' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(buffer);
  });
};

const deleteFromCloudinary = async (photoUrl) => {
  try {
    if (photoUrl && photoUrl.includes('cloudinary.com')) {
      // Extract public_id from URL
      const publicId = photoUrl.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };