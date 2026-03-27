-- Rename remaining "BIPO" references in roles table to "Next Novas"
UPDATE public.roles
SET description = REPLACE(description, 'BIPO', 'Next Novas')
WHERE description LIKE '%BIPO%';