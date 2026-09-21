-- Stage 7B: Dry Beans product model. Reuses the exact classification
-- mechanism Stage 6A built for maize -- no schema change here, only
-- inserts. The existing 'beans-dry' (90kg bag) product is NOT touched
-- by this migration in any way; it keeps serving farmer-preference
-- matching independently of KAMIS pricing, exactly as 'maize-dry' does.
--
-- Unlike Dry Maize (one KAMIS commodity id, three classifications under
-- it), KAMIS reports each dry bean variety as its OWN commodity id, and
-- leaves its own "Classification" column unused ("-") for every bean
-- row -- confirmed by downloading and parsing KAMIS's real export
-- (product ids 29, 30, 64, 65, 66, 67, 183, 246, 269) over the 30 days
-- ending 2026-09-21. Of those, 8 commodity ids had real, active data
-- (625 rows, 0 junk, 100% wholesale+retail present, unit always Kg);
-- id 269 ("Beans (yellow)") returned zero rows and is excluded as
-- inactive. Two other candidates were excluded entirely, not just left
-- out of this migration: id 50 "Dolichos lablab (njahi)" is a distinct
-- legume species, not a dry bean variety, and id 305 "French beans" is
-- a fresh vegetable, not a dry bean at all.
--
-- Since KAMIS's own "Classification" column carries no information for
-- this commodity family, this migration maps our `classification`
-- column to KAMIS's raw *commodity name* instead (the field that
-- actually distinguishes these rows in KAMIS's own data) -- the same
-- role "Classification" played for maize, just sourced from a
-- different KAMIS column for this commodity. Rosecoco and Rosecoco
-- (Nyayo) are kept as two separate products rather than merged: KAMIS
-- itself reports them under two independent commodity ids with
-- independent price series, so collapsing them would be a fuzzy-merge
-- of a distinction KAMIS itself maintains, not a text-variation
-- cleanup.
insert into public.agricultural_price_products (id, name, category, unit, crop_type_id, classification) values
  ('beans-dry-rosecoco', 'Beans (dry)', 'crop', 'kg', 'beans', 'Rosecoco'),
  ('beans-dry-rosecoco-nyayo', 'Beans (dry)', 'crop', 'kg', 'beans', 'Rosecoco (Nyayo)'),
  ('beans-dry-yellow-green', 'Beans (dry)', 'crop', 'kg', 'beans', 'Yellow-Green'),
  ('beans-dry-red-haricot', 'Beans (dry)', 'crop', 'kg', 'beans', 'Red Haricot (Wairimu)'),
  ('beans-dry-mwitemania', 'Beans (dry)', 'crop', 'kg', 'beans', 'Mwitemania'),
  ('beans-dry-mwezi-moja', 'Beans (dry)', 'crop', 'kg', 'beans', 'Mwezi Moja'),
  ('beans-dry-canadian-wonder', 'Beans (dry)', 'crop', 'kg', 'beans', 'Canadian Wonder'),
  ('beans-dry-mixed', 'Beans (dry)', 'crop', 'kg', 'beans', 'Mixed');
