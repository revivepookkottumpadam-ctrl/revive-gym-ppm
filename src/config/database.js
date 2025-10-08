// src/config/database.js
const { Pool } = require('pg');

let pool; // don't create immediately

function getPool() {
  if (!pool) {
    console.log('🔄 Creating new PostgreSQL pool...');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
      pool = null; // Reset pool if it breaks
    });
  }
  return pool;
}

async function initializeDatabase() {
  try {
    const activePool = getPool();
    console.log('🔧 Initializing database...');

    await activePool.query(`
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

    await activePool.query(`CREATE INDEX IF NOT EXISTS idx_members_email ON members(email)`);
    await activePool.query(`CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone)`);
    await activePool.query(`CREATE INDEX IF NOT EXISTS idx_members_payment_status ON members(payment_status)`);
    await activePool.query(`CREATE INDEX IF NOT EXISTS idx_members_end_date ON members(end_date)`);

    await activePool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await activePool.query(`
      DROP TRIGGER IF EXISTS update_members_updated_at ON members;
      CREATE TRIGGER update_members_updated_at 
          BEFORE UPDATE ON members 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

module.exports = { getPool, initializeDatabase };
