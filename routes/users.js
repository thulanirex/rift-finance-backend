import express from 'express';
import { authenticateToken, requireOperatorOrAdmin } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get all users (operator/admin only)
router.get('/', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.*, o.name as org_name 
      FROM users u 
      LEFT JOIN organizations o ON u.org_id = o.id
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user can access this profile
    if (req.user.id !== id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [users] = await db.query(`
      SELECT u.*, o.name as org_name 
      FROM users u 
      LEFT JOIN organizations o ON u.org_id = o.id
      WHERE u.id = ?
    `, [id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📝 Update user request:', id, req.body);
    
    // Check if user can update this profile
    if (req.user.id !== id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { role, orgId, walletId, civicVerified } = req.body;
    
    const updates = [];
    const values = [];

    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (orgId !== undefined) {
      updates.push('org_id = ?');
      values.push(orgId);
      console.log('💾 Setting org_id to:', orgId);
    }
    if (walletId !== undefined) {
      updates.push('wallet_id = ?');
      values.push(walletId);
    }
    if (civicVerified !== undefined) {
      updates.push('civic_verified = ?');
      values.push(civicVerified);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    console.log('🔄 Executing query:', query, values);
    
    await db.query(query, values);

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    console.log('✅ User updated, org_id is now:', users[0].org_id);
    res.json(users[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (operator/admin only)
router.delete('/:id', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
