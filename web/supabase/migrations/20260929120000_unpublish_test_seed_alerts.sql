-- Alerts: unpublish the five [TEST] seed alerts.
--
-- 20260916150000_create_alerts_foundation.sql seeded five clearly-fake,
-- published alerts to validate alert matching. Nothing since has
-- unpublished them, so they can reach real farmers who opt in to that
-- alert type -- on /alerts and in Farm Alerts on /weather -- and alert 1
-- (no scope, no expiry) matches every such farmer indefinitely.
--
-- get_my_alerts() and alert_matches_farmer() both require
-- is_published = true, so this hides them everywhere (including SMS
-- eligibility). Unpublish, not delete: a delete would cascade to
-- alert_reads, alert_deliveries and the scope rows, and the rows stay
-- useful for re-testing matching. Reversible by setting it back to true.
--
-- Matches only the five fixed seed ids AND the [TEST] title prefix, so no
-- real alert can be touched. Nothing else changes: no delete, no schema,
-- policy, trigger or function change. `like` treats [ and ] literally
-- (only % and _ are wildcards).
update public.alerts
set is_published = false,
    updated_at = now()
where id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005'
)
  and title like '[TEST]%';
