-- Rename super tenant: "BIPO Service" (bipo) → "Next Novas" (nextnovas)
-- There is only one tenant in the DB; we update name + slug in place.

BEGIN;

-- Rename the tenant
UPDATE public.tenants
SET name = 'Next Novas',
    slug = 'nextnovas'
WHERE slug = 'bipo'
  AND is_super = true;

-- Verify the update succeeded
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = 'nextnovas' AND is_super = true) THEN
    RAISE EXCEPTION 'Rename failed — bipo super tenant not found';
  END IF;
END $$;

COMMIT;
