-- Add blockchain features to database
USE rift_finance_hub;

-- Add wallet address to users (check if column exists first)
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'wallet_address';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN wallet_address VARCHAR(44) AFTER email'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add blockchain fields to invoices (one by one with checks)
SET @columnname = 'mint_signature';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = 'invoices')
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoices ADD COLUMN mint_signature VARCHAR(88) AFTER cnft_mint'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'fund_signature';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = 'invoices')
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoices ADD COLUMN fund_signature VARCHAR(88) AFTER mint_signature'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'fund_amount';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = 'invoices')
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoices ADD COLUMN fund_amount DECIMAL(18,2) AFTER fund_signature'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'funder_wallet';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = 'invoices')
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoices ADD COLUMN funder_wallet VARCHAR(44) AFTER fund_amount'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'funder_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = 'invoices')
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoices ADD COLUMN funder_id CHAR(36) AFTER funder_wallet'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add foreign key for funder (check if exists first)
SET @fkExists = (SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_NAME = 'fk_invoices_funder' 
  AND TABLE_SCHEMA = @dbname 
  AND TABLE_NAME = 'invoices');

SET @preparedStatement = IF(@fkExists > 0, 
  'SELECT 1', 
  'ALTER TABLE invoices ADD CONSTRAINT fk_invoices_funder FOREIGN KEY (funder_id) REFERENCES users(id) ON DELETE SET NULL'
);
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

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
