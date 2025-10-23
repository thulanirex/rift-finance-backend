import express from 'express';
import { authenticateToken, requireOperatorOrAdmin } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get all organizations
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM organizations';
    const params = [];

    // Non-operators can only see their own org
    if (!['operator', 'admin'].includes(req.user.role)) {
      query += ' WHERE id = ?';
      params.push(req.user.org_id);
    }

    const [organizations] = await db.query(query, params);
    res.json(organizations);
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get organization by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check access
    if (req.user.org_id !== id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [organizations] = await db.query('SELECT * FROM organizations WHERE id = ?', [id]);

    if (organizations.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(organizations[0]);
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Create organization
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, country, vatNumber, eoriNumber, iban } = req.body;

    if (!name || !country) {
      return res.status(400).json({ error: 'Name and country are required' });
    }

    const [result] = await db.query(
      'INSERT INTO organizations (name, country, vat_number, eori_number, iban) VALUES (?, ?, ?, ?, ?)',
      [name, country, vatNumber, eoriNumber, iban]
    );

    const [organizations] = await db.query('SELECT * FROM organizations WHERE id = ?', [result.insertId]);
    res.status(201).json(organizations[0]);
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// Update organization
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check access
    if (req.user.org_id !== id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, country, vatNumber, eoriNumber, iban, kybStatus, kybRaw } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (country !== undefined) {
      updates.push('country = ?');
      values.push(country);
    }
    if (vatNumber !== undefined) {
      updates.push('vat_number = ?');
      values.push(vatNumber);
    }
    if (eoriNumber !== undefined) {
      updates.push('eori_number = ?');
      values.push(eoriNumber);
    }
    if (iban !== undefined) {
      updates.push('iban = ?');
      values.push(iban);
    }
    if (kybStatus !== undefined && ['operator', 'admin'].includes(req.user.role)) {
      updates.push('kyb_status = ?');
      values.push(kybStatus);
    }
    if (kybRaw !== undefined && ['operator', 'admin'].includes(req.user.role)) {
      updates.push('kyb_raw = ?');
      values.push(JSON.stringify(kybRaw));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    await db.query(
      `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [organizations] = await db.query('SELECT * FROM organizations WHERE id = ?', [id]);
    res.json(organizations[0]);
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Delete organization (operator/admin only)
router.delete('/:id', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM organizations WHERE id = ?', [id]);
    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

export default router;
