import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';

const router = express.Router();

// Register
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['seller', 'buyer', 'funder', 'operator', 'admin', null])
  ],
  async (req, res) => {
    try {
      console.log('📝 Registration request received:', req.body.email);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, role, orgId } = req.body;

      // Check if user exists
      console.log('🔍 Checking if user exists:', email);
      const [existingUsers] = await db.query('SELECT id FROM auth_users WHERE email = ?', [email]);
      console.log('📊 Existing users found:', existingUsers.length);
      
      if (existingUsers.length > 0) {
        console.log('⚠️ User already exists in database');
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create auth user with UUID
      const authId = crypto.randomUUID();
      console.log('💾 Creating auth_users record with ID:', authId);
      await db.query(
        'INSERT INTO auth_users (id, email, password_hash) VALUES (?, ?, ?)',
        [authId, email, passwordHash]
      );
      console.log('✅ auth_users record created');

      // Create user profile (role can be null initially)
      const userId = crypto.randomUUID();
      const userRole = role || null;
      console.log('💾 Creating users record with ID:', userId, 'Role:', userRole);
      await db.query(
        'INSERT INTO users (id, auth_id, email, role, org_id) VALUES (?, ?, ?, ?, ?)',
        [userId, authId, email, userRole, orgId || null]
      );
      console.log('✅ users record created');

      // Generate JWT
      const token = jwt.sign(
        { userId, email, role: userRole },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      console.log('✅ Registration complete, sending response');
      res.status(201).json({
        token,
        user: { id: userId, email, role: userRole, orgId }
      });
    } catch (error) {
      console.error('❌ Register error:', error);
      console.error('Error details:', error.message);
      console.error('SQL:', error.sql);
      res.status(500).json({ 
        error: 'Registration failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    try {
      console.log('🔐 Login request received:', req.body.email);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find auth user
      console.log('🔍 Looking up user in database...');
      const [authUsers] = await db.query('SELECT * FROM auth_users WHERE email = ?', [email]);
      console.log('📊 Auth users found:', authUsers.length);
      
      if (authUsers.length === 0) {
        console.log('❌ No user found with that email');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const authUser = authUsers[0];
      console.log('✅ User found, verifying password...');

      // Verify password
      const isValidPassword = await bcrypt.compare(password, authUser.password_hash);
      console.log('🔑 Password valid:', isValidPassword);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Get user profile
      console.log('👤 Fetching user profile...');
      const [users] = await db.query('SELECT * FROM users WHERE auth_id = ?', [authUser.id]);
      console.log('📊 User profiles found:', users.length);
      
      if (users.length === 0) {
        console.log('❌ User profile not found');
        return res.status(404).json({ error: 'User profile not found' });
      }

      const user = users[0];
      console.log('✅ User profile loaded');

      // Generate JWT
      console.log('🎫 Generating JWT token...');
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      console.log('✅ Login successful, sending response');
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          orgId: user.org_id,
          walletId: user.wallet_id,
          civicVerified: user.civic_verified
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    console.log('👤 /auth/me - User data from DB:', { id: user.id, email: user.email, org_id: user.org_id });
    
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.org_id,
      walletId: user.wallet_id,
      civicVerified: user.civic_verified
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
