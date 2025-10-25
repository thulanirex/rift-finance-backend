import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const createOperatorUser = async () => {
  try {
    // Create database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'rift_finance_hub'
    });

    console.log('Connected to database...');

    // Hash passwords
    const operatorPassword = await bcrypt.hash('operator123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);

    console.log('\n📝 Password Hashes Generated:');
    console.log('Operator password: operator123');
    console.log('Admin password: admin123\n');

    // Create operator user
    const operatorAuthId = uuidv4();
    const operatorUserId = uuidv4();
    
    // Insert into auth_users
    await connection.execute(
      `INSERT INTO auth_users (id, email, password_hash, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [operatorAuthId, 'operator@rift.finance', operatorPassword]
    );
    
    // Insert into users
    await connection.execute(
      `INSERT INTO users (id, auth_id, email, role, created_at, updated_at) 
       VALUES (?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE auth_id = VALUES(auth_id), role = VALUES(role)`,
      [operatorUserId, operatorAuthId, 'operator@rift.finance', 'operator']
    );

    console.log('✅ Operator user created:');
    console.log('   Email: operator@rift.finance');
    console.log('   Password: operator123');
    console.log('   Role: operator\n');

    // Create admin user
    const adminAuthId = uuidv4();
    const adminUserId = uuidv4();
    
    // Insert into auth_users
    await connection.execute(
      `INSERT INTO auth_users (id, email, password_hash, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [adminAuthId, 'admin@rift.finance', adminPassword]
    );
    
    // Insert into users
    await connection.execute(
      `INSERT INTO users (id, auth_id, email, role, created_at, updated_at) 
       VALUES (?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE auth_id = VALUES(auth_id), role = VALUES(role)`,
      [adminUserId, adminAuthId, 'admin@rift.finance', 'admin']
    );

    console.log('✅ Admin user created:');
    console.log('   Email: admin@rift.finance');
    console.log('   Password: admin123');
    console.log('   Role: admin\n');

    // Verify users
    const [users] = await connection.execute(
      `SELECT id, email, role, created_at FROM users WHERE role IN ('operator', 'admin')`
    );

    console.log('📊 All operator/admin users in database:');
    console.table(users);

    await connection.end();
    console.log('\n✨ Done! You can now login with these credentials.');
    
  } catch (error) {
    console.error('❌ Error creating users:', error);
    process.exit(1);
  }
};

createOperatorUser();
