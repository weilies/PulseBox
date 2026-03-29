-- Remove leave and payroll placeholder apps (empty bundles, not yet designed)
-- They will be re-added in Phase 3 with proper bundle definitions

DELETE FROM public.apps WHERE slug IN ('leave', 'payroll');
