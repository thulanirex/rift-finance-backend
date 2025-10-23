-- Add demo invoices for competition demo
-- First, get or create a demo organization
SET @demo_org_id = (SELECT id FROM organizations LIMIT 1);

-- If no org exists, create one
INSERT INTO organizations (id, name) 
SELECT UUID(), 'Demo Trading Company'
WHERE NOT EXISTS (SELECT 1 FROM organizations LIMIT 1);

SET @demo_org_id = (SELECT id FROM organizations LIMIT 1);

-- Add invoices (matching actual schema: org_id, amount_eur, due_date, counterparty, status, tenor_days, rift_score, rift_grade)
-- Note: tenor_days must be 30, 90, or 120 only
INSERT INTO invoices (id, org_id, amount_eur, due_date, counterparty, status, tenor_days, rift_score, rift_grade) VALUES
(UUID(), @demo_org_id, 125000.00, '2024-11-30', 'BMW AG', 'listed', 30, 85, 'A'),
(UUID(), @demo_org_id, 85000.00, '2024-12-05', 'Siemens AG', 'listed', 30, 82, 'A'),
(UUID(), @demo_org_id, 65000.00, '2024-11-25', 'Carrefour SA', 'listed', 30, 78, 'B'),
(UUID(), @demo_org_id, 95000.00, '2024-12-12', 'Philips NV', 'listed', 90, 88, 'A'),
(UUID(), @demo_org_id, 250000.00, '2025-01-15', 'Airbus SE', 'listed', 120, 92, 'A');

-- Update pools with realistic data (matching actual schema: apr, total_liquidity)
UPDATE pools SET 
  apr = 0.065,
  total_liquidity = 1000000.00
WHERE tenor_days = 30;

UPDATE pools SET 
  apr = 0.075,
  total_liquidity = 2000000.00
WHERE tenor_days = 90;

UPDATE pools SET 
  apr = 0.085,
  total_liquidity = 1500000.00
WHERE tenor_days = 120;

-- Add some sample positions for demo (if funder exists)
-- Matching schema: pool_id, funder_user_id, amount_funded, expected_yield, status
INSERT INTO positions (id, pool_id, funder_user_id, amount_funded, expected_yield, status)
SELECT UUID(), p.id, u.id, 50000.00, 50000.00 * 0.065 * (30/365), 'active'
FROM pools p, users u
WHERE p.tenor_days = 30 AND u.role = 'funder'
LIMIT 1;

INSERT INTO positions (id, pool_id, funder_user_id, amount_funded, expected_yield, status)
SELECT UUID(), p.id, u.id, 100000.00, 100000.00 * 0.085 * (120/365), 'active'
FROM pools p, users u
WHERE p.tenor_days = 120 AND u.role = 'funder'
LIMIT 1;

SELECT 'Demo data added successfully!' as message;
