-- Create organization_documents table for KYB document management
USE rift_finance_hub;

-- Drop table if exists to recreate with proper structure
DROP TABLE IF EXISTS organization_documents;

CREATE TABLE organization_documents (
  id CHAR(36) PRIMARY KEY,
  org_id CHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_hash VARCHAR(64),
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  uploaded_by CHAR(36),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by CHAR(36),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_id (org_id),
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_uploaded_by (uploaded_by),
  CONSTRAINT fk_org_docs_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_org_docs_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_org_docs_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add verification_status to organizations table (if not exists)
-- Note: MySQL doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- Run these separately if columns don't exist:
-- ALTER TABLE organizations ADD COLUMN verification_status ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected') DEFAULT 'draft';
-- ALTER TABLE organizations ADD COLUMN verified_at TIMESTAMP NULL;
-- ALTER TABLE organizations ADD COLUMN verified_by CHAR(36);
-- ALTER TABLE organizations ADD FOREIGN KEY (verified_by) REFERENCES users(id);

SELECT 'Organization documents table created successfully' as message;
