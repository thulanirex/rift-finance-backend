import express from 'express';
import { authenticateToken, requireOperatorOrAdmin } from '../middleware/auth.js';
import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Record blockchain signature
router.post('/signatures', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId, signatureType, signature, message, walletAddress } = req.body;

    if (!entityType || !entityId || !signatureType || !signature || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();
    
    await db.query(
      `INSERT INTO blockchain_signatures 
       (id, entity_type, entity_id, signer_wallet, signature_type, signature, message) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, entityType, entityId, walletAddress || req.user.wallet_address, signatureType, signature, message]
    );

    // Log the signature
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata) 
       VALUES (?, 'sign', ?, ?, ?)`,
      [req.user.id, entityType, entityId, JSON.stringify({ signatureType, walletAddress })]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Signature recording error:', error);
    res.status(500).json({ error: 'Failed to record signature' });
  }
});

// Get signatures for an entity
router.get('/signatures/:entityType/:entityId', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    const [signatures] = await db.query(
      `SELECT bs.*, u.email as signer_email 
       FROM blockchain_signatures bs
       LEFT JOIN users u ON bs.signer_wallet = u.wallet_address
       WHERE bs.entity_type = ? AND bs.entity_id = ? 
       ORDER BY bs.created_at DESC`,
      [entityType, entityId]
    );

    res.json(signatures);
  } catch (error) {
    console.error('Get signatures error:', error);
    res.status(500).json({ error: 'Failed to fetch signatures' });
  }
});

// Update user wallet address
router.post('/wallet/connect', authenticateToken, async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    // Check if wallet is already connected to another user
    const [existing] = await db.query(
      'SELECT id, email FROM users WHERE wallet_address = ? AND id != ?',
      [walletAddress, req.user.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        error: 'This wallet is already connected to another account',
        existingUser: existing[0].email
      });
    }

    // Update user's wallet address
    await db.query(
      'UPDATE users SET wallet_address = ? WHERE id = ?',
      [walletAddress, req.user.id]
    );

    // Log the connection
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata) 
       VALUES (?, 'connect_wallet', 'user', ?, ?)`,
      [req.user.id, req.user.id, JSON.stringify({ walletAddress })]
    );

    res.json({ success: true, walletAddress });
  } catch (error) {
    console.error('Wallet connect error:', error);
    res.status(500).json({ error: 'Failed to connect wallet' });
  }
});

// Mint invoice cNFT (operator only)
router.post('/invoices/:id/mint', authenticateToken, requireOperatorOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress, metadata, mintSignature, mintAddress } = req.body;

    // Get invoice
    const [invoices] = await db.query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoices[0];

    // Check if already minted
    if (invoice.cnft_mint) {
      return res.status(400).json({ error: 'Invoice already minted' });
    }

    // Update invoice with mint info
    await db.query(
      `UPDATE invoices 
       SET cnft_mint = ?, mint_signature = ?, mint_tx = ?, status = 'listed' 
       WHERE id = ?`,
      [mintAddress, mintSignature, mintSignature, id]
    );

    // Log the minting
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata) 
       VALUES (?, 'mint_nft', 'invoice', ?, ?)`,
      [req.user.id, id, JSON.stringify({ mintAddress, mintSignature })]
    );

    res.json({ 
      success: true, 
      mintAddress,
      signature: mintSignature,
      explorerUrl: `https://explorer.solana.com/address/${mintAddress}?cluster=devnet`
    });
  } catch (error) {
    console.error('Mint error:', error);
    res.status(500).json({ error: 'Failed to mint NFT' });
  }
});

// Record funding transaction
router.post('/invoices/:id/fund', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { fundSignature, fundAmount, walletAddress } = req.body;

    if (!fundSignature || !fundAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get invoice
    const [invoices] = await db.query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoices[0];

    if (invoice.status !== 'listed' && invoice.status !== 'approved') {
      return res.status(400).json({ error: 'Invoice not available for funding' });
    }

    // Update invoice with funding info
    await db.query(
      `UPDATE invoices 
       SET fund_signature = ?, fund_amount = ?, funder_wallet = ?, 
           funder_id = ?, status = 'funded' 
       WHERE id = ?`,
      [fundSignature, fundAmount, walletAddress, req.user.id, id]
    );

    // Log the funding
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata) 
       VALUES (?, 'fund', 'invoice', ?, ?)`,
      [req.user.id, id, JSON.stringify({ fundAmount, fundSignature })]
    );

    res.json({ 
      success: true, 
      signature: fundSignature,
      explorerUrl: `https://explorer.solana.com/tx/${fundSignature}?cluster=devnet`
    });
  } catch (error) {
    console.error('Funding error:', error);
    res.status(500).json({ error: 'Failed to record funding' });
  }
});

export default router;
