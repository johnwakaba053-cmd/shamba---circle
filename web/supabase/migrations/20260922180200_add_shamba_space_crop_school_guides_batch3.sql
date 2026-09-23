-- Education 3.0, Phase 2: Shamba Space Crop School (batch 3 of 5).
--
-- Adds 3 new education_resources rows -- original Shamba Space guides
-- for Cabbage, Onion and Mango -- same pattern as prior batches: existing
-- topic_id, category_id='crop-farming', resource_type='article',
-- origin='shamba_original', no rehosting, no schema change.
--
-- Cabbage and Onion sources were technically rich (concrete spacing, pH,
-- altitude, rainfall and disease detail). Mango's assigned KALRO
-- Training-of-Trainers manual turned out to be a facilitator session-plan
-- document rather than a technical field guide -- it contains no
-- embedded pest/disease names, spacing figures, or maturity indices
-- (confirmed by grepping the full extracted text for these terms with
-- zero matches), so the Mango guide's Pests and Diseases, Spacing,
-- Flowering, and Harvesting-maturity sections are explicitly hedged
-- rather than filled with invented detail.

insert into public.education_resources
  (id, category_id, topic_id, learning_category, resource_type, origin, source_id, external_url, title, summary, content, is_published)
values

-- ============================================================
-- CABBAGE
-- ============================================================
(
  'shamba-space-cabbage-guide', 'crop-farming', 'cabbage', null, 'article', 'shamba_original', null, null,
  'Growing Cabbage in Kenya: A Shamba Space Guide',
  $s$A practical, farmer-friendly guide to growing cabbage in Kenya, covering site and variety selection, nursery raising, planting, pest and disease management, harvesting, and marketing.$s$,
  $c$## Getting Started

Cabbage is one of Kenya's most widely grown vegetables, valued both as a cash crop and a kitchen staple. It's technically a biennial plant that farmers grow as an annual, harvesting it for its dense, round head of tightly wrapped leaves that can be green, white, or red. Beyond its place in everyday dishes and salads, cabbage that gets damaged before sale is also a genuinely useful livestock feed. Nutritionally, it's a good source of vitamins A, C, and K, along with fibre, folate, and potassium. This guide walks through what it takes to grow a healthy crop from site selection to market, in Shamba Space's own words, informed by (not copied from) KALRO's cabbage TIMPs research.

## Choosing the Right Site

Cabbage does best on well-drained soil that's rich in organic matter and holds moisture without waterlogging, at a soil pH of roughly 6.0 to 6.5. It tolerates a wide altitude range, from about 800 to 2,000 metres above sea level, which is part of why it's grown in so many different parts of the country. It grows best where temperatures stay within about 4 to 24 degrees Celsius; sustained heat beyond that tends to hurt head formation unless you've chosen a heat-tolerant variety. Rainfall needs are modest -- a well-distributed 380 to 500mm over the growing season is generally enough, with irrigation filling any gap in drier spells.

## Suitable Varieties

The right variety for you depends on your altitude, market, and how quickly you need to turn the crop around. Riana F1 and Gloria F1 are popular medium-maturing hybrids (roughly 80 to 90 days to maturity); Riana F1 is noted for tolerance to black rot disease, while Gloria F1 is valued for holding up well during transport. Pruktor is another medium-maturity hybrid known for strong tolerance to both black rot and ring spot disease. For hot, lower-altitude conditions, heat-tolerant options like Copenhagen Market, Pretoria F1, Fiona F1, and Typhoon F1 are commonly grown, while Ruby Perfection F1 is noted for tolerating both cold and hot conditions; Green Challenger F1 and Chinese cabbage varieties are known for early maturity. Buy seed from a reputable agrovet or seed company rather than saving seed from a hybrid crop, since hybrids don't breed true.

## Quality Planting Material / Seed

Cabbage is almost always raised in a nursery bed before transplanting. Use fine soil free of stones, roots, and debris, and build raised beds about a metre wide (any convenient length up to around 100 metres, at a height of roughly 15cm). Sow seed in furrows about 1 to 2cm deep, with rows spaced at least 15cm apart, cover lightly with about a centimetre of fine soil, water well, and cover with straw or dry grass. A modest fertilizer application in the nursery bed, guided by a soil test where possible, helps seedlings establish strongly. If treating seed against early pest or disease attack, use a suitable registered product following the label and your agrovet's advice.

## Land Preparation

Prepare the land before the rains start rather than during a wet spell, since tilling wet ground compacts soil and risks spreading soil-borne disease. A soil test before planting is genuinely worth the effort, since it tells you what your specific plot needs. Add manure and fertilizer according to those results rather than a blanket rate, and clear old crop residues so they don't carry over pests and disease.

## Planting

Seedlings are usually ready to move from the nursery after about 4 to 6 weeks, depending on temperature. Transplant in the early morning or late afternoon when soil is cool and moist, and water seedlings about an hour beforehand so they lift cleanly. Aim to plant at the onset of the rains for a strong start.

## Spacing

Large-headed varieties generally need about 60cm by 60cm; medium-sized varieties do well at roughly 60cm by 45cm; small-headed varieties can go as tight as around 30cm by 30cm. Overcrowded cabbage competes hard for light, water, and nutrients, which shows up later as smaller, looser heads.

## Soil and Nutrient Management

Cabbage is a heavy feeder and generally needs nitrogen, phosphorus, and potassium in a roughly balanced 1:1:1 ratio -- the kind of balance found in blends like 10:10:10 or 12:12:12 -- though exact rates should come from a soil test rather than a fixed recipe. Cabbage does well with well-composted organic matter, but avoid fresh, unrotted manure, which can damage roots and attract pests. Cabbage is also moderately sensitive to salinity, so a soil test is worth doing if you suspect salty soil or irrigation water.

## Water and Irrigation

Cabbage needs consistent moisture, typically 380 to 500mm over the season, but doesn't tolerate waterlogging -- the goal is moist, not soggy, soil. Sprinkler or drip irrigation both work well, and a thin mulch layer (straw, dry leaves, crop residue, or sawdust) helps hold moisture and buffer temperature swings.

## Weed Management

Weeds compete for nutrients, water, and light, and also give pests and disease somewhere to live between crops. Control matters most in the early stages of growth, when a young plant can least afford competition.

## Pests and Diseases

Diamond-back moth (grey, with a diamond pattern visible when its wings are closed) is a persistent pest, managed with neem-based or other appropriate insecticides, or by intercropping with tomatoes, beans, or onions. Sawfly larvae (grey, caterpillar-like) strip leaves down to the veins; hand-picking and removing wild host plants from the cabbage family help. Aphids (green peach, mealy cabbage, and false cabbage aphid) suck sap and curl leaves, interfering with head formation. Slugs can be trapped by burying tins of water with a little yeast, and cutworms, which cut young stems at night, can be deterred by intercropping with garlic. On disease: club root (fungal, swollen distorted roots -- manage with rotation, destroying infected plants, and liming), bacterial soft rot (soil-borne, rots harvested heads with a bad smell -- avoid via rotation, field hygiene, and never harvesting wet), Alternaria leaf spot and ring spot (fungal/seed-borne leaf spotting -- manage with clean seed and rotation), black leg (seed-borne stem cankers -- clean seed, good drainage), black rot (bacterial, V-shaped leaf lesions and blackened veins, worse in hot wet weather), and damping-off (a nursery disease worse in overly wet conditions). If you need a pesticide or fungicide, always use a product currently registered for cabbage in Kenya, follow the label, and consult your county agricultural officer or a licensed agrovet.

## Crop Management

Walk your field regularly checking for pests, disease, weeds, and general vigour. Conservation tillage helps conserve moisture and reduce compaction. Remove and destroy, or deeply plough in, crop residues rather than leaving them on the surface, and consider intercropping as part of a broader pest management strategy.

## Head Development and Maturity

A mature cabbage has a well-developed, solid head that feels firm when squeezed, generally reached around 3 to 4 months after transplanting. This firmness is your best field signal to harvest; a head left too long past maturity is prone to splitting.

## Harvesting

Use a sharp knife to cut heads at the base, leaving some outer wrapper leaves attached to protect the head in transport. Harvest while heads are cool and dry rather than in warm, humid weather, since that raises the risk of bacterial soft rot. Avoid injuring the head, since any wound becomes an entry point for rot, and practice field sanitation afterward by clearing residues and weeds promptly.

## Post-Harvest Handling

Get harvested cabbage out of direct sun and into a well-aerated, shaded area for sorting and packing quickly, since wilting sets in fast. Sort out any heads with visible disease or damage. Grading by size -- small (roughly one to two kilograms), medium (roughly three to four kilograms), and large (over about five kilograms) -- helps meet different buyers' preferences.

## Storage

Cabbage keeps for around two to three weeks in a cool, airy place. Avoid airtight bags or containers, since trapped moisture encourages rot.

## Marketing

Cabbage is widely available in Kenyan local markets, so prices move with local supply and demand more than with any one farmer's decisions. Selling fresh, straight from farm to market, generally preserves quality and value best.

## Common Mistakes

Letting harvest slip past maturity, leading to split heads, is the most common misstep. Skipping the soil test and guessing at fertilizer rates, applying fresh unrotted manure, and harvesting in wet conditions are other frequent, avoidable mistakes.

## Farm Business Considerations

Staggering your planting so your harvest doesn't land at the same time as everyone else's nearby can help smooth out both labour and market timing. Keep basic records of input costs against sales, and consider coordinating sales with nearby farmers, since buyers often prefer a larger, more consistent supply. For deeper, regularly updated technical detail on cabbage varieties, pests, diseases, and production practices, see KALRO's cabbage TIMPs resource, our Go Deeper link for this crop.$c$,
  true
),

-- ============================================================
-- ONION
-- ============================================================
(
  'shamba-space-onion-guide', 'crop-farming', 'onions', 'harvest_post_harvest', 'article', 'shamba_original', null, null,
  'Growing Onions in Kenya: A Shamba Space Guide',
  $s$A practical guide to growing bulb onions in Kenya, covering site and variety selection, seed sourcing, weed and pest management, curing, storage, and group marketing.$s$,
  $c$## Getting Started

Onion is one of the most consistently in-demand vegetables in Kenyan kitchens and markets. Bulb onion farming has grown across the country's onion-growing counties, and for smallholders it can be a genuinely worthwhile crop because demand rarely disappears, even as prices move with the season. Onion is also one of the fussier vegetables to get right: it's a slow starter, a poor competitor against weeds, and sensitive to a handful of diseases that can wipe out a large share of an unmanaged crop. This guide walks through what matters most, from site and variety selection through curing and storage, in Shamba Space's own words, informed by (not copied from) KALRO's research on the onion value chain.

## Choosing the Right Site

Onion does best on fertile, well-drained soils with a pH in the range of roughly 6.0 to 6.8. Kenyan onion-growing research has covered altitudes from close to sea level up to around 1,900 metres above sea level, with rainfall around 500 to 700mm and temperatures of roughly 15 to 30 degrees Celsius. Because onion competes poorly with weeds and dislikes excess moisture around the bulb, good drainage matters as much as fertility when choosing a site.

## Suitable Varieties

KALRO has identified several improved onion varieties for Kenya, some bred specifically for tolerance to pink rot disease and drought. Red Creole is an open-pollinated, short-day red variety suited to low-altitude, hot, low-rainfall conditions, producing small to medium bulbs with a shelf life of up to about three months, and noted for pink rot tolerance. Jambar F1 is a red hybrid maturing around 90 days after transplanting that cures easily and produces larger bulbs often preferred by hotels and institutions. Red Passion F1 and Redstar F1 are further red varieties maturing in roughly 90 days, noted for good curing and storage and suited to a range of altitudes. Several other varieties (Red Couch F1, Texas Early Grano, Red Pinoy F1, Neptune F1, Bombay Red) are also listed by KALRO as ready for wider use, though we couldn't confirm their individual characteristics in enough detail to describe accurately here -- ask your county extension officer which varieties are performing well locally.

## Quality Planting Material / Seed

Certified seed from a reputable seed company or agrovet is the safest starting point, since KALRO's research notes that seed companies are the main formal source of good onion seed in Kenya, and many farmers struggle to access or afford it consistently. An informal seed system also exists -- farmers selecting and saving their own seed, or exchanging within their community -- which carries a higher risk of carrying over seed-borne disease. Raise seedlings in a nursery under close management before transplanting where possible, since nursery-raised seedlings establish more reliably than direct-seeded ones. We couldn't confirm specific nursery bed dimensions or seedling transplant age for onion from the source, so ask your extension officer for guidance suited to your variety and season.

## Land Preparation

Prepare a well-drained, weed-free seedbed before planting, since a clean start matters more for onion than for many crops given how poorly it competes with weeds later. Plant in clearly defined rows rather than scattering, since this makes inter-row weeding, curing, and harvest all more manageable.

## Planting

Use disease-free, nursery-raised seedlings where possible rather than direct field seeding, for a stronger, more even start. Plant into rows on well-prepared, weed-free ground.

## Spacing

Kenyan onion research trials have used a row spacing of around 30cm between rows. We couldn't confirm a specific plant-to-plant spacing within the row from the source material -- this can reasonably vary by variety and whether you want smaller salad bulbs or larger storage bulbs -- so ask your county extension officer for a recommendation suited to your goals.

## Soil and Nutrient Management

Soil fertility varies across Kenya's onion-growing areas: older, weathered soils tend to be naturally low in nutrients, while younger volcanic soils can be richer but sometimes lock up phosphorus. An integrated approach -- combining organic inputs like manure or compost with fertilizer, guided by a soil test -- tends to work best. Two useful techniques are fertilizer banding (placing fertilizer close to the root zone rather than broadcasting) and micro-dosing (small amounts applied at planting and again a few weeks after emergence). We don't have a verified specific NPK rate for onion from the source material, so get a soil test done and consult your county agricultural officer for a rate suited to your plot.

## Water and Irrigation

Onion-growing areas typically see rainfall of about 500 to 700mm, but given onion's shallow roots, consistent moisture during bulb development matters more than total seasonal rainfall. In drier areas, drip irrigation, water pans, and small ponds can help bridge dry spells. We don't have a verified specific irrigation schedule for onion, so ask your extension officer for guidance suited to your local rainfall pattern.

## Weed Management

Onion is a genuinely poor competitor against weeds -- its narrow, upright leaves don't shade out weeds the way a broader-leaved crop would. Manual weeding is the most common approach in Kenya, typically done around two weeks after planting and again before flowering (roughly four to six weeks in). Mechanical weeding isn't generally advisable given onion's shallow roots and tight spacing. If using a herbicide, get guidance from your county agricultural officer or a licensed agrovet on a product currently registered for onion in Kenya.

## Pests and Diseases

Cutworms are a major pest in both nursery and field, especially around transplanting -- they hide in soil by day and cut young plants at night. Deep ploughing about two weeks before transplanting exposes them to predators and sunlight, and intercropping with garlic, peppermint, or coriander every ten to twenty rows can help repel them. Onion thrips are a serious dry-season pest and also spread virus diseases; sticky traps, agri-nets on nursery beds, and weed-free fields all help manage them. Onion fly favours cool weather and organic-rich soils, attacking seedlings early and later the bulb itself (raising storage rot risk); regular scouting at least twice weekly helps catch outbreaks early. Aphids (black, green, or yellowish-green, clustering on growing leaves) are a dry-season problem and virus vector; natural predators like ladybird beetles and parasitic wasps offer real control if not disrupted by unnecessary spraying. On disease, downy mildew and purple blotch are the two most damaging diseases in Kenyan onion, both favoured by humid, wet conditions, and both capable of causing serious crop loss if unmanaged; control relies on disease-free seed/bulbs, resistant varieties where available, wider spacing for airflow, weed-free fields, rotation away from other Allium crops, and prompt destruction of infected debris. If you need a pesticide or fungicide, use a product currently registered for onion in Kenya, follow the label, and consult your county agricultural officer or a licensed agrovet.

## Bulb Development and Maturity

Bulb onions are generally ready around three months after transplanting. Look for roughly three-quarters of the tops turning brown or yellow, falling over, and drying, along with a dry, tight neck and papery outer skin. Another useful check is roughly half the bulb becoming visible above the soil line ("neck fall"), plus a pinch test on the neck -- stiff means not ready, soft means mature. Green/salad onions can be harvested much earlier, during thinning at around 45 to 60 days.

## Harvesting

As bulbs form, keep them lightly covered with soil to reduce sun-scald, and remove soft or rotting bulbs regularly. Manual harvesting -- loosening bulbs with a fork before gently pulling by hand -- reduces bruising compared to yanking bulbs out. Harvest on hot, sunny days rather than during rain, and get bulbs to a curing area promptly if rain starts. Avoid leaving onions in the ground too long past maturity, since late harvest causes excessive sprouting in storage.

## Post-Harvest Handling

Bulbs are typically left in the field for two to three days after pulling, with tops of one row laid over the bulbs of the next to protect against sun-scald. Curing -- drying the neck and outer scale leaves -- is the critical next step, reducing neck rot, moisture loss, and sprouting in storage. Natural curing (spreading bulbs on a raised, shaded, well-ventilated rack, or hanging tied bunches) takes about two to three weeks; onions are ready when the neck is tight, the skin is dry and rustles, and colour is uniform. Artificial curing (warm air through crates for around twelve hours) gives more consistent results but needs equipment most smallholders won't have.

## Storage

Store cured onions in a clean, dry, well-ventilated room away from direct sun and dampness. Well-cured onions stored this way can potentially keep for up to around six months, though it's best to sell or use them sooner, since bulbs slowly lose weight and quality over time.

## Marketing

Because most onion farmers in Kenya operate at fairly small scale, individual farmers often struggle to access better-paying market channels that want reliable volume and consistent quality. Marketing as a group can help by offering buyers bigger combined volumes, more uniform quality, and a more consistent supply, translating into a stronger negotiating position -- though group marketing tends to work only with a clear production plan and real member commitment, since side-selling and inconsistent delivery are common challenges. Well-cured, well-graded onions consistently attract more buyer interest than poorly handled ones.

## Common Mistakes

Neglecting weeds early on is the most costly mistake, since onion competes so poorly with weeds that a slow start is hard to recover from. Skipping curing, or curing in poor conditions, is another frequent error that shows up later as storage losses. Harvesting during or right after rain, and relying on uncertified, farmer-saved seed from disease-affected fields, are two other common and avoidable mistakes.

## Farm Business Considerations

Because onion prices move with the season and local harvest timing, staggering planting where practical can help avoid selling into a local glut. Curing and storage genuinely extend how long you can hold onions, giving you flexibility to wait for a better price rather than selling immediately at harvest. If producing at real volume, group marketing arrangements with nearby onion farmers are worth exploring. For more detailed, regularly updated technical guidance on onion varieties, pests, diseases, and production practices, see KALRO's Inventory of Climate Smart Agriculture Technologies for the Onion Value Chain, our Go Deeper resource for this crop.$c$,
  true
),

-- ============================================================
-- MANGO
-- ============================================================
(
  'shamba-space-mango-guide', 'crop-farming', 'mango', null, 'article', 'shamba_original', null, null,
  'Growing Mango in Kenya: A Shamba Space Guide',
  $s$A guide to establishing and managing a mango orchard in Kenya, covering site and variety selection, pruning, general pest and disease management principles, harvesting, and marketing, with clear notes where KALRO's training material didn't provide enough detail to give a specific figure.$s$,
  $c$## Getting Started

Mango has earned its nickname as the "king of fruits" in Kenya for good reason -- it's a major income source for smallholder farmers, especially across the drier eastern and coastal counties, and one of the more climate-resilient tree crops available where rainfall is unpredictable. Around 80 percent of Kenya's mango production comes from small-scale farmers, grown for both the domestic market and export, particularly to Middle Eastern markets. Mango also tolerates water stress well once established, pairs reasonably with intercropping, and being evergreen, contributes to carbon capture on the farm. This guide walks through what's needed to establish and manage a productive mango orchard, in Shamba Space's own words, informed by (not copied from) KALRO's training material on the mango value chain. Because that underlying material is itself a trainer's guide rather than a detailed technical manual, some sections here are more general than others -- where we couldn't confirm a specific figure, we've said so rather than guessed, and pointed you toward your county extension officer or the Go Deeper resource.

## Choosing the Right Site

Mango is genuinely drought-tolerant, with an annual rainfall requirement of roughly 500mm to 1200mm -- a wide band reflecting how adaptable the crop is to Kenya's drier zones. It's grown across coastal counties (Kwale, Kilifi, Taita Taveta, Tana River, Lamu), eastern counties (Meru, Machakos, Kitui, Embu, Makueni, Tharaka-Nithi), parts of Baringo and Elgeyo Marakwet in the Rift Valley, and on a smaller scale in Busia. Most mango in Kenya is grown by smallholders under rain-fed conditions, often intercropped with maize, simsim, cassava, green grams, and cowpeas while trees are young. We couldn't confirm specific altitude or soil pH requirements for mango from the source material, so check with your county agricultural officer on whether your site and elevation suit the variety you're considering.

## Suitable Varieties

Kenya grows both indigenous mango varieties (drought tolerant, but generally smaller, more fibrous fruit on very tall trees) and exotic, improved varieties introduced from the 1980s onward from the USA, Israel, Brazil, and South East Asia. For export, the main varieties are Apple, Keitt, Tommy Atkins, and Van Dyke; Ngowe and other indigenous varieties remain important for the domestic market. We couldn't confirm specific maturity periods, altitude preferences, or disease resistance details for individual varieties from the source material, so ask your extension officer or a reputable nursery which variety performs best in your area and market.

## Quality Planting Material / Seed

Kenya has both a formal system (legally certified seed and seedling production with defined certification processes) and an informal system (community seed and seedling bulking, farmer-to-farmer exchange) for mango planting material. Both public and private nurseries produce mango seedlings, and buying from an established, reputable nursery is generally the safer route for a new orchard. We couldn't confirm specific grafting or rootstock requirements for new plantings from the source -- the only place grafting is explicitly described is in rejuvenating old trees, where new shoots are grafted with scions of a different variety -- so ask your nursery supplier directly whether seedlings are grafted and onto what rootstock.

## Land Preparation

Good land preparation starts with proper spacing decisions, since fixing an overcrowded orchard later is far harder than planning for it up front. We couldn't confirm specific pit dimensions, land-clearing steps, or timing recommendations for mango from the source material, so this is worth discussing with your county extension officer before you begin.

## Planting

We couldn't confirm specific planting steps, hole dimensions, or timing recommendations for mango from the source material. What is clear is that the crop is mostly established under rain-fed conditions, often intercropped with short-duration crops like maize or legumes while trees mature, which can generate income from the land before the mango starts bearing.

## Spacing

Correct spacing is clearly emphasized in KALRO's training material: closer spacing leads to overcrowding, competition for nutrients, and inadequate air and light penetration, which in turn lets pests and diseases build up and reduces yields. We couldn't confirm a specific recommended spacing distance in metres for mango from the source material, so ask your county extension officer for guidance suited to your variety's mature canopy size -- this is worth getting right before planting.

## Soil and Nutrient Management

Kenyan soils in mango-growing areas are commonly deficient in nitrogen, phosphorus, potassium and sulphur, as well as zinc, molybdenum and boron; without replacement through fertilizer and manure, yield, fruit quality, and soil health all decline over time. An integrated approach combining organic manure with inorganic fertilizer, guided by conservation agriculture principles, tends to give more sustainable results than fertilizer alone. KALRO's own material flags that many mango farmers lack access to site-specific fertilizer recommendations, leading to guesswork, low productivity, and physiological disorders in the fruit. We don't have a verified specific fertilizer rate for mango, so a soil test and a conversation with your county agricultural officer are the best starting point.

## Water and Irrigation

Mango's drought tolerance (rainfall requirement of roughly 500mm to 1200mm) is a major advantage in Kenya's semi-arid and arid growing areas, though young establishing trees and fruit-developing trees both benefit from more reliable moisture than a mature, hardened tree needs. We couldn't confirm specific irrigation volumes or schedules from the source material, though various water-harvesting and moisture-conservation technologies are increasingly used in dry mango-growing counties -- ask your extension officer which suit your situation.

## Weed Management

Keeping the area around young mango trees weed-free is standard good practice, since weeds compete for the same water and nutrients a young tree needs. KALRO's material includes a dedicated module on integrated weed management for mango, but we couldn't confirm which specific weeds are most problematic, or specific control recommendations, from the extracted text. If you need a herbicide, get guidance from your county agricultural officer or a licensed agrovet on a product currently registered for mango in Kenya.

## Pruning and Canopy Management

Pruning's core purpose is straightforward: remove dead, entangled, and diseased branches, and open up the canopy for more light and air. Better airflow reduces the conditions that let pests and diseases build up in a dense canopy. For old, tall trees that have become difficult to spray or harvest safely, coppicing and top-working offer a way to rejuvenate them -- the upper part of the tree is cut back, and the new shoots are either grafted with scions from a different variety or left to regrow at a more manageable height. This is generally done on old, unproductive trees rather than young, actively bearing ones.

## Pests and Diseases

We want to be upfront about the limits of what we could verify here. KALRO's training material describes mango pest, disease, and weed management as a training topic covering integrated pest management (IPM), scouting, threshold-based decisions, and integrated disease management (IDM) in principle, but the specific pest and disease names, symptoms, and controls sit in separate handouts and slides not included in the text we extracted. Rather than guess, we're flagging this as a genuine gap: for identification of specific mango pests and diseases in Kenya and how to manage them, consult your county agricultural officer, a licensed agrovet, or KALRO's mango pest and disease fact sheets directly. What the source does support with confidence is the general approach: scout your orchard regularly rather than spraying on a fixed schedule, use cultural and physical controls (like pruning out infected material and maintaining canopy airflow) before chemical options, and if you do need a pesticide or fungicide, choose a product currently registered for mango in Kenya, follow the label instructions exactly (including correct sprayer calibration), and get guidance from your county agricultural officer or a licensed agrovet.

## Crop Management

Regular orchard walks -- checking for pest and disease pressure, weed competition, and general tree vigour -- are the backbone of good mango management. KALRO's material also emphasizes safe agrochemical practices, including proper sprayer and nozzle calibration so you apply the right amount rather than over- or under-dosing. Keeping basic records of what you observe and apply over time helps you spot recurring patterns.

## Flowering and Fruit Development

One pattern worth planning around: KALRO's own data on national mango production notes that the crop tends to show an alternate, or biennial, bearing pattern -- a heavier crop one year is often followed by a lighter one the next. We couldn't confirm specific details on mango flowering triggers, pollination requirements, or fruit development timelines from the source material, so for guidance on your specific variety, your county extension officer or an experienced local grower will be a more reliable source than a general guess.

## Harvesting

Harvest timing matters a great deal for mango -- fruit harvested too early or too late both cause problems with quality, shelf life, or proper ripening. The material emphasizes being prepared before harvest with the right containers and technique, and using appropriate methods to avoid bruising, since mango bruises easily and any damage becomes an entry point for rot. We couldn't confirm the specific physiological maturity indices (the visual or physical signs used to judge ripeness) for mango from the source material, so confirm these with your county extension officer or an experienced local grower for your specific variety.

## Post-Harvest Handling

Mango is genuinely delicate and highly perishable, and KALRO's own material notes that postharvest losses can run as high as 30 to 50 percent when fruit isn't handled properly after harvest. Recommended practices include using appropriate harvesting and holding containers to minimize bruising, sorting and grading against recognized standards, and, where possible, precooling harvested fruit using low-cost methods like a charcoal cooler or a zero-energy cooler to slow ripening before it reaches a buyer. Careful packaging and transportation round out the chain, since even well-handled fruit can be damaged on the way to market.

## Storage

Because fresh mango is so perishable, precooling and prompt marketing matter more than long-term ambient storage. We couldn't confirm specific storage duration figures or conditions for fresh mango from the source material, so precooling as described above and moving fruit to market quickly are the most reliably supported practices we found. Processing mango into juice, chutney, or jam is a well-established way to extend its usable life well beyond fresh storage, worth exploring for surplus or lower-grade fruit.

## Marketing

Mango is grown in nearly every part of Kenya, but production is concentrated in the Eastern and Coast regions, which together account for roughly 79 percent of the national area under the crop, with Lower Eastern currently the leading producing area; the mango subsector as a whole is reported to support the livelihoods of more than 60,000 rural households. KALRO's material highlights group or collective marketing, contracted production arrangements with buyers or processors, and mobile/internet-based marketing channels as ways smallholders can strengthen their market position. Moving from a subsistence mindset toward basic farm-business practices -- a simple business plan, record-keeping, and understanding your break-even point -- is also emphasized. Processed products add a further market channel beyond fresh sales, which can help smooth income swings from mango's alternate bearing pattern.

## Common Mistakes

The biggest flagged risk in KALRO's material is applying fertilizer without site-specific guidance, leading to low productivity, poor fruit quality, and physiological disorders that a soil test and proper advice could largely avoid. Overcrowding trees through poor spacing decisions at planting is very difficult to fix later. Neglecting pruning, so trees become dense, shaded, and pest-prone, is another common issue, as is underestimating how much a mango crop can lose to poor postharvest handling.

## Farm Business Considerations

Because mango often shows an alternate bearing pattern, it's worth planning household or farm finances with that swing in mind rather than assuming every season will match your best one. Given how concentrated Kenya's mango marketing infrastructure is in the Eastern and Coast regions, farmers elsewhere may find group marketing or contracted arrangements with buyers particularly useful. Because fresh mango loses value quickly after harvest, even simple value-addition options like processing surplus fruit into juice or jam can meaningfully improve overall returns, especially in a bumper year when fresh-market prices tend to soften. For more detailed technical guidance on mango varieties, agronomy, pest and disease identification, and postharvest handling, see KALRO's Training of Trainers Manual for the Mango Value Chain, our Go Deeper resource for this crop -- it's written for trainers and extension staff, so it goes deeper on specifics we've deliberately left general here.$c$,
  true
);
