-- Fix country column to accept full country names instead of just 2-letter codes
USE rift_finance_hub;

-- Increase country column size to accept full country names
ALTER TABLE organizations 
MODIFY COLUMN country VARCHAR(100) NOT NULL;

SELECT 'Country column updated to accept full country names' as message;
