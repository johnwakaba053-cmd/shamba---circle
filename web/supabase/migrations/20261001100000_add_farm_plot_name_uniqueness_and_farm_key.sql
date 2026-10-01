-- Farm Records R1 follow-up: plot name uniqueness and the plot -> farm key
-- that later slices reference.
--
-- 1. Active plot names are unique within a farm, ignoring case and
--    leading/trailing spaces ("Lower field" = "  lower FIELD "). Archived
--    plots don't count, so a name can be reused once its old plot is
--    archived -- and restoring an archived plot whose name has since been
--    taken is refused (23505) until the other plot is renamed or archived.
--    Farm names stay flexible on purpose.
--
-- 2. farm_plots gets UNIQUE (id, farm_id, profile_id). Crop seasons and
--    livestock groups (R2) will reference a plot through the composite
--    (plot_id, farm_id, profile_id), so a child row can only name a plot
--    that belongs to the same farm (and the same owner) it does. With that
--    foreign key in place, a plot that has children also can't be moved
--    to another farm, since its (id, farm_id) pair would disappear.
--
-- Both tables were empty when this was written, so neither constraint
-- has existing rows to reject. No policies or grants change.

create unique index farm_plots_active_name_key
  on public.farm_plots (farm_id, lower(btrim(name)))
  where archived_at is null;

alter table public.farm_plots
  add constraint farm_plots_id_farm_id_profile_id_key unique (id, farm_id, profile_id);
