// src/config/database.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') || process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Initializing database...');
    
    await client.query('BEGIN');
    
    // Create members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL,
        membership_type VARCHAR(50) NOT NULL CHECK (membership_type IN ('monthly', 'quarterly', 'yearly')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid')),
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_members_email ON members(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_members_payment_status ON members(payment_status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_members_end_date ON members(end_date)');

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Create trigger
    await client.query(`
      DROP TRIGGER IF EXISTS update_members_updated_at ON members;
      CREATE TRIGGER update_members_updated_at 
          BEFORE UPDATE ON members 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
    `);

    // Create admins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    
    console.log('✅ Tables created successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }

// ================= ADMIN SEEDING =================
try {
  if (process.env.SEED_ADMINS !== 'true') {
    console.log('ℹ️ Admin seeding skipped (SEED_ADMINS not true)');
  } else {
    console.log('🔐 Admin seeding enabled');

    const admins = [
      { u: process.env.ADMIN1_USERNAME, p: process.env.ADMIN1_PASSWORD },
      { u: process.env.ADMIN2_USERNAME, p: process.env.ADMIN2_PASSWORD },
      { u: process.env.ADMIN3_USERNAME, p: process.env.ADMIN3_PASSWORD },
    ];

    for (const admin of admins) {
      if (!admin.u || !admin.p) {
        console.log('⚠️ Skipping admin (missing env vars)');
        continue;
      }

      const exists = await pool.query(
        'SELECT 1 FROM admins WHERE username = $1',
        [admin.u]
      );

      if (exists.rowCount > 0) {
        console.log(`ℹ️ Admin ${admin.u} already exists`);
        continue;
      }

      const hash = await bcrypt.hash(admin.p, 10);

      await pool.query(
        'INSERT INTO admins (username, password) VALUES ($1, $2)',
        [admin.u, hash]
      );

      console.log(`✅ Admin ${admin.u} seeded`);
    }

    console.log('🎉 Admin seeding completed');
  }
} catch (err) {
  console.error('❌ Admin seeding failed:', err);
}

  console.log('✅ Database initialization complete\n');
}

module.exports = { pool, initializeDatabase };