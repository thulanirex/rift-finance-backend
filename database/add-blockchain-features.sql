-- Add blockchain features to database
USE rift_finance_hub;

-- Add wallet address to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(44) AFTER email;

-- Add blockchain fields to invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS mint_signature VARCHAR(88) AFTER cnft_mint,
ADD COLUMN IF NOT EXISTS fund_signature VARCHAR(88) AFTER mint_signature,
ADD COLUMN IF NOT EXISTS fund_amount DECIMAL(18,2) AFTER fund_signature,
ADD COLUMN IF NOT EXISTS funder_wallet VARCHAR(44) AFTER fund_amount,
ADD COLUMN IF NOT EXISTS funder_id CHAR(36) AFTER funder_wallet;

-- Add foreign key for funder (drop first if exists for MariaDB compatibility)
ALTER TABLE invoices DROP FOREIGN KEY IF EXISTS fk_invoices_funder;
ALTER TABLE invoices
ADD CONSTRAINT fk_invoices_funder 
FOREIGN KEY (funder_id) REFERENCES users(id) ON DELETE SET NULL;

-- Create signatures table for tracking all blockchain signatures
CREATE TABLE IF NOT EXISTS blockchain_signatures (
  id CHAR(36) PRIMARY KEY,
  entity_type ENUM('invoice', 'user', 'organization') NOT NULL,
  entity_id CHAR(36) NOT NULL,
  signer_wallet VARCHAR(44) NOT NULL,
  signature_type ENUM('submission', 'approval', 'funding', 'repayment') NOT NULL,
  signature VARCHAR(88) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_signer (signer_wallet)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Blockchain features added successfully' as message;
