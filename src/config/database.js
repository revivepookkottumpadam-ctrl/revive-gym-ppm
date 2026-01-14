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

  // NOW seed admins (outside transaction)
  try {
    console.log('📊 Checking for existing admins...');
    
    const adminCheck = await pool.query('SELECT COUNT(*) as count FROM admins');
    const adminCount = parseInt(adminCheck.rows[0].count);
    
    console.log(`👥 Current admin count: ${adminCount}`);

    if (adminCount === 0) {
      console.log('🔐 No admins found. Starting admin creation...');
      console.log('🔍 Environment check:');
      console.log('  - ADMIN1_USERNAME:', process.env.ADMIN1_USERNAME ? '✓ SET' : '✗ MISSING');
      console.log('  - ADMIN1_PASSWORD:', process.env.ADMIN1_PASSWORD ? '✓ SET' : '✗ MISSING');
      console.log('  - ADMIN2_USERNAME:', process.env.ADMIN2_USERNAME ? '✓ SET' : '✗ MISSING');
      console.log('  - ADMIN2_PASSWORD:', process.env.ADMIN2_PASSWORD ? '✓ SET' : '✗ MISSING');
      console.log('  - ADMIN3_USERNAME:', process.env.ADMIN3_USERNAME ? '✓ SET' : '✗ MISSING');
      console.log('  - ADMIN3_PASSWORD:', process.env.ADMIN3_PASSWORD ? '✓ SET' : '✗ MISSING');
      
      const admins = [
        { 
          username: process.env.ADMIN1_USERNAME, 
          password: process.env.ADMIN1_PASSWORD,
          name: 'Admin 1'
        },
        { 
          username: process.env.ADMIN2_USERNAME, 
          password: process.env.ADMIN2_PASSWORD,
          name: 'Admin 2'
        },
        { 
          username: process.env.ADMIN3_USERNAME, 
          password: process.env.ADMIN3_PASSWORD,
          name: 'Admin 3'
        }
      ];

      let successCount = 0;
      
      for (const admin of admins) {
        if (!admin.username || !admin.password) {
          console.log(`⚠️  Skipping ${admin.name}: Missing credentials`);
          continue;
        }
        
        try {
          console.log(`🔨 Creating ${admin.name} (${admin.username})...`);
          const hashedPassword = await bcrypt.hash(admin.password, 10);
          
          await pool.query(
            'INSERT INTO admins (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
            [admin.username, hashedPassword]
          );
          
          console.log(`✅ ${admin.name} created successfully`);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to create ${admin.name}:`, error.message);
        }
      }
      
      console.log(`\n🎉 Admin creation complete: ${successCount}/${admins.length} successful\n`);
      
      if (successCount === 0) {
        console.error('⚠️⚠️⚠️ WARNING: NO ADMINS WERE CREATED! Check environment variables! ⚠️⚠️⚠️');
      }
    } else {
      console.log('ℹ️  Admins already exist. Skipping creation.');
    }
    
  } catch (error) {
    console.error('❌ Admin seeding failed:', error);
    // Don't throw - allow server to start even if admin seeding fails
  }
  
  console.log('✅ Database initialization complete\n');
}

module.exports = { pool, initializeDatabase };