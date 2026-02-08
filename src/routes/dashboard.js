// src/routes/dashboard.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { autoExpireMembers, formatMemberData } = require('../services/memberService');

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Auto-expire members before calculating stats
    await autoExpireMembers();

    const totalMembersResult = await pool.query('SELECT COUNT(*) FROM members');
    const activeMembersResult = await pool.query("SELECT COUNT(*) FROM members WHERE payment_status = 'paid'");
    const unpaidMembersResult = await pool.query("SELECT COUNT(*) FROM members WHERE payment_status = 'unpaid'");

    const expiringMembersResult = await pool.query(
      'SELECT COUNT(*) FROM members WHERE end_date <= CURRENT_DATE + INTERVAL \'7 days\' AND end_date >= CURRENT_DATE'
    );

    const stats = {
      totalMembers: parseInt(totalMembersResult.rows[0].count),
      activeMembers: parseInt(activeMembersResult.rows[0].count),
      unpaidMembers: parseInt(unpaidMembersResult.rows[0].count),
      expiringMembers: parseInt(expiringMembersResult.rows[0].count)
    };

    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get expiring members
router.get('/expiring', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, 
        name, 
        email, 
        phone, 
        membership_type, 
        weight,
        start_date, 
        end_date, 
        payment_status, 
        photo_url 
      FROM members 
      WHERE end_date <= CURRENT_DATE + INTERVAL '7 days' 
        AND end_date >= CURRENT_DATE 
      ORDER BY end_date ASC`
    );

    const expiringMembers = result.rows.map(formatMemberData);
    res.json(expiringMembers);
  } catch (err) {
    console.error('Error fetching expiring members:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;