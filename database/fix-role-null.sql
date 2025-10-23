-- Allow NULL values for role column during registration
-- Users will select their role after registration

ALTER TABLE users MODIFY COLUMN role ENUM('seller', 'buyer', 'funder', 'operator', 'admin') NULL;

SELECT 'Role column updated to allow NULL values' as message;
