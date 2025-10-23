import express from 'express';
import { authenticateToken, requireOperatorOrAdmin } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get audit logs (operator/admin only)
router.get('/', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const [logs] = await db.query(`
      SELECT a.*, u.email as actor_email
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_user_id = u.id
      ORDER BY a.timestamp DESC
      LIMIT 1000
    `);
    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Create audit log
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { action, entity, entityId, metadata } = req.body;

    if (!action || !entity) {
      return res.status(400).json({ error: 'Action and entity are required' });
    }

    const [result] = await db.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata) 
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, action, entity, entityId, metadata ? JSON.stringify(metadata) : null]
    );

    const [logs] = await db.query('SELECT * FROM audit_logs WHERE id = ?', [result.insertId]);
    res.status(201).json(logs[0]);
  } catch (error) {
    console.error('Create audit log error:', error);
    res.status(500).json({ error: 'Failed to create audit log' });
  }
});

export default router;
