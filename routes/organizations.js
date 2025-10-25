import express from 'express';
import crypto from 'crypto';
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
    console.log('📝 Creating organization with data:', req.body);
    const { name, country, vatNumber, eoriNumber, iban } = req.body;

    if (!name || !country) {
      console.log('❌ Validation failed - missing name or country');
      return res.status(400).json({ error: 'Name and country are required' });
    }

    // Generate UUID for the organization
    const orgId = crypto.randomUUID();

    const [result] = await db.query(
      'INSERT INTO organizations (id, name, country, vat_number, eori_number, iban) VALUES (?, ?, ?, ?, ?, ?)',
      [orgId, name, country, vatNumber || null, eoriNumber || null, iban || null]
    );

    console.log('✅ Organization created with ID:', orgId);

    const [organizations] = await db.query('SELECT * FROM organizations WHERE id = ?', [orgId]);
    
    console.log('📤 Sending organization data:', organizations[0]);
    res.status(201).json(organizations[0]);
  } catch (error) {
    console.error('❌ Create organization error:', error);
    res.status(500).json({ error: 'Failed to create organization', details: error.message });
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

// Get organization documents
router.get('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check access
    if (req.user.org_id !== id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [documents] = await db.query(
      'SELECT * FROM organization_documents WHERE org_id = ? ORDER BY uploaded_at DESC',
      [id]
    );

    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Add organization document
router.post('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, filename, fileUrl, fileHash } = req.body;

    // Check access
    if (req.user.org_id !== id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!type || !filename || !fileUrl) {
      return res.status(400).json({ error: 'Type, filename, and fileUrl are required' });
    }

    console.log('📄 Adding document:', { type, filename, org_id: id });

    // Check if document type already exists, if so update it
    const [existing] = await db.query(
      'SELECT id FROM organization_documents WHERE org_id = ? AND type = ?',
      [id, type]
    );

    if (existing.length > 0) {
      // Update existing document
      await db.query(
        'UPDATE organization_documents SET filename = ?, file_url = ?, file_hash = ?, uploaded_by = ?, uploaded_at = NOW(), status = ? WHERE id = ?',
        [filename, fileUrl, fileHash || null, req.user.id, 'pending', existing[0].id]
      );

      const [updated] = await db.query(
        'SELECT * FROM organization_documents WHERE id = ?',
        [existing[0].id]
      );

      console.log('✅ Document updated:', updated[0].id);
      return res.json(updated[0]);
    }

    // Insert new document
    // Generate UUID manually since MySQL's UUID() doesn't return insertId
    const { randomUUID } = await import('crypto');
    const docId = randomUUID();
    
    await db.query(
      'INSERT INTO organization_documents (id, org_id, type, filename, file_url, file_hash, uploaded_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [docId, id, type, filename, fileUrl, fileHash || null, req.user.id, 'pending']
    );

    const [documents] = await db.query(
      'SELECT * FROM organization_documents WHERE id = ?',
      [docId]
    );

    console.log('✅ Document added:', documents[0].id);
    res.status(201).json(documents[0]);
  } catch (error) {
    console.error('Add document error:', error);
    res.status(500).json({ error: 'Failed to add document', details: error.message });
  }
});

// Update document status (operator/admin only)
router.put('/:id/documents/:docId', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const { id, docId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updates = ['status = ?', 'reviewed_by = ?', 'reviewed_at = NOW()'];
    const values = [status, req.user.id];

    if (status === 'rejected' && rejectionReason) {
      updates.push('rejection_reason = ?');
      values.push(rejectionReason);
    }

    values.push(docId);

    await db.query(
      `UPDATE organization_documents SET ${updates.join(', ')} WHERE id = ? AND org_id = ?`,
      [...values, id]
    );

    const [documents] = await db.query(
      'SELECT * FROM organization_documents WHERE id = ?',
      [docId]
    );

    res.json(documents[0]);
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id/documents/:docId', authenticateToken, async (req, res) => {
  try {
    const { id, docId } = req.params;

    // Check access
    if (req.user.org_id !== id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query(
      'DELETE FROM organization_documents WHERE id = ? AND org_id = ?',
      [docId, id]
    );

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
