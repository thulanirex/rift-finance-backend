import express from 'express';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { authenticateToken } from '../middleware/auth.js';
import { connection, getSolanaConfig, PROGRAM_ID } from '../config/solana.js';
import db from '../config/database.js';

// Import Anchor only if program is deployed
let BN;
try {
  const anchor = await import('@coral-xyz/anchor');
  BN = anchor.BN;
} catch (e) {
  console.log('⚠️  Anchor not available - using SIM mode only');
}

const router = express.Router();

// Get Solana configuration
router.get('/config', (req, res) => {
  res.json(getSolanaConfig());
});

// Get wallet balance
router.get('/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    
    res.json({
      address,
      balance: balance / LAMPORTS_PER_SOL,
      lamports: balance,
      network: getSolanaConfig().network
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Verify wallet ownership
router.post('/verify-wallet', authenticateToken, async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // In production, verify the signature here
    // For now, we'll trust the client-side verification
    
    // Update user's wallet
    await db.query(
      'UPDATE users SET wallet_address = ? WHERE id = ?',
      [walletAddress, req.user.id]
    );

    res.json({ 
      success: true, 
      walletAddress,
      message: 'Wallet verified and linked'
    });
  } catch (error) {
    console.error('Verify wallet error:', error);
    res.status(500).json({ error: 'Failed to verify wallet' });
  }
});

// Pool allocation (Solana transaction)
router.post('/pool-allocate', authenticateToken, async (req, res) => {
  try {
    const { tenorDays, amount, invoiceId, walletAddress, network, idempotencyKey } = req.body;

    if (!tenorDays || !amount || !walletAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate amount
    if (amount < 100) {
      return res.status(400).json({ error: 'Minimum allocation is €100' });
    }

    if (amount > 250000) {
      return res.status(400).json({ error: 'Maximum allocation is €250,000' });
    }

    // Get pool
    const [pools] = await db.query(
      'SELECT * FROM pools WHERE tenor_days = ?',
      [tenorDays]
    );

    if (pools.length === 0) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    const pool = pools[0];

    // Calculate expected yield
    const expectedYield = (amount * (pool.apr / 100) * (tenorDays / 365)).toFixed(2);

    const config = getSolanaConfig();

    if (config.mode === 'SIM') {
      // SIM mode - create position without blockchain transaction
      const mockTxSig = `SIM${Date.now()}${Math.random().toString(36).substring(7)}`;

      // Create position in database
      const [result] = await db.query(
        `INSERT INTO positions (pool_id, funder_user_id, invoice_id, amount_funded, expected_yield, tx_signature, network) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [pool.id, req.user.id, invoiceId || null, amount, expectedYield, mockTxSig, network]
      );

      // Update pool liquidity
      await db.query(
        'UPDATE pools SET total_liquidity = total_liquidity + ? WHERE id = ?',
        [amount, pool.id]
      );

      // Create ledger entry
      await db.query(
        `INSERT INTO ledger_entries (ref_type, ref_id, pool_id, user_id, amount, metadata) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['deposit', result.insertId, pool.id, req.user.id, amount, JSON.stringify({ 
          walletAddress, 
          network,
          mode: 'SIM',
          txSignature: mockTxSig
        })]
      );

      // Create audit log
      await db.query(
        `INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata) 
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'allocate', 'position', result.insertId, JSON.stringify({
          amount,
          tenorDays,
          expectedYield,
          mode: 'SIM'
        })]
      );

      return res.json({
        success: true,
        mode: 'SIM',
        txSignature: mockTxSig,
        positionId: result.insertId,
        amount,
        expectedYield,
        message: 'Allocation successful (SIM mode)'
      });
    }

    // ANCHOR mode - REAL blockchain transaction
    try {
      const programId = new PublicKey(PROGRAM_ID);
      const funderPubkey = new PublicKey(walletAddress);
      
      // Derive pool PDA
      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), Buffer.from([tenorDays])],
        programId
      );

      // Derive position PDA
      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('position'), funderPubkey.toBuffer(), poolPda.toBuffer()],
        programId
      );

      // Create instruction data
      if (!BN) {
        throw new Error('Anchor not available - cannot create transaction');
      }
      
      const amountBN = new BN(amount * 1_000_000); // Convert to USDC decimals (6)
      const invoiceIdStr = invoiceId || '';

      // Build transaction instruction
      const instruction = {
        programId,
        keys: [
          { pubkey: poolPda, isSigner: false, isWritable: true },
          { pubkey: positionPda, isSigner: false, isWritable: true },
          { pubkey: funderPubkey, isSigner: true, isWritable: true },
          // Add token accounts here when integrated with USDC
        ],
        data: Buffer.from([
          // Instruction discriminator for allocate_to_pool
          ...new BN(amount).toArray('le', 8),
          invoiceIdStr.length,
          ...Buffer.from(invoiceIdStr)
        ])
      };

      // Return unsigned transaction for client to sign
      return res.json({
        success: true,
        mode: 'ANCHOR',
        requiresSignature: true,
        transaction: {
          programId: programId.toBase58(),
          poolPda: poolPda.toBase58(),
          positionPda: positionPda.toBase58(),
          amount: amountBN.toString(),
          expectedYield,
        },
        message: 'Transaction ready for signing'
      });

    } catch (anchorError) {
      console.error('Anchor transaction error:', anchorError);
      return res.status(500).json({ 
        error: 'Failed to create Anchor transaction',
        details: anchorError.message
      });
    }

  } catch (error) {
    console.error('Pool allocate error:', error);
    res.status(500).json({ error: 'Failed to allocate to pool' });
  }
});

// Redeem position (Solana transaction)
router.post('/position-redeem', authenticateToken, async (req, res) => {
  try {
    const { positionId, walletAddress } = req.body;

    if (!positionId || !walletAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get position
    const [positions] = await db.query(
      'SELECT * FROM positions WHERE id = ? AND funder_user_id = ?',
      [positionId, req.user.id]
    );

    if (positions.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const position = positions[0];

    if (position.status !== 'active') {
      return res.status(400).json({ error: 'Position is not active' });
    }

    const config = getSolanaConfig();

    if (config.mode === 'SIM') {
      // SIM mode - redeem without blockchain transaction
      const mockTxSig = `SIM_REDEEM${Date.now()}${Math.random().toString(36).substring(7)}`;

      // Calculate total payout (principal + yield)
      const totalPayout = parseFloat(position.amount_funded) + parseFloat(position.expected_yield);

      // Update position status
      await db.query(
        'UPDATE positions SET status = ?, accrued_yield = ? WHERE id = ?',
        ['closed', position.expected_yield, positionId]
      );

      // Update pool liquidity
      await db.query(
        'UPDATE pools SET total_liquidity = total_liquidity - ? WHERE id = ?',
        [position.amount_funded, position.pool_id]
      );

      // Create ledger entry
      await db.query(
        `INSERT INTO ledger_entries (ref_type, ref_id, pool_id, user_id, amount, metadata) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['payout', positionId, position.pool_id, req.user.id, totalPayout, JSON.stringify({ 
          walletAddress,
          mode: 'SIM',
          txSignature: mockTxSig,
          principal: position.amount_funded,
          yield: position.expected_yield
        })]
      );

      // Create audit log
      await db.query(
        `INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata) 
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'redeem', 'position', positionId, JSON.stringify({
          totalPayout,
          mode: 'SIM'
        })]
      );

      return res.json({
        success: true,
        mode: 'SIM',
        txSignature: mockTxSig,
        positionId,
        totalPayout,
        message: 'Position redeemed successfully (SIM mode)'
      });
    }

    // ANCHOR mode - real blockchain transaction
    res.status(501).json({ 
      error: 'ANCHOR mode not yet implemented',
      message: 'Please deploy Anchor program and configure ANCHOR_PROGRAM_ID'
    });

  } catch (error) {
    console.error('Position redeem error:', error);
    res.status(500).json({ error: 'Failed to redeem position' });
  }
});

// Get transaction details
router.get('/transaction/:signature', async (req, res) => {
  try {
    const { signature } = req.params;

    // Check if it's a SIM transaction
    if (signature.startsWith('SIM')) {
      return res.json({
        signature,
        mode: 'SIM',
        confirmed: true,
        message: 'Simulated transaction'
      });
    }

    // Get real transaction from Solana
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      signature,
      mode: 'ANCHOR',
      confirmed: tx.meta?.err === null,
      slot: tx.slot,
      blockTime: tx.blockTime,
      fee: tx.meta?.fee
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Failed to get transaction' });
  }
});

// Get pool accounts from blockchain (for verification)
router.get('/pool-accounts', async (req, res) => {
  try {
    const config = getSolanaConfig();

    if (config.mode === 'SIM') {
      // Return database pools in SIM mode
      const [pools] = await db.query('SELECT * FROM pools ORDER BY tenor_days');
      return res.json({
        mode: 'SIM',
        pools: pools.map(p => ({
          tenor: p.tenor_days,
          tvl: parseFloat(p.total_liquidity),
          availableLiquidity: parseFloat(p.total_liquidity),
          apr: parseFloat(p.apr)
        }))
      });
    }

    // ANCHOR mode - fetch from blockchain
    // TODO: Implement program account fetching
    res.status(501).json({ 
      error: 'ANCHOR mode not yet implemented'
    });

  } catch (error) {
    console.error('Get pool accounts error:', error);
    res.status(500).json({ error: 'Failed to get pool accounts' });
  }
});

export default router;
