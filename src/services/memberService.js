// src/services/memberService.js
const { pool } = require('../config/database');

// Format member data for response
const formatMemberData = (member) => ({
  ...member,
  startDate: member.start_date,
  endDate: member.end_date,
  membershipType: member.membership_type,
  paymentStatus: member.payment_status,
  photo: member.photo_url
});

// Auto-expire members whose membership has ended
const autoExpireMembers = async () => {
  try {
    const result = await pool.query(`
      UPDATE members 
      SET payment_status = 'unpaid' 
      WHERE end_date < CURRENT_DATE 
      AND payment_status = 'paid'
      RETURNING id, name, email
    `);
    
    if (result.rows.length > 0) {
      console.log(`Auto-expired ${result.rows.length} members:`, result.rows.map(m => m.name));
    }
    
    return result.rows;
  } catch (error) {
    console.error('Error auto-expiring members:', error);
    return [];
  }
};

// Get all members with optional filtering and pagination
const getAllMembers = async (search, status, page = 1, limit = 20) => {
  await autoExpireMembers();
  
  let query = 'SELECT * FROM members';
  let countQuery = 'SELECT COUNT(*) FROM members';
  let params = [];
  let conditions = [];

  if (search) {
    conditions.push(`(name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }

  if (status && status !== 'all') {
    conditions.push(`payment_status = $${params.length + 1}`);
    params.push(status);
  }

  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }

  // Conditional sorting: Only sort by days unpaid when status filter is 'unpaid'
  if (status === 'unpaid') {
    // For unpaid section: Sort by least days unpaid first (most recent unpaid at top)
    query += ` ORDER BY (CURRENT_DATE - end_date) ASC, created_at DESC`;
  } else {
    // For 'all' and 'paid' sections: Keep original order
    query += ` ORDER BY created_at DESC`;
  }
  
  // Get total count
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  const totalPages = Math.ceil(total / limit);
  
  // Add pagination
  const offset = (page - 1) * limit;
  query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  
  return {
    members: result.rows.map(formatMemberData),
    total,
    totalPages,
    hasMore: page < totalPages
  };
};

// Get single member by ID
const getMemberById = async (id) => {
  const result = await pool.query('SELECT * FROM members WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return null;
  }
  return formatMemberData(result.rows[0]);
};

// Create new member
const createMember = async (memberData, photoUrl = null) => {
  const result = await pool.query(
    `INSERT INTO members (name, email, phone, membership_type, start_date, end_date, payment_status, photo_url) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      memberData.name,
      memberData.email,
      memberData.phone,
      memberData.membershipType,
      memberData.startDate,
      memberData.endDate,
      memberData.paymentStatus,
      photoUrl
    ]
  );
  return formatMemberData(result.rows[0]);
};

// Update member
const updateMember = async (id, memberData, photoUrl = null) => {
  const existingMember = await pool.query('SELECT * FROM members WHERE id = $1', [id]);
  if (existingMember.rows.length === 0) {
    return null;
  }

  const currentPhotoUrl = photoUrl || existingMember.rows[0].photo_url;

  const result = await pool.query(
    `UPDATE members SET name = $1, email = $2, phone = $3, membership_type = $4, 
     start_date = $5, end_date = $6, payment_status = $7, photo_url = $8 
     WHERE id = $9 RETURNING *`,
    [
      memberData.name,
      memberData.email,
      memberData.phone,
      memberData.membershipType,
      memberData.startDate,
      memberData.endDate,
      memberData.paymentStatus,
      currentPhotoUrl,
      id
    ]
  );

  return {
    member: formatMemberData(result.rows[0]),
    oldPhotoUrl: existingMember.rows[0].photo_url
  };
};

// Delete member
const deleteMember = async (id) => {
  const memberResult = await pool.query('SELECT photo_url FROM members WHERE id = $1', [id]);
  if (memberResult.rows.length === 0) {
    return null;
  }

  const photoUrl = memberResult.rows[0].photo_url;
  await pool.query('DELETE FROM members WHERE id = $1', [id]);
  
  return { photoUrl };
};

// Check if phone exists
const checkPhoneExists = async (phone, excludeId = null) => {
  const cleanPhone = phone.replace(/\D/g, '');
  
  let query = 'SELECT id FROM members WHERE REGEXP_REPLACE(phone, \'[^0-9]\', \'\', \'g\') = $1';
  let params = [cleanPhone];
  
  if (excludeId) {
    query += ' AND id != $2';
    params.push(excludeId);
  }
  
  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

// Check if email exists
const checkEmailExists = async (email, excludeId = null) => {
  // Don't check for default email
  if (!email || email === 'member@revivefitness.com') {
    return false;
  }
  
  let query = 'SELECT id FROM members WHERE LOWER(email) = LOWER($1)';
  let params = [email];
  
  if (excludeId) {
    query += ' AND id != $2';
    params.push(excludeId);
  }
  
  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

module.exports = {
  autoExpireMembers,
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  checkPhoneExists,
  checkEmailExists,
  formatMemberData
};
