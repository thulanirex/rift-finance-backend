import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

// Solana network configuration (Devnet for development)
const NETWORK = process.env.SOLANA_NETWORK || 'devnet';
const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl(NETWORK);

// Create Solana connection
export const connection = new Connection(RPC_URL, 'confirmed');

// Program IDs (update these with your deployed program IDs)
export const PROGRAM_ID = process.env.ANCHOR_PROGRAM_ID 
  ? new PublicKey(process.env.ANCHOR_PROGRAM_ID)
  : null;

// Verify connection
connection.getVersion()
  .then(version => {
    console.log(`✅ Solana ${NETWORK} connected - Version:`, version['solana-core']);
  })
  .catch(err => {
    console.warn('⚠️  Solana connection failed (will use SIM mode):', err.message);
  });

export const getSolanaConfig = () => ({
  network: NETWORK,
  rpcUrl: RPC_URL,
  programId: PROGRAM_ID?.toBase58() || null,
  mode: PROGRAM_ID ? 'ANCHOR' : 'SIM'
});

export default connection;
