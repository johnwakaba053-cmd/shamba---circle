-- Education 3.0, Phase 1: Shamba Space Original Academy -- Avocado pilot.
--
-- Adds ONE new education_resources row: an original, Shamba-Space-
-- authored guide to avocado farming in Kenya. No schema change is
-- needed -- this reuses the existing architecture exactly as designed:
--   - topic_id = 'avocado' (existing topic, not duplicated)
--   - category_id = 'crop-farming' (existing category)
--   - origin = 'shamba_original' (existing enum value, unused until now)
--   - resource_type = 'article', source_id = NULL, external_url = NULL,
--     storage_path = NULL, is_downloadable = false (this is written
--     text, not a rehosted document or video)
-- The 17 sections are encoded in `content` as "## Heading" lines
-- followed by a paragraph, separated by blank lines -- a pure
-- rendering convention the detail page will learn to recognise (see
-- the accompanying code change), not a schema change. Every technical
-- claim in this content was independently verified against the FPEAK/
-- COLEAD "Good Practice Guide -- Avocado Value Chain" (EU-funded,
-- Kenya Soil Survey/KALRO-cited) and KALRO's own published facts;
-- nothing here is copied from that source -- it is written in Shamba
-- Space's own words. No pesticide product names, rates, or current
-- prices are included, per the strict content-safety rule for this
-- batch. The existing KALRO avocado resource is left completely
-- unchanged -- it will surface automatically as this guide's "Go
-- Deeper" resource through the existing topic-first related-resources
-- query, no new query needed.
insert into public.education_resources
  (id, category_id, topic_id, learning_category, resource_type, origin, source_id, external_url, title, summary, content, is_published)
values
(
  'shamba-space-avocado-guide',
  'crop-farming',
  'avocado',
  null,
  'article',
  'shamba_original',
  null,
  null,
  'Avocado Farming in Kenya',
  $s$Shamba Space's own practical guide to growing avocado in Kenya, from choosing land and planting material through to harvest, post-harvest handling and marketing -- based on verified KALRO, HCD and industry research.$s$,
  $c$## Getting Started

Avocado is a long-term investment. A grafted avocado tree typically starts bearing fruit 3 to 4 years after planting -- much sooner than an ungrafted seedling tree, which can take far longer and may not even grow true to the parent variety. Kenya has both a strong export market (mostly Hass and Fuerte) and a large local market, but success in either starts the same way: the right site, the right variety, genuine planting material, and consistent care through every season. This guide walks through what actually matters, based on KALRO, the Horticultural Crops Directorate (HCD), the Kenya Plant Health Inspectorate Service (KEPHIS) and industry research -- not shortcuts.

## Choosing the Right Site

Altitude matters more than many farmers expect. Hass generally does best between roughly 800 and 2,100 metres above sea level, while Fuerte prefers higher ground, roughly 1,500 to 2,100 metres. Avocado also wants a well-distributed rainfall pattern -- up to around 1,600mm a year is ideal -- with a short dry spell of about two months before flowering; that dry spell is actually what helps trigger flowering. Very wet weather during flowering causes flowers to fail and encourages fungal disease. Temperature-wise, trees do best between about 16 and 24 degrees Celsius: very hot conditions (33 degrees and above) stress the tree and can scorch fruit in direct sun, while a short spell below about 12 degrees is part of what triggers flowering in the first place. Frost is a real danger -- Hass in particular is frost-sensitive -- so avoid frost-prone land. Avoid slopes steeper than about 35%, since they make orchard work difficult and erode quickly, and plan for a windbreak on any exposed site.

## Varieties

The two varieties grown at real scale in Kenya are Hass, the leading export variety with thin, leathery skin that darkens as it ripens, and Fuerte, with thin green skin and good flavour, popular for local sale and processing. You'll also see Puebla, mostly sold locally and often used as rootstock for grafting other varieties, and newer options like Maluma appearing in some areas. The right variety for you depends on your target market, your altitude, and what genuinely performs well in your specific area -- a certified nursery or your county agricultural office can advise on what suits your exact location.

## Quality Planting Material

Always buy grafted seedlings from a nursery registered with the Horticultural Crops Directorate (HCD) and inspected by KEPHIS. Certified nurseries are checked for disease -- including Avocado Sunblotch Viroid -- and confirmed to be "true to type," meaning the variety on the label is genuinely what you're getting. This matters because a grafted tree keeps the exact characteristics of its parent variety and bears fruit roughly three years earlier than an ungrafted seedling, while a tree grown straight from seed can turn out to be a completely different, often disappointing, avocado. Buying from an uncertified or informal source is one of the costliest mistakes a new avocado farmer can make -- you may not find out you have the wrong variety, or a diseased tree, until years after planting.

## Land Preparation

Test your soil before you prepare the land (see Soil and Nutrient Management below), so you know whether it needs organic matter, lime or gypsum worked in first. Deep-rip and cultivate compacted ground, especially on land that was previously farmed with other crops, to break up hardpans and let roots grow deep. On heavier clay soils, raised ridges or planting mounds improve drainage and cut the risk of root rot -- never plant into a hollow where water can pool. If your site is exposed to wind, establish a windbreak -- trees like Cypress, Grevillea, Casuarina or suitable indigenous trees -- roughly a year ahead of planting, so it's already doing its job by the time your young avocado trees need the shelter.

## Planting

Dig planting holes about 60cm by 60cm by 60cm, ideally about a month before you actually plant, mixing the removed topsoil back in with well-decomposed manure and a phosphate fertiliser. Water the site a day or two beforehand so there's enough moisture in the ground, then plant gently -- take care not to damage the graft union -- and water again immediately after planting. Stake young trees, especially on windy ground, since avocado seedlings are brittle and break easily while they're establishing, and protect the young stem from sunburn with a light-coloured wrap or whitewash. A layer of mulch around (but not touching) the trunk helps retain moisture and keep weeds down, particularly on sloped or erosion-prone land.

## Spacing

How far apart to plant depends on the variety's vigour, your soil, and how intensively you plan to manage the orchard -- denser planting means more competition between trees and considerably more pruning work as they mature. A vigorous variety needs more room than a semi-dwarf one. Rather than guess, ask your nursery or county extension officer for a spacing recommendation matched to your exact variety and site conditions.

## Soil and Nutrient Management

Avocado wants deep, well-drained soil, ideally with roughly 20-40% clay content, and a mildly acidic to neutral pH around 5.5 to 6.5. Waterlogged or poorly structured soil is one of the single biggest causes of root rot in Kenyan avocado orchards, so drainage matters as much as fertility. Get a proper soil test -- and, once your trees are established, periodic leaf analysis -- before deciding how much fertiliser or manure to apply; guessing can waste money or genuinely harm the tree. Fertiliser needs grow substantially as a tree ages and starts fruiting, since every tonne of avocado you harvest removes real nitrogen, phosphorus and potassium from your soil that has to be replaced. Be careful with animal manure -- some kinds, chicken manure especially, are very high in phosphate and nitrogen, and over-applying them can create a nutrient imbalance rather than help the tree.

## Water and Irrigation

Avocado needs reliable water most urgently during flowering and while fruit is developing -- this is when moisture stress does the most damage, showing up as flower and fruit drop, undersized fruit, or cracked skin. Drip or micro-sprinkler irrigation is generally the better choice over flood or basin irrigation, because avocado roots are very sensitive to waterlogging. As a rough guide, rain-fed avocado needs at least 1,000mm of well-distributed annual rainfall, and irrigated trees typically need in the order of 25mm of water a week, adjusted for weather and the tree's growth stage. It's also worth testing your irrigation water -- water that's high in salt, sodium or boron can damage avocado trees over time, even if the volume is right.

## Pruning and Canopy Management

In the first two years, light "tip pruning" -- pinching out the strongest growing tips -- encourages a bushier, more compact tree instead of one tall, thin stem. As the tree matures, keep the canopy open enough for light and air to reach its centre; this helps control disease and makes both spraying and harvesting easier. A useful rule of thumb from industry guidance is to keep trees no taller than about 5.5 metres, and no taller than roughly 70% of the spacing between rows. Avoid sudden, heavy pruning -- avocado bark sunburns very easily once exposed, so any large cut should be protected with a light-coloured paint or whitewash. Older or overgrown orchards can sometimes be renewed through advanced techniques like "staghorning" (cutting the tree back hard to force fresh regrowth) or "topworking" (grafting a new variety onto an existing rootstock), but these take the tree out of production for a while and are best done with expert guidance.

## Flowering and Fruit Development

Avocado has an unusual flowering pattern that's worth understanding: each individual flower opens as "female" on one day, closes, then reopens as "male" the next day (or the reverse, depending on the variety) -- nature's way of encouraging cross-pollination rather than self-pollination. Varieties fall into "Type A" (Hass is one example) or "Type B" (Fuerte is one example) depending on which part of the day they flower as female versus male. Planting a Type B variety near a Type A block can improve pollination and fruit set, though Kenya's climate is generally kind enough that avocado pollinates reasonably well even without this. Bees are the most effective avocado pollinators, and keeping a few hives in or near your orchard during flowering can genuinely improve fruit set -- with the added bonus of a honey harvest. Flowering is also one of the most sensitive periods in the whole growing calendar: heavy rain, extreme heat or moisture stress at this time can cause flowers to fail or young fruit to drop.

## Pests and Diseases

The pests most worth watching for in a Kenyan avocado orchard are fruit flies (which lay eggs in ripening or already-damaged fruit), false codling moth (whose larvae burrow into the fruit within minutes of hatching), and mosquito bugs, which damage young shoots and, later, the fruit itself. On the disease side, the ones to know are root rot (caused by the soil fungus Phytophthora, and strongly linked to waterlogged soil) and anthracnose and Cercospora spot, two fungal diseases that thrive in humid, wet conditions and mainly damage fruit skin and flesh. Good orchard hygiene is genuinely your first and most effective defence: collect and destroy fallen or infected fruit, avoid waterlogged conditions, and scout your trees regularly -- a simple weekly walk checking for early signs of pests or disease catches most problems while they're still cheap and easy to manage. If you do need to use a pesticide or fungicide, always choose a product currently registered for avocado use in Kenya, follow the label instructions exactly, and get guidance from your county agricultural officer or a licensed agrovet. We've deliberately not listed specific products or application rates here, since approvals and recommended rates change over time and vary by situation -- see the Go Deeper resource below for detailed, regularly updated technical guidance.

## Harvesting

Avocado doesn't ripen properly on the tree -- it has to be picked at the right maturity and then ripens afterwards. Pick too early and it may never ripen well or will shrivel instead; pick too late and flavour and shelf life both suffer. There's a simple test you can do without any lab equipment: pick a few sample fruits, leave them at room temperature, and see how long they take to ripen. If they ripen within about 7 to 10 days without shrivelling, the rest of that batch is ready to harvest; if it takes noticeably longer than 10 days, leave the fruit on the tree a while longer. For a grafted tree, expect your first meaningful harvest roughly 3 to 4 years after planting. At harvest time: never pick wet fruit (during or right after rain), use proper tools -- clippers or a padded picking pole rather than pulling fruit off by hand -- leave a short piece of stalk attached to the fruit, and get harvested fruit into the shade quickly rather than leaving it in direct sun or letting it touch bare soil.

## Post-Harvest Handling

What you do with avocado in the hours right after picking has a real effect on how well it keeps and how it eventually tastes. Bruised, sun-exposed or soil-contaminated fruit spoils faster and is harder to sell at a good price. Move harvested fruit into a clean, shaded spot as soon as you can, and avoid stacking it directly on bare ground. Sort out any damaged, diseased or insect-marked fruit before it goes to market -- mixing a few bad fruits in with good ones speeds up spoilage across the whole batch and can cost you far more than the bad fruit alone was worth. If you're supplying an exporter or a packhouse, they'll have their own strict cleaning, grading and cold-chain requirements -- that's a specialised process, so talk directly to your buyer about exactly what they expect from you.

## Marketing

Kenya has both a genuine export market -- mostly Hass and Fuerte -- and a large domestic market. Right now, most smallholder farmers sell through middlemen or brokers, partly because the local market isn't always well organised. Joining a registered farmer cooperative or a local avocado growers' association can give you more bargaining power, steadier access to buyers, and sometimes access to training or inputs you couldn't easily get on your own. If you're interested in exporting, it requires meeting strict phytosanitary and quality standards set by KEPHIS and the Horticultural Crops Directorate -- in practice, most smallholders reach the export market by supplying a licensed exporter rather than exporting directly themselves. We haven't quoted specific prices here, since avocado prices move throughout the season and vary by region -- check with your local cooperative, county agriculture office, or buyers directly for what's current.

## Common Mistakes

A few mistakes come up again and again in avocado farming, and every one of them is avoidable. Planting uncertified seedlings from an unknown source risks introducing disease or discovering years later that you grew the wrong variety entirely. Choosing a poorly drained site, or skipping a proper soil test, is one of the most common paths to root rot. Harvesting too early "just to be safe" produces fruit that never ripens properly and disappoints buyers. Over-applying nitrogen fertiliser or manure without a soil or leaf test can push leafy growth at the expense of flowering and fruit -- chicken manure especially is easy to over-apply. Letting a tree grow tall and dense without any pruning blocks light and airflow, which makes pest and disease problems worse and harvesting harder. And handling fruit roughly after harvest -- dropping it, leaving it in the sun, or letting it touch bare soil -- damages fruit that was otherwise perfectly good.

## Farm Business Considerations

Avocado is a genuine long-term investment: budget for at least 3 to 4 years before your grafted trees produce meaningful income, and plan your finances -- and any other income you rely on -- around that wait. Because certified planting material, soil testing and proper site preparation all cost money upfront, cutting corners early (buying cheap, uncertified seedlings, for example) very often costs far more later, through disease, the wrong variety, or disappointing yields. Keep basic farm records -- what you planted, what you spent on inputs, when you harvested, and what you sold for -- so you can actually track whether your orchard is profitable over time instead of guessing. If you're weighing up the export market, understand that it comes with real compliance costs and standards; it isn't automatically the right path for every farm, and supplying a strong local or regional market can be a solid business in its own right.

This guide gives you the practical foundation for growing avocado well in Kenya. For deeper technical detail -- including official spacing and fertiliser tables, and detailed pest and disease identification -- see the verified KALRO resource below in Go Deeper.$c$,
  true
);
