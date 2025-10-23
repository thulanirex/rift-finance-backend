import express from 'express';
import { authenticateToken, requireOperatorOrAdmin } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get all invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT i.*, o.name as org_name 
      FROM invoices i 
      LEFT JOIN organizations o ON i.org_id = o.id
    `;
    const params = [];

    // Non-operators can only see their org's invoices
    if (!['operator', 'admin'].includes(req.user.role)) {
      query += ' WHERE i.org_id = ?';
      params.push(req.user.org_id);
    }

    query += ' ORDER BY i.created_at DESC';

    const [invoices] = await db.query(query, params);
    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get invoice by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [invoices] = await db.query(`
      SELECT i.*, o.name as org_name 
      FROM invoices i 
      LEFT JOIN organizations o ON i.org_id = o.id
      WHERE i.id = ?
    `, [id]);

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoices[0];

    // Check access
    if (invoice.org_id !== req.user.org_id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Create invoice
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      invoiceNumber, 
      amountEur, 
      dueDate, 
      counterparty, 
      buyerCountry,
      buyerVat,
      fileUrl, 
      fileHash, 
      tenorDays 
    } = req.body;

    if (!amountEur || !dueDate || !counterparty || !tenorDays) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!req.user.org_id) {
      return res.status(400).json({ error: 'User must belong to an organization' });
    }

    // Generate invoice number if not provided
    const invNumber = invoiceNumber || `INV-${Date.now()}`;

    const [result] = await db.query(
      `INSERT INTO invoices (
        org_id, invoice_number, amount_eur, due_date, counterparty, 
        buyer_country, buyer_vat, file_url, file_hash, tenor_days, 
        status, currency
      ) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'EUR')`,
      [
        req.user.org_id, 
        invNumber, 
        amountEur, 
        dueDate, 
        counterparty, 
        buyerCountry || null,
        buyerVat || null,
        fileUrl || null, 
        fileHash || null, 
        tenorDays
      ]
    );

    const [invoices] = await db.query('SELECT * FROM invoices WHERE id = ?', [result.insertId]);
    
    // Log the creation
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata) 
       VALUES (?, 'create', 'invoice', ?, ?)`,
      [req.user.id, result.insertId, JSON.stringify({ amount: amountEur, tenor: tenorDays })]
    );

    res.status(201).json(invoices[0]);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update invoice
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if invoice exists and user has access
    const [existingInvoices] = await db.query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (existingInvoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = existingInvoices[0];
    if (invoice.org_id !== req.user.org_id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { amountEur, dueDate, counterparty, fileUrl, fileHash, cnftMint, riftScore, riftGrade, status, tenorDays } = req.body;

    const updates = [];
    const values = [];

    if (amountEur !== undefined) {
      updates.push('amount_eur = ?');
      values.push(amountEur);
    }
    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      values.push(dueDate);
    }
    if (counterparty !== undefined) {
      updates.push('counterparty = ?');
      values.push(counterparty);
    }
    if (fileUrl !== undefined) {
      updates.push('file_url = ?');
      values.push(fileUrl);
    }
    if (fileHash !== undefined) {
      updates.push('file_hash = ?');
      values.push(fileHash);
    }
    if (cnftMint !== undefined) {
      updates.push('cnft_mint = ?');
      values.push(cnftMint);
    }
    if (riftScore !== undefined) {
      updates.push('rift_score = ?');
      values.push(riftScore);
    }
    if (riftGrade !== undefined) {
      updates.push('rift_grade = ?');
      values.push(riftGrade);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (tenorDays !== undefined) {
      updates.push('tenor_days = ?');
      values.push(tenorDays);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    await db.query(
      `UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [invoices] = await db.query('SELECT * FROM invoices WHERE id = ?', [id]);
    res.json(invoices[0]);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Delete invoice
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if invoice exists and user has access
    const [existingInvoices] = await db.query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (existingInvoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = existingInvoices[0];
    if (invoice.org_id !== req.user.org_id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query('DELETE FROM invoices WHERE id = ?', [id]);
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;
