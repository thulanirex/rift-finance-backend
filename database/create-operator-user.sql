-- Create Operator/Admin User for RIFT Finance Hub
USE rift_finance_hub;

-- Create operator user
-- Password: operator123 (hashed with bcrypt)
INSERT INTO users (id, email, password_hash, role, created_at, updated_at) 
VALUES (
  UUID(), 
  'operator@rift.finance',
  '$2a$10$YourBcryptHashHere',  -- You'll need to hash the password
  'operator',
  NOW(),
  NOW()
);

-- Create admin user (has access to everything)
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (id, email, password_hash, role, created_at, updated_at) 
VALUES (
  UUID(), 
  'admin@rift.finance',
  '$2a$10$YourBcryptHashHere',  -- You'll need to hash the password
  'admin',
  NOW(),
  NOW()
);

-- Verify users were created
SELECT id, email, role, created_at FROM users WHERE role IN ('operator', 'admin');

-- IMPORTANT: You need to hash the passwords first!
-- Run this in Node.js to generate password hashes:
-- 
-- const bcrypt = require('bcryptjs');
-- const hash1 = await bcrypt.hash('operator123', 10);
-- const hash2 = await bcrypt.hash('admin123', 10);
-- console.log('Operator hash:', hash1);
-- console.log('Admin hash:', hash2);
