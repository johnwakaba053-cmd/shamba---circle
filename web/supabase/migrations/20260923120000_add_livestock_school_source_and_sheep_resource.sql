-- Education 3.0, Phase 3: Shamba Space Livestock School (source + Sheep Go Deeper resource).
--
-- Sheep is the only livestock topic that had no existing "Go Deeper" external
-- resource in education_resources. This migration adds:
--   1. A new education_sources row for ILRI (International Livestock Research
--      Institute), which was not previously represented in education_sources.
--   2. A new external_linked education_resources row for a verified,
--      Kenya-specific, sheep-dedicated ILRI research paper, so the new
--      shamba-space-sheep-guide (added in a later migration) has a Go Deeper
--      pairing via the existing topic_id mechanism, exactly like every other
--      livestock topic.
--
-- Pure INSERT only -- no UPDATE/DELETE, no schema change.

insert into public.education_sources (id, name, url)
values (
  'ilri',
  $s$International Livestock Research Institute (ILRI)$s$,
  'https://www.ilri.org'
);

insert into public.education_resources (
  id, category_id, topic_id, learning_category, resource_type, origin,
  source_id, external_url, title, summary, content, is_published
)
values (
  'ilri-small-ruminant-production-kenya',
  'livestock',
  'sheep',
  null,
  'document',
  'external_linked',
  'ilri',
  'https://biometrics.ilri.org/Publication/Full%20Text/Chapter%203-26th.pdf',
  $t$Small Ruminant Production in Smallholder and Pastoral/Extensive Farming Systems in Kenya$t$,
  $s2$A research study by Kosgey, Rowlands, van Arendonk and Baker (ILRI) examining how Kenyan smallholder and pastoral farmers manage sheep and goat breeding, feeding, health and marketing across seven districts.$s2$,
  $c$This chapter, prepared by researchers affiliated with the International Livestock Research Institute (ILRI), reports survey findings from smallholder and pastoral/extensive sheep and goat keepers across seven Kenyan districts (Nakuru, Nandi, Nyeri, Baringo, Laikipia, Narok and Trans-Mara). It covers why farmers keep sheep and goats, breed and breeding-ram selection criteria, mating systems, feeding and supplementation practices, commonly reported diseases, and marketing channels -- offering a research-based, Kenya-specific picture of how small ruminants are actually managed on the ground.$c$,
  true
);
