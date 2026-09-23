-- Education 3.0, Phase 2: Shamba Space Crop School (batch 1 of 5).
--
-- Adds 3 new education_resources rows -- original Shamba Space guides
-- for Maize, Beans and Irish Potato -- following the exact same pattern
-- already proven by shamba-space-avocado-guide: topic_id references an
-- existing education_topics row (none duplicated), category_id=
-- 'crop-farming', resource_type='article', origin='shamba_original',
-- source_id/external_url/storage_path all NULL, is_downloadable=false.
-- No schema change of any kind.
--
-- Researched from the same KALRO source already linked as each crop's
-- existing "Go Deeper" Learning Library resource. No price, yield,
-- income, pesticide product name, pesticide rate, or chemical mixing
-- instruction appears anywhere below; every section that could not be
-- verified from real extracted source text says so explicitly and
-- defers to a qualified extension officer, rather than guessing. The
-- Beans and Irish Potato source PDFs turned out to be trainer-logistics
-- manuals rather than technical compendiums, so those two guides are
-- more heavily hedged than Maize -- this was confirmed by grepping the
-- full extracted text for numeric patterns before concluding data was
-- genuinely absent, not by skimming.

insert into public.education_resources
  (id, category_id, topic_id, learning_category, resource_type, origin, source_id, external_url, title, summary, content, is_published)
values

-- ============================================================
-- MAIZE
-- ============================================================
(
  'shamba-space-maize-guide', 'crop-farming', 'maize', null, 'article', 'shamba_original', null, null,
  'Maize Farming in Kenya',
  $s$A practical, KALRO-informed guide to growing maize in Kenya, from matching a variety to your altitude zone through planting, feeding, protecting, harvesting and storing your crop.$s$,
  $c$## Getting Started

For most communities in Kenya, maize is the staple food, and it's grown from the coast right up into the highlands. That's actually the first thing worth understanding about maize in Kenya: there isn't one "maize climate" here, there are several, and KALRO's own variety-breeding work is organised zone by zone -- coastal lowlands, medium-altitude dry areas, medium-altitude moist areas, and highlands. Getting good results starts less with a single trick and more with matching the basics -- variety, spacing, fertilizer timing, harvest timing -- to your own zone. This guide walks through those basics in the order you'll actually use them on the farm. For the full technical detail behind everything here, see the Go Deeper resource below.

## Choosing the Right Site

Kenya's maize-growing environment runs from the coastal lowlands, at roughly 0 to 1,200 metres above sea level, up through medium-altitude dry and medium-altitude moist zones, and into the highlands, at roughly 1,800 to 2,500 metres, where annual rainfall is typically in the 1,000-2,000mm range. Each zone has different temperature, rainfall pattern and disease pressure, which is exactly why a highland variety bred for a long, cool season generally won't perform the same way on the coast. We don't have a verified soil pH range to share for maize specifically, so get your soil tested or ask your county agricultural officer before assuming your land needs lime or a particular fertilizer type. Once you know your zone, variety selection (next section) becomes a lot more straightforward. See the Go Deeper resource for the full suitability map and zone boundaries.

## Suitable Varieties

Kenyan maize varieties fall into two broad types: open-pollinated varieties (OPVs) and hybrids. With an OPV, you can replant seed saved from your own harvest for a few seasons before quality drifts; with a hybrid, the seed doesn't breed true, so saved hybrid seed loses the uniformity and vigour you paid for and needs replacing with fresh seed every season. Maturity length varies a lot by zone -- some varieties bred for drier, shorter-season areas mature in roughly 85 to 105 days, while varieties bred for the highlands' longer growing season commonly take 140 to 160 days, so matching maturity length to your rainy season matters as much as matching altitude. Breeding programmes here have also specifically targeted local problems like stem borers, gray leaf spot, common rust and maize lethal necrosis disease (MLND), which tells you how much these issues matter across the country even where a specific variety's exact resistance package can change over time. Because seed catalogues update regularly, get the current recommended variety list for your county from your extension office, agrovet or the Go Deeper resource rather than relying on a name you heard a few seasons ago.

## Quality Planting Material / Seed

You've essentially got two paths to good seed: buying certified seed (or fresh hybrid seed) each season, or running an improved farmer-saved-seed system if you're growing an OPV. The improved approach means selecting and tagging healthy, true-to-type plants in the middle of the field -- away from the edges, where cross-pollination from a neighbour's different variety is more likely -- harvesting those plants a little early, then shelling and drying the grain down to around 13% moisture content before storing it in a clean, dry, well-ventilated place or an airtight (hermetic) container. Run a simple germination test before you plant. This farmer-saved route should be limited to about three seasons on the same variety before you switch back to fresh certified seed, since quality and purity drift downward the longer you recycle. Whichever path you choose, seed quality is the one input decision you can't easily fix later in the season, which is why it's worth the extra care up front. The Go Deeper resource has more detail on both certified seed sourcing and the farmer-saved method.

## Land Preparation

Maize wants a fine seedbed, and the standard recommendation is straightforward: one tractor ploughing followed by one harrowing is generally adequate, while with ox-drawn implements two rounds of ploughing is the usual guidance. Preparing land early, well before planting, lets weeds dry out and decompose rather than compete with your young crop, and it improves water infiltration into the soil. It's tempting to rush this step when the rains are already starting, but poor seedbed preparation is one of the most commonly cited causes of low maize yields, so it's worth the extra day or two. See the Go Deeper resource for equipment-specific guidance.

## Planting

Plant one seed per station (planting hole) rather than several -- over-seeding a station just increases competition for light and nutrients between plants sharing the same spot, which lowers both yield and grain quality. We don't have a verified planting depth or a specific recommended planting date to share here, since these depend heavily on your local rainfall onset and soil type, so check with your county extension office for the right window in your area. Getting this timing right, more than almost anything else in maize, determines how much of the season your crop gets to use. The Go Deeper resource has more on planting technique.

## Spacing

Recommended spacing changes by zone. In the highlands, a pure stand (one plant per station) is typically spaced at 75 x 25cm, giving roughly 33,000 plants per hectare, while intercropped maize (two plants per station) uses 75 x 50cm at a similar population. In medium-altitude areas, pure stand spacing is 75 x 30cm (around 44,000 plants/ha), with 75 x 60cm for two-plant intercrop stations. In dryland and coastal areas, spacing widens to 90 x 30cm for a pure stand (around 37,850 plants/ha) and 90 x 60cm for intercropping. Getting spacing right ensures plants aren't competing more than necessary for water, light and nutrients, and it also makes routine operations like weeding and top-dressing easier to do properly. See the Go Deeper resource for the full spacing table.

## Soil and Nutrient Management

Many maize-growing soils in Kenya are degraded or naturally low in fertility, so combining a basal fertilizer application, a top-dressing later in the season, and organic inputs where available (an approach often called Integrated Soil Fertility Management, or ISFM) tends to work better than relying on one input alone. At planting, basal fertilizer is placed in the planting hole and mixed with soil before the seed goes in and is covered, to avoid scorching the seed; whether an NPK-type blend or DAP suits your field better generally depends on whether your soil is acidic, which a soil test can confirm. Top-dressing is typically done with a nitrogen fertilizer such as CAN (calcium ammonium nitrate), applied roughly two to three weeks after planting when plants are about 45cm tall or at the 8-10 leaf stage, placed around the plant rather than directly against it, and in higher-rainfall areas this is often split into two applications instead of one. We can't give you a precise kg-per-acre rate here, since the right rate depends on your soil's fertility status and current recommendations -- get a soil test done or ask your county agricultural officer or a soil-testing service for a rate suited to your field. Techniques like fertilizer banding (placing fertilizer close to the root zone) and micro-dosing (small amounts at planting plus a top-up a few weeks later) can help make scarce fertilizer go further. The Go Deeper resource covers ISFM in more depth.

## Water and Irrigation

Most maize in Kenya is grown under rainfed conditions, which is why matching your zone's rainfall pattern to the right variety's maturity length matters so much. Some varieties are specifically described as suited to both rainfed and supplemental irrigation, which is useful where you have access to irrigation as a buffer against increasingly erratic rains. Beyond that, we don't have verified figures on maize's specific water requirements at different growth stages to share here, so the Go Deeper resource is the better place to look for that detail.

## Weed Management

Weeds compete with young maize for moisture, nutrients, space and light, and can also host pests and diseases that later move onto your crop. The recommended pattern is a first hand-weeding at around three weeks after the crop emerges, followed by a second weeding about three weeks after that; the most critical period is the first four to six weeks after emergence, and keeping the crop weed-free through that window matters more than weeding later in the season. Herbicides -- applied either before or immediately after planting (pre-emergence) or later once weeds and the crop have emerged (post-emergence) -- are a common alternative or complement to hand weeding, though we're not naming specific products here since registrations and recommendations change over time; ask your county agricultural officer or a licensed agrovet which registered herbicide suits your situation. Getting through that first six-week window clean sets up everything that follows. See the Go Deeper resource for more on weed control options.

## Pests and Diseases

The pests and diseases most worth knowing about in Kenyan maize include stem borers in the field, storage pests like maize weevils and the larger grain borer once grain is in the store, and diseases including gray leaf spot, common (leaf) rust and maize lethal necrosis disease (MLND) -- all problems significant enough that KALRO's variety-breeding programmes have specifically worked to build resistance against them. Aflatoxin, a toxin produced by mould that can grow on maize grain, especially where drying or storage is poor and grain is kept damp, is also a real risk; the single most effective thing you can do about it is dry your grain properly and keep it dry in storage. If you do need to use a pesticide or fungicide, always choose a product currently registered for maize use in Kenya, follow the label instructions exactly, and get guidance from your county agricultural officer or a licensed agrovet -- we've deliberately not listed specific products or rates here, since approvals and recommendations change over time. Regular scouting so you catch problems early is worth more than any single treatment. See the Go Deeper resource for detailed, regularly updated technical guidance on specific pests and diseases.

## Crop Management

Avoid growing maize on the same piece of land season after season without a break. Rotating in a legume such as cowpeas helps replenish nitrogen that maize draws down, and more generally, alternating tap-rooted crops with fibrous-rooted ones, and legumes with non-legumes, while avoiding planting one crop straight after another from the same family, helps prevent pests and diseases from building up in the soil. Intercropping maize with another crop is common practice in Kenya, which is exactly why the wider, two-plants-per-station spacing option exists (see the Spacing section above). Building a simple rotation plan, even a basic one, pays off over several seasons. The Go Deeper resource has more on rotation planning.

## Harvesting

Timing depends on what market you're harvesting for. For the green maize market (roasting or boiling fresh), maize is ready once the grain has hardened somewhat and the silk at the top of the cob has dried and turned black. For dry grain, wait until most leaves have dried up, the husks are no longer green, stalks have turned yellow or brown, cobs begin to droop on the stalk, and kernels show a black layer at the point where they attach to the cob -- a sign the kernel has finished filling and stopped drawing food from the plant -- with grains feeling hard rather than milky. Harvesting at the right time, rather than early or late, avoids losses from spillage, lodging and poor-quality grain. See the Go Deeper resource for more detail on maturity indicators.

## Post-Harvest Handling

Delaying harvest past physiological maturity, or handling the crop carelessly during de-husking and transport home, is one of the more avoidable sources of loss in maize. If you're keeping any of your harvest as seed for next season, KALRO's specific guidance for farmer-saved seed is to dry shelled grain down to around 13% moisture content before it goes into storage -- a useful benchmark for grain you intend to store more generally as well, since damp grain is far more vulnerable to mould and storage pests. Getting grain properly dry before it goes into a store or a bag is worth the extra day or two in the sun. The Go Deeper resource covers post-harvest handling in more depth.

## Storage

Store dry grain or seed in a clean, dry, well-ventilated store, or in an airtight (hermetic) container or bag. Hermetic storage works by cutting off the oxygen storage pests like maize weevils and the larger grain borer need to survive, which helps control them without relying purely on chemical protectants. We don't have verified figures on exactly how long grain can be safely stored under different conditions, so if you're storing for an extended period, it's worth checking in with your extension officer. See the Go Deeper resource for more on storage options.

## Marketing

Most smallholders currently sell maize through local markets, millers or traders. If you're aiming at larger buyers, processors, or export-oriented markets, meeting recognised food safety and quality standards -- Kenya has its own domestic standard for this, KS1758 -- increasingly matters for market access. We're not going to give you price or yield figures here, since both vary constantly by season and location; talk to local buyers, your county office, or check current market information services for up-to-date numbers. The Go Deeper resource has more on GAP and food safety requirements relevant to market access.

## Common Mistakes

The mistakes that come up again and again are: planting a variety that doesn't suit your altitude zone or season length; skipping proper seedbed preparation; overcrowding planting stations instead of sticking to one seed per hole; letting weeds get away during the critical first four to six weeks; applying all your top-dress fertilizer in one go in a high-rainfall area instead of splitting it; harvesting late; and storing grain before it's properly dried. Recycling farm-saved OPV seed for far more than three seasons, or trying to save seed from a hybrid at all, are two more that quietly erode yield over time without farmers always realising why. Most of these are avoidable with planning rather than extra spending. The Go Deeper resource walks through each of these in more depth.

## Farm Business Considerations

Seed, fertilizer and labour are real costs, so matching a variety's maturity length to your actual rainfall pattern reduces the risk of a costly crop failure more than almost any other single decision. Keeping simple records -- what variety you planted, when, what fertilizer and how much, when you weeded and harvested -- makes it much easier for you, your agrovet or your extension officer to fine-tune next season rather than repeating guesswork. We're not stating specific cost or return figures here since they change constantly with input prices and local markets; build your own budget using current local prices. Working toward GAP compliance can also open up more market options over time. The Go Deeper resource has more on farm business planning for maize.$c$,
  true
),

-- ============================================================
-- BEANS
-- ============================================================
(
  'shamba-space-beans-guide', 'crop-farming', 'beans', null, 'article', 'shamba_original', null, null,
  'Dry Bean Farming in Kenya',
  $s$A practical guide to growing dry beans in Kenya, covering site and seed choices, soil fertility, pest and disease basics, harvesting and marketing, informed by KALRO's climate-smart bean research.$s$,
  $c$## Getting Started

Dry bean (Phaseolus vulgaris) is one of Kenya's major pulse crops and a household staple, grown mainly by smallholder farmers across western, eastern, central and coastal Kenya. It has traditionally been concentrated in the higher-potential land of the Rift Valley and Central Kenya, but newer varieties and production techniques have extended it into more marginal, drought-prone areas as well. Because beans are usually grown by farmers with limited resources and often on a fairly small scale, small improvements in seed quality, soil fertility and pest management tend to matter a lot relative to the size of the crop. This guide covers the basics in the order you'll use them. See the Go Deeper resource below for more detailed technical background.

## Choosing the Right Site

Dry beans are grown across a fairly wide range in Kenya, from lower altitudes up to around 2,500 metres above sea level, with annual rainfall requirements roughly in the 600 to 1,800mm range depending on variety and region. Because of that range, Kenyan bean-growing areas are loosely grouped into zones such as semi-arid, hot dry lowland, cold dry highland, high-potential, sub-humid and humid, with different varieties better suited to each. We don't have a verified soil pH range or specific soil-type recommendation for beans to share here, so it's worth getting your soil tested or asking your county agricultural officer before you assume your land is or isn't suitable. The Go Deeper resource has more detail on specific county agro-ecological zones.

## Suitable Varieties

Bean varieties released in Kenya are matched to different zones and different end uses -- some are better suited for direct home consumption, others for canning or pre-cooked products. Because new varieties are released periodically and older ones can fall out of favour or availability, we're not naming specific varieties here; get the current recommended list for your county from your extension office, agrovet, or the Go Deeper resource. One general point worth knowing: since drought-tolerant bean varieties now exist for more marginal areas, it's worth asking specifically about these if you're farming in a drier zone rather than assuming beans "just won't work" there. The Go Deeper resource covers variety selection by county in more depth.

## Quality Planting Material / Seed

Most Kenyan bean farmers currently recycle their own seed from a previous harvest, or source it informally from neighbours, local markets or grain stores, and relatively few buy certified seed. Recycling the same seed repeatedly over many seasons is recognised as a cause of declining seed quality and yield potential over time, so working toward periodically refreshing your seed stock with certified seed is worth it, particularly if you're growing beans as more of a business than a subsistence crop. We don't have verified detail on bean-specific seed selection, drying or storage steps (the kind of detail available for maize's farmer-saved-seed system), so if you're planning to save your own bean seed, it's worth asking your extension officer for the right method. The Go Deeper resource has more on formal versus informal seed systems.

## Land Preparation

Timely, well-done land preparation is listed among the key improved agronomic practices for dry beans, but we don't have a verified, specific method or timing recommendation to share here beyond that general point. As a general principle, beans don't tolerate waterlogging well, so avoid planting in poorly drained low spots if you can help it. Ask your county extension office for a land preparation method and timing suited to your specific soil and rainfall pattern. The Go Deeper resource has more detail on this.

## Planting

We don't have verified figures for planting depth, seed rate or a specific recommended planting date for dry beans from the source material for this guide. As a general rule, aim to plant into soil that already has reliable moisture rather than gambling on rain that hasn't arrived yet. For a rate and timing suited to your area and variety, consult your county agricultural officer or the Go Deeper resource.

## Spacing

We don't have a verified spacing or plant-population figure for dry beans to share here -- the source material references "correct plant spacing" and "plant density" as recommended practices without giving specific cm measurements. Consult a qualified extension officer for a site-specific spacing recommendation for your variety and zone. The Go Deeper resource may have more current, detailed guidance.

## Soil and Nutrient Management

Kenyan soils commonly show deficiencies in the macronutrients nitrogen, phosphorus, potassium and sulphur, and the micronutrients zinc, molybdenum and boron, and increasing soil acidity is one recognised driver of declining bean yields over time. Because beans are a legume, they can fix some of their own nitrogen from the air with help from soil bacteria called rhizobia; a rhizobium inoculant -- sometimes sold under the name "biofix" -- introduces the right strain of these bacteria to the seed or soil at planting, which boosts natural nitrogen fixation and is particularly useful on land that hasn't grown beans or other legumes recently. Beyond that, fertilizer type and rate should ideally be guided by a soil test, since we don't have a verified blanket rate to share here. Integrated Soil Fertility Management (ISFM) -- combining fertilizer, organic matter and conservation-agriculture practices -- is the broad approach recommended for keeping bean soils productive over the longer term. The Go Deeper resource covers ISFM and rhizobium inoculation in more depth.

## Water and Irrigation

Dry beans in Kenya are mostly grown under rainfed conditions, and unreliable moisture availability is specifically flagged as one of the main causes of low yields in smallholder bean farming systems. We don't have verified figures on beans' water needs at specific growth stages, so beyond choosing a drought-tolerant variety where your zone calls for one, ask your extension officer about water-harvesting or conservation options suited to your area. The Go Deeper resource covers water management technologies for beans.

## Weed Management

Weeds compete with beans for nutrients, moisture and light, and controlling them early in the season matters, but we don't have a verified specific weeding schedule (timing or number of weedings) to share here for beans, unlike the fairly precise recommendation available for maize. Ask your extension officer for locally recommended weeding timing for your variety and zone. The Go Deeper resource has more detail on weed management options.

## Flowering and Pod Development

Like other legumes, dry bean plants move from vegetative growth into flowering and then into pod set and pod filling. The source material for this guide specifically identifies unreliable moisture availability as one of the main causes of low bean yields in smallholder systems, which is consistent with this being a sensitive stage for the crop, though we don't have a verified, bean-specific figure on exactly how much yield is at stake or precisely when the most sensitive days fall. If your rains look like they're tailing off as your crop approaches flowering, that's a good moment to talk to your extension officer about options. The Go Deeper resource may have more detailed, current guidance on this stage.

## Pests and Diseases

Aphids and whiteflies are both named as pests to watch for in bean fields, and both are also important because they spread plant viruses as they feed. In storage, bruchids -- small beetles that bore into and damage stored bean seed -- are identified as the major post-harvest pest, and checking for the start of a bruchid infestation right around harvest time is worth building into your routine. We don't have verified, specific disease names for dry beans from the source material for this guide (it discusses fungal, bacterial and viral disease categories generally, without naming particular diseases), so get a positive identification from your county extension officer before deciding on treatment, since the right response differs a lot depending on the actual cause. An integrated approach -- combining cultural, physical, biological and chemical control, and scouting your field regularly so you know when a real threshold has been crossed before you spray -- is the recommended general strategy. If you do need a pesticide, choose a product currently registered for use on dry beans in Kenya, follow the label instructions, and consult your county agricultural officer or a licensed agrovet; we haven't listed specific products or rates here since these change over time. See the Go Deeper resource for detailed, regularly updated technical guidance on specific bean pests and diseases.

## Crop Management

Beans are commonly intercropped with cereals like maize, sorghum and millet in Kenya, and whether that's the right approach for you depends on your farm size, whether you're growing primarily for home use, for the open market, or under contract to a seed company, and on local demand. Rotating beans through your cropping plan, rather than growing the same crop continuously, is generally good practice for soil health. Which of these makes sense for your farm is worth discussing with your extension officer, since it depends heavily on your specific circumstances. The Go Deeper resource has more on production systems and intercropping.

## Harvesting

We don't have verified, bean-specific maturity indicators (the kind of detail available for maize's harvest signs) from the source material for this guide. As a general principle for legumes, harvesting once pods have dried but before they split open on the plant matters, since that's when losses from shattering and spilled seed become more likely -- but for the specific signs to watch for with your variety, ask your extension officer. The Go Deeper resource may have more detailed guidance on this.

## Post-Harvest Handling

The general post-harvest chain for dry beans runs from harvesting through drying, threshing and winnowing, and then a further drying step before storage. Checking whether your beans are dry enough before storing them matters a great deal, and the source material mentions two practical ways farmers do this: using a grain moisture meter, or a traditional "salt method" for estimating moisture content -- for the details of how to do the salt method correctly, ask your extension officer, since we don't have a verified step-by-step description to share here. Getting this step right protects everything you've invested in the crop up to that point. See the Go Deeper resource for more detail on post-harvest handling.

## Storage

Hermetic (airtight) storage bags and metal silos are both mentioned as options for storing dry beans, and both work by limiting the oxygen available to storage pests like bruchids, reducing reliance on chemical protection. We don't have verified figures on safe storage duration or moisture thresholds specifically for beans, so if you're storing for an extended period, it's worth checking with your extension officer or a local supplier of these storage options. The Go Deeper resource covers storage technologies for dry beans.

## Marketing

Dry beans in Kenya move mostly through local markets, and in some cases through contract arrangements with seed companies, particularly where farmers are producing planting seed rather than beans for consumption. We're not stating specific prices or income figures here, since these vary constantly by season and location; check with local buyers or current market information services for up-to-date numbers. Bean quality standards do exist commercially and can affect what price you're offered, so it's worth understanding what buyers in your area are actually looking for before harvest, not after. The Go Deeper resource has more on postharvest value chains and marketing for dry beans.

## Common Mistakes

The recurring mistakes worth watching for are: recycling the same saved seed for many seasons without ever refreshing it with certified stock; skipping a rhizobium inoculant when planting into land that hasn't grown beans or other legumes recently; leaving dry pods in the field too long and losing seed to shattering; storing beans before they're properly dried; and spraying for pests or diseases without first confirming what you're actually dealing with. Most of these cost very little to fix compared to what they cost if left unaddressed. The Go Deeper resource walks through several of these in more depth.

## Farm Business Considerations

Since beans are often grown either for direct sale as food or under contract to a seed company, it's worth deciding upfront which of these you're producing for, since it can affect your variety choice, your quality requirements, and how you handle the crop after harvest. Keeping simple records of what you planted, when, and what you did to the crop makes it far easier to have a useful conversation with a buyer, an extension officer or a potential seed contract. We're not providing cost or income figures here since they vary by season and location; build your own budget from current local information. The Go Deeper resource has more on business planning for dry bean production.$c$,
  true
),

-- ============================================================
-- IRISH POTATO
-- ============================================================
(
  'shamba-space-irish-potatoes-guide', 'crop-farming', 'irish-potatoes', null, 'article', 'shamba_original', null, null,
  'Irish Potato Farming in Kenya',
  $s$A practical guide to growing Irish potatoes in Kenya, covering seed potato sourcing, pest and disease identification, weed management, harvesting and marketing, informed by KALRO's climate-smart potato research.$s$,
  $c$## Getting Started

Potato is Kenya's second most important food crop after maize, and it's grown by a very large number of smallholder farmers -- roughly 800,000, according to the source material behind this guide. Part of what makes it attractive is its short cropping cycle: from planting to harvest generally takes only about three to four months, which is quick compared to many other staple crops. That short cycle also means potato has real potential to fit into a rotation with other crops, or to give you a second harvest opportunity within a year on the same piece of land. This guide covers the essentials in the order you'll use them on the farm. See the Go Deeper resource below for more detailed technical background.

## Choosing the Right Site

We don't have a verified altitude, rainfall or soil pH range for potato from the source material behind this guide, so we're not going to invent one -- please consult a qualified extension officer or the Go Deeper resource for a site-specific recommendation for your area. One useful clue from the training material we reviewed: it specifically lists frost damage as a direct climate risk to potato, which tells you that potato in Kenya is typically grown where frost is at least occasionally possible -- generally cooler, higher-ground conditions rather than hot lowland areas. Beyond that general point, get confirmation from your county agricultural officer that your specific site suits potato before investing heavily in the crop. The Go Deeper resource should have the detailed altitude and soil guidance this document didn't provide.

## Suitable Varieties

Shangi and Asante are both named in the source material as varieties grown in Kenya, though the document only shows them in passing (as photo captions) without describing their specific characteristics, so we're not going to invent traits for them here. One useful general fact the source does confirm: different potato varieties carry different levels of resistance to potato late blight, one of the crop's most damaging diseases, which is a good reason to ask specifically about disease resistance when choosing what to plant rather than picking on appearance or price alone. Because recommended varieties and their availability shift over time, get the current list for your area from your county extension office, agrovet, or the Go Deeper resource. The Go Deeper resource should also have a fuller variety catalogue.

## Quality Planting Material / Seed

Good seed potato in Kenya moves through a fairly involved formal system before it reaches farmers: tissue culture labs produce disease-free starter plantlets, an aeroponics system (growing plants with their roots suspended in a nutrient mist rather than soil) multiplies these into mini-tubers, and those mini-tubers are then bulked up through further field generations -- including what's called satellite seed potato production closer to farmers -- before being sold as certified seed. On your own farm, look for well-sprouted, healthy tubers rather than old, unsprouted or visibly damaged ones, since sprouting is one of the simplest visual checks of seed vigour. Many growers also work on breaking dormancy in their seed tubers before planting, and some varieties are specifically bred for shorter natural dormancy so they sprout and get going faster. We don't have verified figures on recommended seed tuber size or seed rate per acre, so ask your extension officer for guidance suited to your variety and area. The Go Deeper resource covers the seed potato system in more detail.

## Land Preparation

We don't have a verified, specific land preparation method or timing recommendation for potato from the source material behind this guide. Consult a qualified extension officer for a site-specific land preparation recommendation suited to your soil type and the equipment available to you. The Go Deeper resource may have more detailed guidance on this.

## Planting

We don't have verified figures on planting depth, seed rate or specific planting dates for potato from the source material for this guide. What we can say, based on the source, is that using well-sprouted seed tubers (rather than unsprouted ones) is treated as good practice, and breaking dormancy ahead of planting is a recognised technique for getting the crop off to a faster start. For depth, rate and timing specific to your variety and area, consult your county extension office or the Go Deeper resource.

## Spacing

We don't have a verified spacing or plant-population figure for potato from the source material behind this guide. Consult a qualified extension officer for a site-specific spacing recommendation. The Go Deeper resource should have more detailed, current guidance on this.

## Soil and Nutrient Management

We don't have verified, potato-specific fertilizer rates or nutrient deficiency figures from the source material for this guide. The broader training material does emphasise soil testing and Integrated Soil Fertility Management (ISFM) as the right general approach across crops, so getting your soil tested before deciding on fertilizer type and rate is a sound starting point regardless. For a rate and product suited to your soil and area, consult your county agricultural officer or a soil-testing service. The Go Deeper resource covers ISFM and soil management for potato in more depth.

## Water and Irrigation

Potato is notable for its water use: the source material describes it as producing more food per unit of water used than any other major crop, largely because of its high water use efficiency and short growing cycle. Drip irrigation is referenced as a recognised option for potato production in Kenya where rainfall alone isn't reliable enough, though we don't have a verified schedule or application rate to share here. If supplemental irrigation is an option for you, it's worth discussing a suitable system and schedule with your extension officer. The Go Deeper resource has more on water resource management for potato.

## Weed Management

Effective potato weed management starts with understanding what you're dealing with -- the source material classifies weeds by their form (grasses, broad-leaved weeds and sedges), by lifecycle (annuals, biennials and perennials), and by habitat (ordinary arable-land and fallow-land weeds, lawn and pasture weeds, and aquatic weeds), since the right control option can depend on which of these you're facing. The recommended general approach favours preventive, cultural, mechanical and biological control first, turning to herbicides only when necessary. If you do need an herbicide, choose one currently registered for potato use in Kenya, follow the label instructions, and get guidance from your county agricultural officer or a licensed agrovet, since we haven't listed specific products or rates here. Scouting your field regularly to catch a build-up early is worth more than reacting after the fact. The Go Deeper resource has more detail on integrated weed management for potato.

## Pests and Diseases

The pests most worth watching for in Kenyan potato include aphids, the potato tuber moth, cutworms, whiteflies, and both potato cyst nematodes (PCN) and root-knot nematodes (RKN) -- microscopic worm-like pests that attack roots and tubers. On the disease side, the ones named in the source material include bacterial wilt, black leg, potato late blight, ring rot, potato viruses, potato early blight, black scurf, verticillium wilt and rhizoctonia -- a longer list than most crops, which is part of why potato disease management leans heavily on prevention. It helps to think in terms of what's sometimes called the disease triangle: disease only really takes hold where a disease-causing organism, the right environmental conditions (moisture, temperature, humidity, wind), and a susceptible host plant all come together at the same time -- which is why good drainage, sensible spacing and using healthy seed all reduce disease risk even before you consider spraying anything. Integrated pest and disease management for potato combines biological, cultural and chemical practices rather than relying on chemicals alone. If you do need a pesticide or fungicide, always choose a product currently registered for potato use in Kenya, follow the label instructions exactly, and consult your county agricultural officer or a licensed agrovet -- we've deliberately not listed specific products, mixing instructions or rates here, since approvals and recommendations change over time. The Go Deeper resource has detailed, regularly updated technical guidance on identifying and managing each of these.

## Crop Management

A few climate-smart practices are worth building into how you manage a potato crop: breaking dormancy in seed tubers (or choosing a short-dormancy variety) before planting, rotating potato with other crops rather than growing it continuously on the same ground, and using weather-forecasting tools -- Kenya's Agriculture Observatory Platform (KAOP) is referenced as one such digital resource -- to help time field operations around the weather rather than the calendar. The source material also flags several climate-related risks worth planning around: unpredictable water availability, loss of soil fertility, frost damage, and increased pest and disease pressure as conditions shift. None of these has a one-size-fits-all fix, but knowing they're recognised risks for potato specifically should inform how closely you watch your crop through the season. The Go Deeper resource has more on climate-smart field operations for potato.

## Harvesting

We don't have verified, potato-specific maturity indicators (of the kind available for maize) from the source material behind this guide. Ask your county extension officer for the harvest signs appropriate to your variety and growing conditions. The Go Deeper resource may have more detailed guidance on this.

## Post-Harvest Handling

Potato is fairly perishable fresh, but the source material notes that dehydrating potato is one recognised way to lengthen its shelf life and reduce post-harvest losses, alongside more familiar routes like fresh sale, chips, crisps, starch or flour. We don't have verified detail on curing conditions, temperatures or specific handling steps immediately after harvest, so consult your extension officer for guidance suited to your situation and intended use for the crop. The Go Deeper resource covers post-harvest handling and value addition for potato in more depth.

## Storage

We don't have verified, specific storage guidance (temperature, duration, light exposure, or method) for potato from the source material behind this guide. Consult a qualified extension officer for a storage method suited to your volume and how long you need to hold the crop before selling or using it. The Go Deeper resource should have more detailed, current storage guidance.

## Marketing

Buyers commonly care about variety, tuber size, quality and packaging, all of which are specifically named in the source material as things a market assessment should look at before you commit to growing for a particular buyer. Digital market-linkage platforms -- the source material names the Viazi Soko platform as an example -- and contract farming arrangements are both recognised marketing routes for potato in Kenya, alongside selling through more traditional local market channels. Compliance with potato-specific policies and regulations is also flagged as a factor that can affect your market access. We're not providing price or yield figures here since they change constantly; check with local buyers, digital market platforms, or current market information services for up-to-date numbers before planning your season around a particular return. The Go Deeper resource has more on market assessment and business planning for potato.

## Common Mistakes

Mistakes worth watching for include: planting unsprouted or poor-quality seed tubers instead of breaking dormancy properly first; ignoring frost risk in exposed or naturally cold parts of your farm; choosing a variety without asking about its late blight resistance level; spraying for pests or diseases without first scouting to confirm what you're actually dealing with; and letting harvested potatoes sit without a plan for quick sale, storage or value addition, which increases the risk of avoidable post-harvest losses. Most of these are about timing and information rather than extra spending. The Go Deeper resource covers several of these in more depth.

## Farm Business Considerations

Because buyers care specifically about variety, tuber size, quality and packaging, it's worth finding out what your intended market actually wants before you plant, rather than after you harvest. Potato's short three-to-four-month cycle can make it useful for turning working capital around faster than longer-season crops, but that only pays off if you have a buyer or market lined up -- digital platforms and contract arrangements (see Marketing, above) are both worth exploring for this. Keep simple records of your variety, planting date, inputs and any pest or disease issues you dealt with, since this makes conversations with extension officers, agrovets and buyers far more productive. We're not providing cost or income figures here since they vary by season and location; build your own budget from current local information. The Go Deeper resource has more on farm business planning for potato.$c$,
  true
);
