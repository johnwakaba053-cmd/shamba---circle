-- Approved community taxonomy batch (product/design review): five
-- display-name-only renames plus one new community. No existing row's
-- id changes and no row is deleted/recreated -- every existing
-- community keeps its identity, so every posts.community_id and
-- community_memberships.community_id foreign key stays valid with zero
-- data movement. No RLS policy change is needed: the existing
-- open-SELECT policy on communities already covers the new row, same
-- as every other row in the table.

update public.communities set name = 'Dairy Farming' where id = 'dairy_cattle';
update public.communities set name = 'Poultry Farming' where id = 'chicken';
update public.communities set name = 'Beef Farming' where id = 'beef_cattle';
update public.communities set name = 'Goats & Sheep Farming' where id = 'goats_sheep';
update public.communities set name = 'Farm Problems & Help' where id = 'problems';

-- New community: farming-as-a-business discussion (profitability,
-- cooperatives, value addition, market access, farm records, business
-- planning, insurance, financing experiences) -- explicitly a
-- discussion space, not a transaction feature; Marketplace and Market
-- Prices remain the only places anything is bought, sold, or priced.
-- group_name 'Other' is an already-allowed value (communities_group_name_check),
-- matching where 'problems' already lives.
insert into public.communities (id, name, group_name, emoji) values
  ('agribusiness', 'Agribusiness & Farm Business', 'Other', '💼');
