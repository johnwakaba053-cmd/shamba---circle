-- Initial agricultural_markets catalogue (Stage 6B). Populates the
-- markets the Stage 5 KAMIS importer needs in order to stop
-- quarantining every row as unknown_market -- agricultural_markets was
-- empty before this migration (verified live).
--
-- Discovery method: the same official KAMIS export mechanism already
-- used by the real importer (never HTML scraping), scoped
-- deliberately narrow -- product[]=1 (Dry Maize, the only whitelisted
-- commodity in web/src/lib/kamis/client.ts) over the most recent 30
-- days (2026-08-22 to 2026-09-21), not the full ~9-month history.
-- This is Stage 6B's "Option B" scope decision: only the markets
-- actually needed for the commodity this project can currently
-- ingest, not a speculative import of the ~150-commodity/nationwide
-- catalogue KAMIS covers in total. 154 raw rows resolved to 42
-- distinct (Market, County) pairs.
--
-- Every pair was validated against the existing counties table after
-- normalization (trim, casefold, strip apostrophes, treat hyphens as
-- spaces) -- all 42 resolved cleanly to a real county, 0 rejected.
-- This process also surfaced and fixed a genuine bug in
-- lib/kamis/normalize.ts: "Muranga" (KAMIS) was failing to match
-- "Murang'a" (our counties table) because apostrophes weren't stripped
-- before comparison -- fixed in that file alongside this migration so
-- the real importer benefits from the same correction.
--
-- No location_details are set for any row: KAMIS's export does not
-- provide reliable sub-location/address data beyond the market name
-- itself, and none is invented here.
--
-- Market names are inserted exactly as KAMIS renders them, with no
-- fuzzy merging -- "Eldoret Main" is its own row, distinct from any
-- other "Eldoret"-prefixed name that might appear elsewhere in KAMIS's
-- data, per the explicit instruction not to assume two similar names
-- are the same physical market.
insert into public.agricultural_markets (name, county_id, active) values
  ('Ahero', 'kisumu', true),
  ('Butere Livestock Market', 'kakamega', true),
  ('Chebunyo', 'bomet', true),
  ('Cheptiret - Uasin Gishu', 'uasin-gishu', true),
  ('Eldoret Main', 'uasin-gishu', true),
  ('Embu Town', 'embu', true),
  ('Holo', 'kisumu', true),
  ('Isebania Market', 'migori', true),
  ('Kabati - Muranga', 'muranga', true),
  ('Kagio', 'kirinyaga', true),
  ('Kakamega Town', 'kakamega', true),
  ('Kamukuywa', 'bungoma', true),
  ('Kangemi Market', 'nairobi', true),
  ('Kangeta', 'meru', true),
  ('Kapkwen', 'bomet', true),
  ('Katito', 'kisumu', true),
  ('Kawangware', 'nairobi', true),
  ('Kerugoya', 'kirinyaga', true),
  ('Khayega', 'kakamega', true),
  ('Kibuye', 'kisumu', true),
  ('Kimilili town', 'bungoma', true),
  ('Kimumu', 'uasin-gishu', true),
  ('Kipkaren', 'kakamega', true),
  ('Kutus', 'kirinyaga', true),
  ('Lubao Livestock Market', 'kakamega', true),
  ('Mabera', 'migori', true),
  ('Makutano Kirinyaga', 'kirinyaga', true),
  ('Maua', 'meru', true),
  ('Mghange', 'taita-taveta', true),
  ('Mogogosiek Market', 'bomet', true),
  ('Mois Bridge', 'uasin-gishu', true),
  ('Muhoroni', 'kisumu', true),
  ('Mukuyu Market', 'muranga', true),
  ('Mulot', 'bomet', true),
  ('Mumias', 'kakamega', true),
  ('Musoli Market', 'kakamega', true),
  ('Ndanai Market', 'bomet', true),
  ('Ngurubani Market', 'kirinyaga', true),
  ('Nkubu', 'meru', true),
  ('Sabatia', 'kakamega', true),
  ('Taveta Retail Market', 'taita-taveta', true),
  ('Voi Retail', 'taita-taveta', true);
