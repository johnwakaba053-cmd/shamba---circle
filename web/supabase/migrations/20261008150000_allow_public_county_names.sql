-- News N3: county names readable by signed-out readers.
--
-- Public Agriculture Today stories can be tagged with a Kenyan county
-- (news_articles.county_id, N1), and the story pages show its name. Until
-- now public.counties was readable only when signed in, so a signed-out
-- reader saw the region without the county.
--
-- counties is a fixed list of the 47 county names -- public facts, with
-- no user data -- so anon now gets the same read access authenticated
-- already has. Read only: there is still no INSERT/UPDATE/DELETE policy
-- for any role, and nothing else about the table changes.

grant select on public.counties to anon;

create policy "Anyone signed out can view counties"
on public.counties
for select
to anon
using (true);
