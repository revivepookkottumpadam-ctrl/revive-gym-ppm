// src/routes/members.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { validateMemberData } = require('../utils/validation');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/imageService');
const {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  checkPhoneExists,
  checkEmailExists
} = require('../services/memberService');

// Check if phone exists - MUST be before /:id route
router.get('/check-phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { excludeId } = req.query;
    
    const exists = await checkPhoneExists(phone, excludeId);
    res.json({ exists });
  } catch (err) {
    console.error('Error checking phone:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if email exists - MUST be before /:id route
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { excludeId } = req.query;
    
    const decodedEmail = decodeURIComponent(email);
    const exists = await checkEmailExists(decodedEmail, excludeId);
    res.json({ exists });
  } catch (err) {
    console.error('Error checking email:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all members with pagination
router.get('/', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    console.log('GET /members - Query params:', { search, status, page: pageNum, limit: limitNum });
    
    const result = await getAllMembers(search, status, pageNum, limitNum);
    
    console.log('GET /members - Result:', {
      membersCount: result.members.length,
      total: result.total,
      page: pageNum,
      totalPages: result.totalPages,
      hasMore: result.hasMore
    });
    
    // Return in the format the frontend expects
    res.json({
      data: result.members,
      total: result.total,
      page: pageNum,
      totalPages: result.totalPages,
      hasMore: result.hasMore
    });
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single member
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const member = await getMemberById(id);
    
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json(member);
  } catch (err) {
    console.error('Error fetching member:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new member
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    
    const validatedData = validateMemberData(req.body);
    let photoUrl = null;

    if (req.file) {
      try {
        photoUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(400).json({ error: 'Failed to upload image' });
      }
    }

    const member = await createMember(validatedData, photoUrl);
    res.status(201).json(member);
  } catch (err) {
    console.error('Error creating member:', err);
    console.error('Error details:', err.message);
    if (err.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else if (err.message.includes('required') || err.message.includes('Invalid')) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }
});

// Update member
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = validateMemberData(req.body);
    let photoUrl = null;
    
    if (req.file) {
      try {
        photoUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(400).json({ error: 'Failed to upload image' });
      }
    }

    const result = await updateMember(id, validatedData, photoUrl);
    
    if (!result) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Delete old photo if new one was uploaded
    if (req.file && result.oldPhotoUrl) {
      await deleteFromCloudinary(result.oldPhotoUrl);
    }

    res.json(result.member);
  } catch (err) {
    console.error('Error updating member:', err);
    if (err.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else if (err.message.includes('required') || err.message.includes('Invalid')) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete member
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteMember(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Delete photo from Cloudinary if exists
    if (result.photoUrl) {
      await deleteFromCloudinary(result.photoUrl);
    }

    res.json({ message: 'Member deleted successfully' });
  } catch (err) {
    console.error('Error deleting member:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
