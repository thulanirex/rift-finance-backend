-- Add missing columns to invoices table
USE rift_finance_hub;

-- Add invoice_number column
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100) AFTER id;

-- Add buyer_country column
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS buyer_country VARCHAR(2) AFTER counterparty;

-- Add buyer_vat column
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS buyer_vat VARCHAR(50) AFTER buyer_country;

-- Add currency column
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR' AFTER status;

-- Update status enum to include all statuses
ALTER TABLE invoices 
MODIFY COLUMN status ENUM('draft', 'pending', 'submitted', 'in_review', 'approved', 'listed', 'funded', 'repaid', 'defaulted') DEFAULT 'pending';

-- Add index on invoice_number
ALTER TABLE invoices 
ADD INDEX IF NOT EXISTS idx_invoice_number (invoice_number);

SELECT 'Invoices table updated successfully' as message;
