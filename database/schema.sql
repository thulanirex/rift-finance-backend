-- MySQL Schema for Rift Finance Hub
-- Converted from PostgreSQL/Supabase schema

-- Create database
CREATE DATABASE IF NOT EXISTS rift_finance_hub;
USE rift_finance_hub;

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(2) NOT NULL,
  vat_number VARCHAR(50),
  eori_number VARCHAR(50),
  iban VARCHAR(50),
  kyb_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  kyb_raw JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_organizations_vat (vat_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  provider ENUM('privy', 'web3auth') NOT NULL,
  address VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users table (auth_users for authentication)
CREATE TABLE IF NOT EXISTS auth_users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_auth_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users table (application users)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  auth_id CHAR(36),
  email VARCHAR(255) UNIQUE NOT NULL,
  role ENUM('seller', 'buyer', 'funder', 'operator', 'admin') NOT NULL,
  org_id CHAR(36),
  wallet_id CHAR(36),
  wallet_address VARCHAR(255),
  civic_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (auth_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  INDEX idx_users_org (org_id),
  INDEX idx_users_auth (auth_id),
  INDEX idx_users_wallet (wallet_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  org_id CHAR(36) NOT NULL,
  amount_eur DECIMAL(18,2) NOT NULL,
  due_date DATE NOT NULL,
  counterparty VARCHAR(255) NOT NULL,
  file_url TEXT,
  file_hash VARCHAR(255),
  cnft_mint VARCHAR(255),
  rift_score INT,
  rift_grade ENUM('A', 'B', 'C'),
  status ENUM('draft', 'listed', 'funded', 'repaid', 'defaulted') DEFAULT 'draft',
  tenor_days INT CHECK (tenor_days IN (30, 90, 120)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_invoices_org (org_id),
  INDEX idx_invoices_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pools table
CREATE TABLE IF NOT EXISTS pools (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenor_days INT UNIQUE NOT NULL CHECK (tenor_days IN (30, 90, 120)),
  apr DECIMAL(6,3) NOT NULL,
  total_liquidity DECIMAL(18,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  pool_id CHAR(36) NOT NULL,
  funder_user_id CHAR(36) NOT NULL,
  invoice_id CHAR(36),
  amount_funded DECIMAL(18,2) NOT NULL,
  expected_yield DECIMAL(18,2) NOT NULL,
  accrued_yield DECIMAL(18,2) DEFAULT 0,
  status ENUM('active', 'closed', 'defaulted') DEFAULT 'active',
  tx_signature VARCHAR(255),
  network VARCHAR(20) DEFAULT 'devnet',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE,
  FOREIGN KEY (funder_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX idx_positions_pool (pool_id),
  INDEX idx_positions_funder (funder_user_id),
  INDEX idx_positions_invoice (invoice_id),
  INDEX idx_positions_tx (tx_signature)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ledger entries table
CREATE TABLE IF NOT EXISTS ledger_entries (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  ref_type ENUM('deposit', 'payout', 'repayment_inflow', 'distribution', 'fee') NOT NULL,
  ref_id CHAR(36),
  pool_id CHAR(36),
  org_id CHAR(36),
  user_id CHAR(36),
  amount DECIMAL(18,2) NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pool_id) REFERENCES pools(id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_ledger_pool (pool_id),
  INDEX idx_ledger_org (org_id),
  INDEX idx_ledger_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  actor_user_id CHAR(36),
  action VARCHAR(255) NOT NULL,
  entity VARCHAR(255) NOT NULL,
  entity_id CHAR(36),
  metadata JSON,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id),
  INDEX idx_audit_actor (actor_user_id),
  INDEX idx_audit_entity (entity, entity_id),
  INDEX idx_audit_timestamp (timestamp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bank accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  country VARCHAR(2) NOT NULL,
  iban VARCHAR(50) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_bank_accounts_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Allowlist wallets table
CREATE TABLE IF NOT EXISTS allowlist_wallets (
  wallet_address VARCHAR(255) PRIMARY KEY,
  note TEXT,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed pools data
INSERT INTO pools (id, tenor_days, apr) VALUES
  (UUID(), 30, 5.000),
  (UUID(), 90, 7.000),
  (UUID(), 120, 10.000)
ON DUPLICATE KEY UPDATE apr = VALUES(apr);

-- Seed organizations
INSERT INTO organizations (id, name, country, vat_number, eori_number, iban, kyb_status, kyb_raw) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ardmore Exports Ltd', 'IE', 'IE1234567A', 'IE123456789', 'IE12BOFI90000112345678', 'approved', '{"review": {"status": "completed", "result": "approved", "risk_score": 0.14}, "reference_id": "MOCK-KYB-001"}'),
  ('22222222-2222-2222-2222-222222222222', 'Baltic Foods GmbH', 'DE', 'DE123456789', 'DE987654321', 'DE89370400440532013000', 'pending', '{"review": {"status": "pending"}, "reference_id": "MOCK-KYB-002"}'),
  ('33333333-3333-3333-3333-333333333333', 'Cordoba Trading SRL', 'ES', 'ESX1234567X', 'ES246813579', 'ES9121000418450200051332', 'rejected', '{"review": {"status": "completed", "result": "rejected", "risk_score": 0.87, "reason": "Adverse media findings"}, "reference_id": "MOCK-KYB-003"}')
ON DUPLICATE KEY UPDATE name = VALUES(name);
