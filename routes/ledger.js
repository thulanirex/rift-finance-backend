import express from 'express';
import { authenticateToken, requireOperatorOrAdmin } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get ledger entries
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT l.*, 
             u.email as user_email,
             o.name as org_name,
             p.tenor_days as pool_tenor
      FROM ledger_entries l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN organizations o ON l.org_id = o.id
      LEFT JOIN pools p ON l.pool_id = p.id
    `;
    const params = [];
    const conditions = [];

    // Non-operators can only see their own entries
    if (!['operator', 'admin'].includes(req.user.role)) {
      conditions.push('(l.user_id = ? OR l.org_id = ?)');
      params.push(req.user.id, req.user.org_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY l.created_at DESC';

    const [entries] = await db.query(query, params);
    res.json(entries);
  } catch (error) {
    console.error('Get ledger entries error:', error);
    res.status(500).json({ error: 'Failed to fetch ledger entries' });
  }
});

// Create ledger entry
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { refType, refId, poolId, orgId, userId, amount, metadata } = req.body;

    if (!refType || !amount) {
      return res.status(400).json({ error: 'Reference type and amount are required' });
    }

    const [result] = await db.query(
      `INSERT INTO ledger_entries (ref_type, ref_id, pool_id, org_id, user_id, amount, metadata) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [refType, refId, poolId, orgId, userId, amount, metadata ? JSON.stringify(metadata) : null]
    );

    const [entries] = await db.query('SELECT * FROM ledger_entries WHERE id = ?', [result.insertId]);
    res.status(201).json(entries[0]);
  } catch (error) {
    console.error('Create ledger entry error:', error);
    res.status(500).json({ error: 'Failed to create ledger entry' });
  }
});

export default router;
