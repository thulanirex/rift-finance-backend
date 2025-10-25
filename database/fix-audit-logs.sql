-- Fix audit_logs table to match the code expectations
USE rift_finance_hub;

-- Rename actor_user_id to user_id
ALTER TABLE audit_logs 
CHANGE COLUMN actor_user_id user_id CHAR(36);

-- Rename entity to entity_type
ALTER TABLE audit_logs 
CHANGE COLUMN entity entity_type VARCHAR(255) NOT NULL;

-- Rename timestamp to created_at
ALTER TABLE audit_logs 
CHANGE COLUMN timestamp created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

SELECT 'Audit logs table fixed successfully' as message;
