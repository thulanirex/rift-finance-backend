import express from 'express';
import { authenticateToken, requireOperatorOrAdmin } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get all pools (public)
router.get('/', async (req, res) => {
  try {
    const [pools] = await db.query('SELECT * FROM pools ORDER BY tenor_days');
    res.json(pools);
  } catch (error) {
    console.error('Get pools error:', error);
    res.status(500).json({ error: 'Failed to fetch pools' });
  }
});

// Get pool by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [pools] = await db.query('SELECT * FROM pools WHERE id = ?', [id]);

    if (pools.length === 0) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    res.json(pools[0]);
  } catch (error) {
    console.error('Get pool error:', error);
    res.status(500).json({ error: 'Failed to fetch pool' });
  }
});

// Create pool (operator/admin only)
router.post('/', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const { tenorDays, apr, totalLiquidity } = req.body;

    if (!tenorDays || !apr) {
      return res.status(400).json({ error: 'Tenor days and APR are required' });
    }

    const [result] = await db.query(
      'INSERT INTO pools (tenor_days, apr, total_liquidity) VALUES (?, ?, ?)',
      [tenorDays, apr, totalLiquidity || 0]
    );

    const [pools] = await db.query('SELECT * FROM pools WHERE id = ?', [result.insertId]);
    res.status(201).json(pools[0]);
  } catch (error) {
    console.error('Create pool error:', error);
    res.status(500).json({ error: 'Failed to create pool' });
  }
});

// Update pool (operator/admin only)
router.put('/:id', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { apr, totalLiquidity } = req.body;

    const updates = [];
    const values = [];

    if (apr !== undefined) {
      updates.push('apr = ?');
      values.push(apr);
    }
    if (totalLiquidity !== undefined) {
      updates.push('total_liquidity = ?');
      values.push(totalLiquidity);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    await db.query(
      `UPDATE pools SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [pools] = await db.query('SELECT * FROM pools WHERE id = ?', [id]);
    res.json(pools[0]);
  } catch (error) {
    console.error('Update pool error:', error);
    res.status(500).json({ error: 'Failed to update pool' });
  }
});

// Delete pool (operator/admin only)
router.delete('/:id', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM pools WHERE id = ?', [id]);
    res.json({ message: 'Pool deleted successfully' });
  } catch (error) {
    console.error('Delete pool error:', error);
    res.status(500).json({ error: 'Failed to delete pool' });
  }
});

export default router;
