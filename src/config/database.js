// src/config/database.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL connection with flexible SSL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') || process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

// Handle unexpected pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

async function initializeDatabase() {
  try {
    console.log('🔧 Initializing database...');

    // Create members table
    await pool.query(`
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

    // Create indexes for better performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_members_email ON members(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_members_payment_status ON members(payment_status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_members_end_date ON members(end_date)`);

    // Create updated_at trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Create trigger
    await pool.query(`
      DROP TRIGGER IF EXISTS update_members_updated_at ON members;
      CREATE TRIGGER update_members_updated_at 
          BEFORE UPDATE ON members 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
    `);

    // Create admins table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed predefined admins if none exist
    const adminCheck = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminCheck.rows[0].count) === 0) {
      console.log('👤 Seeding default admin users...');
      
      // Load admin credentials from environment variables
      const admins = [
        { 
          username: process.env.ADMIN1_USERNAME, 
          password: process.env.ADMIN1_PASSWORD 
        },
        { 
          username: process.env.ADMIN2_USERNAME, 
          password: process.env.ADMIN2_PASSWORD 
        },
        { 
          username: process.env.ADMIN3_USERNAME, 
          password: process.env.ADMIN3_PASSWORD 
        }
      ];

      for (const admin of admins) {
        // Skip if username or password is missing
        if (!admin.username || !admin.password) {
          console.warn(`⚠️ Skipping admin with missing credentials`);
          continue;
        }

        const hashedPassword = await bcrypt.hash(admin.password, 10);
        await pool.query(
          'INSERT INTO admins (username, password) VALUES ($1, $2)',
          [admin.username, hashedPassword]
        );
      }
      console.log('✅ Admin users seeded');
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initializeDatabase };