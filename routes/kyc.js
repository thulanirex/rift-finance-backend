import express from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const DIDIT_API_KEY = 'FW9cz132tlifJKKz1yGzLbO2VCpr0sZLAaErswDTGQw';
const DIDIT_APP_ID = 'b0629c0c-9e5a-4414-b4d4-169212690d30';
// You need to get your workflow_id from Didit Business Console
// Go to https://business.didit.me -> Verifications -> Workflows
const DIDIT_WORKFLOW_ID = DIDIT_APP_ID; // Using app_id as workflow_id for now - replace with actual workflow_id

// Start KYC verification
router.post('/start-verification', authenticateToken, async (req, res) => {
  try {
    const { userId, email } = req.body;
    
    console.log('🔐 Starting Didit KYC verification for:', email);

    // Create verification session with Didit (v2 API)
    const response = await axios.post(
      'https://verification.didit.me/v2/session/',
      {
        workflow_id: DIDIT_WORKFLOW_ID,
        vendor_data: userId, // Your user identifier
        callback: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/kyc/webhook`,
        contact_details: {
          email: email,
          email_lang: 'en'
        },
        metadata: {
          user_id: userId,
          email: email
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': DIDIT_API_KEY
        }
      }
    );

    console.log('✅ Didit verification session created:', response.data.session_id);

    res.json({
      success: true,
      verification_url: response.data.url,
      session_id: response.data.session_id,
      session_token: response.data.session_token
    });

  } catch (error) {
    console.error('❌ Didit KYC error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to start KYC verification',
      details: error.response?.data || error.message
    });
  }
});

// Check KYC status via Didit API
router.get('/verification-status/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const response = await axios.get(
      `https://verification.didit.me/v2/session/${sessionId}/decision/`,
      {
        headers: {
          'x-api-key': DIDIT_API_KEY
        }
      }
    );

    res.json({
      success: true,
      status: response.data.status,
      data: response.data
    });

  } catch (error) {
    console.error('❌ Failed to check KYC status:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to check verification status',
      details: error.response?.data || error.message
    });
  }
});

// Webhook endpoint for Didit callbacks (public - no auth)
router.post('/webhook', async (req, res) => {
  try {
    console.log('📥 Didit webhook received:', JSON.stringify(req.body, null, 2));

    const { session_id, vendor_data, status, workflow_id, decision } = req.body;

    // TODO: Verify webhook signature using x-signature header
    // const signature = req.headers['x-signature'];
    
    // TODO: Update user's KYC status in database
    console.log(`✅ Session ${session_id} for user ${vendor_data}: ${status}`);
    if (decision) {
      console.log(`Decision: ${decision.status}`);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get current user's KYC status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { session_id } = req.query; // Pass session_id from frontend
    
    if (!session_id) {
      // No session yet - user hasn't started KYC
      return res.json({
        success: true,
        status: 'unverified',
        verified_at: null,
        session_id: null
      });
    }

    // Check status with Didit API
    try {
      const response = await axios.get(
        `https://verification.didit.me/v2/session/${session_id}/decision/`,
        {
          headers: {
            'x-api-key': DIDIT_API_KEY
          }
        }
      );

      console.log('📊 Didit session status:', response.data.status);

      // Map Didit status to our status
      let mappedStatus = 'pending';
      if (response.data.decision?.status === 'approved') {
        mappedStatus = 'verified';
      } else if (response.data.decision?.status === 'rejected') {
        mappedStatus = 'rejected';
      } else if (response.data.status === 'completed') {
        mappedStatus = 'pending'; // Completed but awaiting decision
      }

      res.json({
        success: true,
        status: mappedStatus,
        verified_at: response.data.decision?.status === 'approved' ? new Date().toISOString() : null,
        session_id: session_id,
        didit_status: response.data.status,
        decision: response.data.decision
      });

    } catch (apiError) {
      // Session not found or error - treat as unverified
      console.log('⚠️ Could not fetch session status:', apiError.response?.status);
      res.json({
        success: true,
        status: 'unverified',
        verified_at: null,
        session_id: null
      });
    }

  } catch (error) {
    console.error('❌ Failed to get KYC status:', error);
    res.status(500).json({ error: 'Failed to get KYC status' });
  }
});

export default router;
