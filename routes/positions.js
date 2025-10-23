import express from 'express';
import { authenticateToken, requireOperatorOrAdmin } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get all positions
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT p.*, 
             u.email as funder_email,
             i.amount_eur as invoice_amount,
             i.counterparty as invoice_counterparty,
             pool.tenor_days as pool_tenor
      FROM positions p
      LEFT JOIN users u ON p.funder_user_id = u.id
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN pools pool ON p.pool_id = pool.id
    `;
    const params = [];

    // Non-operators can only see their own positions
    if (!['operator', 'admin'].includes(req.user.role)) {
      query += ' WHERE p.funder_user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY p.created_at DESC';

    const [positions] = await db.query(query, params);
    res.json(positions);
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Get position by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [positions] = await db.query(`
      SELECT p.*, 
             u.email as funder_email,
             i.amount_eur as invoice_amount,
             i.counterparty as invoice_counterparty,
             pool.tenor_days as pool_tenor
      FROM positions p
      LEFT JOIN users u ON p.funder_user_id = u.id
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN pools pool ON p.pool_id = pool.id
      WHERE p.id = ?
    `, [id]);

    if (positions.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const position = positions[0];

    // Check access
    if (position.funder_user_id !== req.user.id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(position);
  } catch (error) {
    console.error('Get position error:', error);
    res.status(500).json({ error: 'Failed to fetch position' });
  }
});

// Create position
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { poolId, invoiceId, amountFunded, expectedYield } = req.body;

    if (!poolId || !invoiceId || !amountFunded || !expectedYield) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await db.query(
      `INSERT INTO positions (pool_id, funder_user_id, invoice_id, amount_funded, expected_yield) 
       VALUES (?, ?, ?, ?, ?)`,
      [poolId, req.user.id, invoiceId, amountFunded, expectedYield]
    );

    const [positions] = await db.query('SELECT * FROM positions WHERE id = ?', [result.insertId]);
    res.status(201).json(positions[0]);
  } catch (error) {
    console.error('Create position error:', error);
    res.status(500).json({ error: 'Failed to create position' });
  }
});

// Update position
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if position exists and user has access
    const [existingPositions] = await db.query('SELECT * FROM positions WHERE id = ?', [id]);
    if (existingPositions.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const position = existingPositions[0];
    if (position.funder_user_id !== req.user.id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { accruedYield, status } = req.body;

    const updates = [];
    const values = [];

    if (accruedYield !== undefined) {
      updates.push('accrued_yield = ?');
      values.push(accruedYield);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    await db.query(
      `UPDATE positions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [positions] = await db.query('SELECT * FROM positions WHERE id = ?', [id]);
    res.json(positions[0]);
  } catch (error) {
    console.error('Update position error:', error);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

// Delete position (operator/admin only)
router.delete('/:id', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM positions WHERE id = ?', [id]);
    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

export default router;
