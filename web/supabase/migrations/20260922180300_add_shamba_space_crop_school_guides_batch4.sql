-- Education 3.0, Phase 2: Shamba Space Crop School (batch 4 of 5).
--
-- Adds 3 new education_resources rows -- original Shamba Space guides
-- for Banana, Coffee and Cassava -- same pattern as prior batches:
-- existing topic_id, category_id='crop-farming', resource_type='article',
-- origin='shamba_original', no rehosting, no schema change.
--
-- Banana's assigned KALRO manual gave rich practice-level detail but no
-- altitude/rainfall/pH/spacing figures (confirmed absent from the full
-- 100+ page extracted text, not merely unread). Coffee's assigned KALRO
-- TIMPs page was confirmed genuinely thin (28 lines, history/species
-- only), so this guide also draws on the Global Coffee Platform's
-- "Kenya Coffee Sustainability Manual" -- itself explicitly referencing
-- KALRO-CRI seedling sourcing and CRI spray programmes -- for its deeper
-- agronomic content. Cassava's assigned KALRO TIMPs page was confirmed
-- comprehensive and used as the sole source.

insert into public.education_resources
  (id, category_id, topic_id, learning_category, resource_type, origin, source_id, external_url, title, summary, content, is_published)
values

-- ============================================================
-- BANANA
-- ============================================================
(
  'shamba-space-banana-guide', 'crop-farming', 'bananas', null, 'article', 'shamba_original', null, null,
  'Growing Banana in Kenya: A Shamba Space Guide',
  $s$A practical, plain-language guide to establishing and managing a banana orchard in Kenya, covering site selection, planting material, orchard management, pests and diseases, harvesting, and marketing.$s$,
  $c$## Getting Started

Banana is one of Kenya's most important fruit crops and a genuine multi-purpose plant: it's a staple food, a source of livestock feed, and a steady cash earner for households across the country, especially in Central Kenya, Meru, Kisii, Nyanza, and parts of the Rift Valley. It's also a perennial -- once well established, a healthy mat (the cluster of plants growing from one planting point) can keep producing for years if you manage it properly. This guide draws on Kenya's national KALRO training curriculum for the banana value chain, translated into practical, everyday language. Because banana is a long-term investment in your land, it rewards farmers who get the basics right from day one: site, planting material, and orchard management.

## Choosing the Right Site

Banana does best where farmers can match the crop to the area's altitude, rainfall, temperature, and humidity -- these are exactly the factors Kenyan extension trainers are taught to assess county by county before recommending banana as an enterprise. Soil type and pH also matter a great deal for banana's shallow, wide-spreading root system, and generally fertile, well-draining soils suit the crop best. Because the ideal ranges differ somewhat by variety and by agro-ecological zone, we won't give you a single number to chase here -- instead, ask your county agricultural office which zones and altitudes around you are officially recognised as banana-suitable, since they'll have zone-specific guidance for your exact location. Waterlogged or very poorly drained sites should be avoided regardless of zone, since banana roots are vulnerable to rot in standing water.

## Suitable Varieties

Kenyan farmers grow three broad groups of banana: dessert (table) varieties eaten fresh, cooking varieties, and multipurpose types used for both. Common dessert cultivars include Grand Nain, Gros Michel, Williams hybrid, Valery, and several Cavendish types (Chinese, Giant, and Dwarf Cavendish, plus Apple banana); common cooking cultivars include Gradi, Shisikame, Mutahato, Uganda Green, and Ng'ombe; and Muraru and Gold Finger are grown as multipurpose types. Nationally, extension programmes have been pushing farmers toward improved varieties -- generally shorter, quicker to bear fruit, and more manageable -- over older local types, which tend to be tall, slow to come into production, and produce smaller, more fibrous fruit that's harder to sell. Improved varieties are also generally easier for processors and exporters to work with because of their fibreless flesh and better recovery during processing. Talk to your county extension office or a reputable tissue-culture supplier about which named varieties are being promoted in your specific area, since suitability varies by altitude and market.

## Quality Planting Material

Never plant banana from an unknown or diseased mother plant -- planting material is where most of banana's worst pest and disease problems start, and it's the single biggest lever you have for a healthy orchard. Kenya's extension system promotes two main clean-planting-material routes: macro-propagation from carefully selected, pared, and hot-water-treated suckers (the small shoots that grow from an existing banana mat), and tissue culture, where plantlets are produced in a laboratory and then "hardened" in a nursery before going to the field. If you're sourcing suckers, choose them from healthy, high-yielding mother plants with no visible pest or disease symptoms, and have them pared (trimmed) and hot-water treated to kill hidden pests like nematodes and weevils before planting. Tissue-culture plantlets should come from a hardening nursery sited with good water access, security, and accessibility -- ask your supplier whether their material has gone through a proper hardening process, since skipping this step leads to weak, slow-establishing plants.

## Land Preparation

Prepare the site by clearing bush and removing perennial weeds (using a herbicide where necessary), then lay out the field and dig your planting holes -- these are the core land preparation steps used in Kenya's banana orchard-establishment training. Good field layout at this stage makes later operations like weeding, irrigation, and harvesting far easier, so it's worth taking time over row alignment before you plant a single sucker. If your land has never grown banana before, or has grown other perennial crops, consider a soil test so you know what you're working with before you invest in planting material.

## Planting

Mix your top-soil with manure and, where recommended, phosphate fertiliser before backfilling the planting hole, then plant and firm the soil gently around the base of the sucker or plantlet. Water-harvesting structures such as zai pits (small planting basins that trap rainwater and organic matter) are promoted specifically for banana in drier areas, and are worth considering if your area has erratic rainfall. Because banana is a heavy feeder and a heavy drinker once established, getting the planting hole right -- proper mixing, firm but not compacted soil, adequate moisture at planting -- sets the tone for the tree's whole productive life.

## Spacing

Exact spacing recommendations depend on your variety's growth habit and your soil fertility, and this is genuinely a "consult a qualified extension officer for a site-specific recommendation" situation, since Kenya's national training materials leave final spacing decisions to local agronomic advice rather than a single fixed figure. What we can tell you is that spacing is one of the specific practical skills covered in KALRO's banana orchard-establishment training (alongside field layout and hole digging), so it's treated as a decision worth getting right rather than a rule of thumb -- ask your county office or agrovet for the current local recommendation for your chosen variety.

## Soil and Nutrient Management

Kenyan soils are widely recognised as deficient in several nutrients banana needs -- nitrogen, phosphorus, potassium and sulphur among the macronutrients, and zinc, molybdenum and boron among the micronutrients -- so soil and plant tissue testing through an accredited laboratory is strongly encouraged before you settle on a fertiliser programme. Integrated Soil Fertility Management (ISFM) -- combining organic inputs like manure and compost with mineral fertiliser, plus practices like legume intercropping, crop rotation, and conservation agriculture -- is the approach Kenyan extension promotes for banana, rather than relying on mineral fertiliser alone. We're deliberately not giving you fixed fertiliser rates here, since the right rate depends on your specific soil test results, your variety, and your yield goals; a soil test plus a chat with your county agricultural officer will get you a recommendation that actually fits your farm.

## Water and Irrigation

Banana needs consistent moisture, and Kenya's national training curriculum treats water management as being just as important as soil fertility for banana productivity, particularly given how unpredictable rainfall has become. Where rainfall is unreliable, water-harvesting structures like zai pits and drip irrigation are both promoted technologies for banana in Kenya. If you're on rain-fed land, mulching (discussed below) is one of the simplest ways to conserve the soil moisture you do get.

## Weed Management

Basin formation and mulching go hand in hand with weed control in banana orchards -- keeping a clean basin around each mat and maintaining good mulch cover both suppress weeds while also conserving moisture. Especially while the orchard is young and canopy cover is still thin, regular weeding protects your bananas from competition for nutrients and water. Choose mulching materials that are readily available on your farm or nearby, and keep them from piling directly against the pseudostem to avoid creating damp conditions that favour pests and rot.

## Pruning and Canopy Management

Ongoing canopy management in a banana orchard mainly means de-suckering (selectively removing excess shoots so the mat isn't overcrowded), pruning of old leaves and pseudostems, and propping (supporting heavily-laden plants so they don't topple under the weight of a full bunch). These are core, recurring tasks in banana orchard management, done throughout the plant's productive life rather than once at establishment. Keeping only the right number of healthy suckers per mat helps concentrate the plant's energy on fewer, better bunches rather than many small ones, and propping becomes especially important as a mat carries a heavy bunch during wet or windy weather.

## Pests and Diseases

The pests most worth watching for in a Kenyan banana orchard are weevils (which attack the rhizome and pseudostem, causing plant death, delayed maturity, and reduced bunch weight), nematodes (microscopic worms that damage roots and can persist in soil for years, which is a particular problem given banana is a long-lived perennial), and thrips (which cause surface damage that mostly affects the fruit's marketability rather than the plant's survival). On the disease side, Fusarium wilt, Sigatoka leaf disease, and Banana Xanthomonas Wilt (BXW) are the major diseases flagged in national training material as serious threats to Kenyan banana production. Good field hygiene, starting with clean planting material (paring and hot-water treatment of suckers, or certified tissue culture), sterilising tools between plants, and prompt removal of infected material, does most of the heavy lifting in prevention. If you do need to use a pesticide, always choose a product currently registered for banana use in Kenya, follow the label instructions exactly, wear the recommended protective gear, and get guidance from your county agricultural officer or a licensed agrovet -- we've deliberately not listed specific products or rates here, since registrations and recommendations change over time.

## Crop Management

Intercropping is a recognised practice in Kenyan banana systems and is covered explicitly in national orchard-management training, though the right intercrop and spacing will depend on your specific mat spacing and local conditions -- ask your extension officer what's being recommended for banana intercropping in your area. Beyond intercropping, day-to-day crop management is really the sum of everything else in this guide done consistently: weeding, mulching, watering, de-suckering, and watching for early signs of pests or disease. Consistency matters more than intensity with a perennial crop like banana -- small, regular attention pays off more than occasional major interventions.

## Flowering and Fruit Development

Banana flowers and fruits continuously through the year rather than on one fixed seasonal schedule, which is part of why it's valued as a steady income and food-security crop for Kenyan households. Because the crop is perennial and each mat can have suckers at different growth stages simultaneously, a well-managed orchard can have some mats flowering or fruiting while others are newly planted or freshly harvested -- this is one of banana's real advantages over many annual crops. Good nutrition, water, and pest and disease control throughout the plant's growth all feed directly into bunch size and fruit quality at harvest, so the work you do earlier in this guide pays off here.

## Harvesting

Postharvest tools for assessing maturity, along with proper harvesting practices, are treated as a distinct, important skill set in Kenyan banana training -- getting harvest timing right has a real effect on both quality and how well the fruit holds up afterward. Kenya's training materials specifically promote bunch bagging using perforated polythene bags to protect developing fruit and improve quality, with the right bag colour and perforation pattern varying somewhat by agro-ecological zone. Harvest carefully to avoid bruising, since banana fruit is highly perishable and any mechanical damage at this stage accelerates spoilage later.

## Post-Harvest Handling

Sorting and grading, careful de-handing, and clean handling throughout are the practices Kenyan training promotes to protect quality after harvest, since banana postharvest losses in Kenya are recognised as a serious national problem tied to poor handling and under-use of improved postharvest technologies. Low-cost cooling options such as the Zero Energy Brick Cooler (an evaporative cooling structure built from brick and sand that needs no electricity) are among the postharvest technologies promoted specifically to Kenyan banana farmers to slow ripening and extend shelf life. Handle bunches gently at every stage -- from cutting, through transport, to storage -- since bruised or damaged fruit both loses value and ripens unevenly.

## Storage

Because banana is highly perishable, storage is really about slowing ripening rather than long-term preservation, and simple, low-cost cooling technologies are the main tool Kenyan extension promotes for smallholders rather than expensive cold-chain infrastructure. Keep harvested bunches out of direct sun, well-ventilated, and away from ripening fruit if you need to delay sale even briefly. If you're planning to sell into a market with any distance or delay involved, plan your harvest and cooling around your actual transport and sale timeline rather than harvesting and hoping for the best.

## Marketing

Kenya's banana sub-sector has historically struggled with disorganised marketing and weak infrastructure -- particularly poor rural roads and a lack of proper grading sheds -- which is exactly why sorting, grading, and careful postharvest handling (covered above) matter so much for what price you can command. Value addition is a real opportunity worth exploring: Kenyan training programmes actively promote household- and small-enterprise-level processing of banana into products like flour, juice, jam, and wine, which can open up markets beyond fresh fruit sales. Whichever channel you sell through, basic business skills -- record keeping, understanding your costs, and building genuine market relationships -- are emphasised in national training as being just as important as production skills for a profitable banana enterprise.

## Common Mistakes

The mistakes flagged repeatedly in Kenyan banana extension work are: planting from unknown or untreated suckers instead of clean, tested planting material; neglecting de-suckering and pruning until the mat becomes overcrowded and unproductive; skipping soil testing and guessing at fertiliser needs; and under-investing in postharvest handling, which is where a lot of otherwise-good produce loses its value. Poor market planning -- harvesting without a buyer lined up, or ignoring grading -- is another recurring theme, since banana's perishability punishes delay much more than hardier crops do. Treating banana as a "plant it and forget it" crop is probably the single biggest mistake, since it's genuinely a managed perennial system, not a one-off planting.

## Farm Business Considerations

Banana can be grown anywhere from a small subsistence patch to a fully commercial enterprise, and Kenyan training materials explicitly teach farmers to think about record keeping, budgeting (including basic tools like break-even and gross-margin analysis), and business planning alongside agronomy. Understanding your real costs -- planting material, labour, inputs, and postharvest handling -- against what you can realistically earn from your chosen market channel is the starting point for deciding how much to invest and how fast to expand. If you're aiming for commercial production, it's worth exploring both fresh-fruit markets and simple value-added products, since diversifying your outlets can reduce your exposure to any single market's price swings and gluts.$c$,
  true
),

-- ============================================================
-- COFFEE
-- ============================================================
(
  'shamba-space-coffee-guide', 'crop-farming', 'coffee', null, 'article', 'shamba_original', null, null,
  'Growing Coffee in Kenya: A Shamba Space Guide',
  $s$A practical guide to establishing and managing an Arabica coffee plot in Kenya, covering site selection, varieties, planting, pruning, pest and disease management, harvesting, processing, and marketing.$s$,
  $c$## Getting Started

Coffee has a long history in Kenya, first planted at Bura in Taita Hills in 1893 before spreading through Kibwezi, Kiambu, and eventually much of Central Kenya, Meru, Kisii, Machakos, Mount Elgon, and the Rift Valley. The two species grown commercially worldwide are Coffea arabica (highland coffee) and Coffea canephora (Robusta, or lowland coffee), and Kenya is overwhelmingly an Arabica-growing country. Coffee is a genuine long-term investment -- a well-established bush can produce for decades -- so getting your site, variety, and establishment right at the start matters more here than with almost any other crop in this guide. This guide focuses mainly on Arabica, since that's what the vast majority of Kenyan smallholders grow.

## Choosing the Right Site

Altitude is one of the biggest factors in whether Arabica coffee will thrive: it generally does best between about 1,200 and 2,100 metres above sea level, with an optimal temperature range of roughly 15 to 27 degrees Celsius and daytime temperatures ideally not exceeding 30 degrees. A wide day-to-night temperature swing is actually a warning sign -- when the difference between day and night temperatures goes much above 19 degrees, coffee leaves can show a distortion, yellowing, and cracking sometimes called "hot and cold" or crinkle leaf. Rainfall needs to be well distributed through the year, generally at least 1,000mm annually east of the Rift Valley or around 1,145mm west of it, and coffee actually benefits from a short one-to-two-month dry stress period before the rains, since that's what helps trigger flowering. Soil matters just as much as climate: coffee wants free-draining soil to a good depth (roughly 1.5 to 3 metres, especially in drier areas), reasonably fertile, and slightly acidic -- soils around pH 4.4 to 5.4 are considered suitable, and black cotton soils should be avoided entirely because of their poor drainage.

## Suitable Varieties

The main commercial Arabica varieties grown in Kenya are SL28, SL34, K7, Kenya Blue Mountain, Ruiru 11, and Batian. SL28 and SL34 are older, well-established varieties valued for high yields and excellent cup quality, but they're more vulnerable to two of Kenya's most damaging coffee diseases, Coffee Berry Disease and Coffee Leaf Rust. Ruiru 11 and Batian were specifically bred to resist both of these diseases, and K7 offers some tolerance to Coffee Leaf Rust as well as some drought tolerance, while still being high yielding. If you're planting new coffee or converting an old, disease-prone plot, ask your county coffee officer or KALRO's Coffee Research Institute which of these resistant varieties suits your altitude and local disease pressure, since the right choice can significantly reduce your future spray costs and disease losses.

## Quality Planting Material

Always obtain your coffee seedlings from KALRO's Coffee Research Institute or another licensed coffee nursery -- this is the single most important step for avoiding disease problems later, since planting material quality determines a huge amount about how your plot performs for the next several decades. Good seedlings for transplanting are typically about 30 to 40cm tall, with one or two pairs of primary branches already formed, and should have gone through a proper hardening process before you plant them. Never buy or accept seedlings from an unknown or unlicensed source, however cheap, since disease introduced at planting is extremely difficult and costly to manage afterward.

## Land Preparation

Clear the land thoroughly, digging out all tree stumps, roots, bushes, and grasses well before planting -- and importantly, avoid planting coffee on land cleared of trees within the last six months, because decaying roots and stumps create ideal conditions for Armillaria, a serious fungal disease that causes root rot. Get a soil analysis done at this stage so you know your starting soil condition rather than guessing. On steep ground, build terraces or other soil conservation structures, and protect the terrace faces by planting a stabilising grass cover on them. This groundwork, done properly once, saves you years of problems later, since coffee stays in the same spot for a very long time.

## Planting

Lay out and peg your planting points along the contour of the land at the correct spacing for your chosen variety, then dig planting holes about 60cm x 60cm x 60cm, ideally during the dry season and at least three months before you intend to plant. Keep the topsoil (roughly the top 15cm) and the deeper sub-soil separate as you dig, then about a month before planting, mix the topsoil with well-decomposed manure (or well-rotted coffee pulp) and a phosphate fertiliser, adding lime to the mix if your soil test shows a pH below about 4.4. Mound this mixture slightly in the hole to allow for settling, then at planting time remove the seedling from its pot carefully to avoid disturbing the roots, open the mound enough to seat the taproot properly, and plant without burying the stem crown -- deep planting is a common mistake that interferes with nutrient uptake and stunts growth. Firm the soil gently around the seedling without compacting it, and time your planting for the start of the main rains once the soil is thoroughly wet.

## Spacing

Recommended spacing varies by variety: roughly 2.74m x 2.74m (about 9ft x 9ft) for SL34, SL28, and K7; about 2m x 2m (roughly 6.6ft x 6.6ft) for Ruiru 11; and about 2.1m x 2.5m (roughly 7ft x 8ft) for Batian. These spacings reflect the different growth habits of each variety -- the more compact varieties like Ruiru 11 can be planted more densely than the traditional tall varieties. Stick closely to the recommended spacing for whichever variety you choose, since it affects everything from light penetration and disease pressure to how easily you can manage the trees later.

## Soil and Nutrient Management

Coffee needs a range of nutrients across its growth cycle: nitrogen supports vegetative growth and bean size, phosphorus supports root and bearing-wood development, potassium is important for bean size and grade quality, magnesium affects bean colour, and calcium supports flowering density and bud formation, while micronutrients like zinc and boron play specific roles in flower initiation, fruit set, and pollen fertility. Kenya's coffee sector uses soil and leaf tissue analysis to guide fertiliser decisions, and a young tree's nutrition needs generally increase in stages as it matures toward full bearing. We're deliberately not giving fixed fertiliser quantities here, since the right rate depends on your soil test results, tree age, and variety -- get a soil and leaf analysis done through an accredited laboratory and work from a site-specific recommendation from your county agricultural officer or coffee cooperative agronomist.

## Water and Irrigation

Young coffee needs regular watering until it's well established -- during dry spells, watering at least twice a week is a reasonable guide until the roots are properly developed -- but avoid over-watering, since that discourages the deep root growth the tree needs long-term. Mulching around (but not touching) the stem helps conserve moisture, suppress weeds, and moderate soil temperature for young trees. Established coffee generally relies on well-distributed rainfall rather than routine irrigation in most of Kenya's coffee-growing areas, though the pre-flowering dry spell mentioned earlier is actually a wanted stress period rather than something to irrigate away.

## Weed Management

Weeds compete directly with coffee for nutrients, light, and moisture, and can lower both the quantity and quality grade of your harvest, so timely control matters. Kenyan coffee training distinguishes annual weeds (easier to control, completing their cycle within a year) from perennial weeds like couch grass and nut grass, which are harder to eliminate and need more persistent management. Mechanical control -- careful, shallow hand hoeing, periodic forking to break hardpan, or slashing when soils are too wet to hoe -- is the mainstay for most smallholders, alongside cultural approaches like mulching and close spacing that suppress weeds naturally. Where herbicides are genuinely needed, use a product currently registered for coffee in Kenya, follow the label exactly, and treat chemical control as a last resort rather than a routine tool, since careless slashing or spraying near the stem can injure the tree and open the door to disease.

## Pruning and Canopy Management

Good pruning keeps a coffee tree productive for decades rather than letting it collapse into overgrown, disease-prone thickets, and it also opens the canopy to sunlight, which stimulates flowering and reduces both pest and disease pressure. Kenyan smallholders mostly use the "free growth" or uncapped system, where the tree keeps growing upward and pruning focuses on removing branches touching the ground, opening the tree centre, and maintaining a manageable bearing height depending on your local coffee zone. Alongside routine pruning, de-suckering (removing unwanted shoots at the base and along the main stem) needs to happen regularly, roughly every few months, to stop the tree wasting energy on growth you don't want. Every five years or so, coffee trees benefit from a "change of cycle" -- a planned, gradual rejuvenation of the old bearing wood with new growth -- which keeps a plot productive well beyond what an unmanaged tree could sustain on its own.

## Pests and Diseases

Kenya's four major coffee diseases are Coffee Berry Disease (which attacks green and ripe berries and can cause total crop loss in bad years), Coffee Leaf Rust (which causes leaf fall and can lead to dieback if uncontrolled), Bacterial Blight of Coffee, and Fusarium disease affecting the bark or roots -- together, disease management can account for a significant share of a coffee farm's production costs. On the insect side, the pests most worth watching for are the Antestia bug (which causes bud abortion and a distinctive "zebra pattern" on beans), the Coffee Berry Borer (whose larvae tunnel into and rot the inside of berries), thrips, various scale insects and mealybugs, and several stem and twig-boring beetles. Good cultural practice does much of the preventive work here: timely pruning, de-suckering, and change of cycle reduce disease inoculum and pest breeding sites; field hygiene (collecting and destroying infested or fallen berries) starves out berry borer populations; and planting resistant varieties like Ruiru 11 or Batian, or converting old susceptible trees through top-working, gives you a real structural advantage against both major diseases. If you do need to use a fungicide, bactericide, or insecticide, always choose a product currently registered for coffee in Kenya, follow the label instructions exactly, and get guidance from your county agricultural officer, KALRO's Coffee Research Institute, or a licensed agrovet -- we've deliberately not listed specific products, mixing instructions, or rates here, since registrations and recommended programmes change over time and are best obtained from an up-to-date, local source.

## Crop Management

Where land allows and trees are still young (generally within the first couple of years after planting), intercropping with short-season legumes like beans, or with vegetables such as tomatoes and Irish potatoes, is a recognised practice that can generate some income while the coffee is establishing. Keep any intercrop planted well clear of the coffee row itself so it doesn't compete directly with the young trees for nutrients and water. Beyond intercropping, day-to-day management is really about consistency across everything covered in this guide -- weeding, mulching, watering, pruning, and pest and disease scouting -- since coffee punishes neglect far more severely than it rewards occasional bursts of attention.

## Flowering and Fruit Development

Coffee flowering is triggered by rainfall breaking a dry spell, which is why that pre-flowering dry period matters so much for a good, even flowering. After flowering, berries move through a fairly predictable sequence of stages -- initial expansion, then final expansion and maturation -- before ripening into the red cherries that are ready to harvest, with the whole cycle timed differently depending on whether your area is a typically early or late main-crop coffee zone. Because flowering and fruiting can happen in more than one flush in a season, especially where rainfall is less predictable, a single coffee tree may carry berries at several different stages of ripeness at once, which is exactly why selective, repeated picking (rather than one single harvest pass) matters so much at harvest time.

## Harvesting

Only pick bright red, fully ripe cherries -- picking green or under-ripe berries causes problems later in pulping and fermentation and lowers your final quality grade. Use clean harvesting bags, baskets, or tins, keep picked cherry out of direct sun and off bare ground, and get it to processing on the same day it's picked, since delays before pulping affect quality. Kenyan law does not allow children to be used for coffee picking. Because ripening isn't uniform across a tree or a plot, expect to make several selective picking rounds through the season rather than one single harvest.

## Post-Harvest Handling

Wet processing is the dominant method in Kenya and, done correctly, is what protects the quality (and therefore the value) of your crop. After harvest, cherry should be sorted by hand to remove green, over-ripe, diseased, or damaged berries and any foreign material, then pulped on the same day to remove the outer skin -- with the lower-grade cherry that was sorted out processed separately by the simpler dry ("buni") method rather than mixed in. The pulped parchment then goes through fermentation (to break down the sticky mucilage coating, generally taking somewhere around 16 hours, tested by feel rather than a clock), thorough washing, and then careful, gradual drying in stages -- moving from a fast initial "skin drying" through to a final slow drying that brings the parchment down to a safe moisture level for storage. Cleanliness matters at every single stage: clean water, clean equipment, clean drying surfaces, and prompt removal of any leftover material between batches all directly protect your final quality and price.

## Storage

Store dried, properly conditioned parchment in a well-ventilated store, ideally on wooden pallets raised off the floor and away from walls, and stir it regularly to prevent moisture pockets from forming. Avoid storing parchment coffee in the same space as dry-processed buni coffee, and don't store chemicals or fuel anywhere near your coffee store, since coffee readily absorbs odours that can taint the final cup. Prolonged storage causes real quality loss -- coffee that sits too long can develop a "woody" character -- so plan your storage duration around your actual delivery and marketing timeline rather than holding stock indefinitely.

## Marketing

Kenyan coffee is sold through two main channels: the auction system at the Nairobi Coffee Exchange, or direct sales, both of which require you to work through a registered marketing agent appointed ahead of the season -- this is a legal requirement, distinct from your milling arrangement, and is usually best organised through your farmer cooperative society or estate management. Growers typically process their coffee through a registered miller and market it through this appointed agent rather than selling raw cherry or parchment directly on the open market; whichever channel you use, your marketing agent handles the practical side of getting your coffee to buyers. We're deliberately not stating specific prices here, since these move constantly with international markets -- your cooperative, miller, or marketing agent is the right source for current price information and for guidance on any grower registration or coffee mark-of-origin requirements that may apply to you.

## Common Mistakes

The costliest mistakes in Kenyan coffee growing tend to be: planting uncertified seedlings from an unknown source instead of KALRO-CRI or licensed nursery stock; planting on recently cleared forest or bush land without waiting out the Armillaria risk period; neglecting pruning and de-suckering until trees become tangled, shaded out, and disease-prone; skipping soil and leaf testing and guessing at fertiliser needs; and picking green or mixed-ripeness cherry to save time, which quietly erodes your quality grade and price at every harvest. Poor postharvest hygiene -- dirty processing water, delayed pulping, or careless drying -- is another recurring theme, since coffee's cup quality (and therefore its value) is largely determined in the hours and days right after picking, not just in the field.

## Farm Business Considerations

Coffee is a genuine long-horizon investment: it typically takes a few years to reach full bearing, and decisions you make at planting -- variety, spacing, site -- shape your costs and returns for decades afterward. Because disease management alone can account for a significant share of production costs, choosing resistant varieties like Ruiru 11 or Batian where they suit your area is as much a business decision as an agronomic one. Keep basic records of your input costs, labour, and sales through your cooperative or miller, since that's what lets you judge whether your enterprise is actually profitable and where costs might be trimmed -- your cooperative society is often a good source of both marketing support and basic business guidance for members.$c$,
  true
),

-- ============================================================
-- CASSAVA
-- ============================================================
(
  'shamba-space-cassava-guide', 'crop-farming', 'cassava', null, 'article', 'shamba_original', null, null,
  'Growing Cassava in Kenya: A Shamba Space Guide',
  $s$A practical guide to growing cassava in Kenya, covering site and variety selection, planting material, planting, weed and water management, pests and diseases, harvesting, storage, and processing.$s$,
  $c$## Getting Started

Cassava is grown across three main belts in Kenya -- the Coast, Western, and Central regions -- and stands out among root crops for how well it copes with drought and poor soils, ranking second in importance to potato among Kenya's root crops. It's grown everywhere from small subsistence plots to fully commercialised operations, and its flexibility is part of its appeal: the same crop can feed a household, feed livestock, or supply industrial processing, depending on how you manage and market it. Without improved varieties and better production practices, though, cassava yields on Kenyan smallholder farms tend to fall well short of its real potential -- which is exactly what the guidance below is aimed at closing.

## Choosing the Right Site

Cassava is genuinely one of the best options for marginal land -- it tolerates poor soils and high drought risk better than most food crops, and can produce a harvest on as little as around 500mm of rainfall a year in semi-arid conditions. That said, it still does best on well-drained, light-textured, deep sandy clay loam or loamy soils of moderate fertility; avoid land with a fluctuating water table or a hardpan layer, since these interfere badly with root development. A soil pH of roughly 4.5 to 6.5 is considered suitable, and cassava grows best where the mean air temperature sits around 25 to 29 degrees Celsius, with growth stopping altogether once temperatures drop below about 10 degrees. One counterintuitive point worth remembering: very high soil fertility can actually work against you, since it tends to push the plant into vigorous leafy top growth at the expense of the root development you're actually farming for.

## Suitable Varieties

Kenya has a wide range of KALRO-developed cassava varieties suited to different conditions, and picking the right one for your area and market is one of the most impactful decisions you'll make. Some varieties, like Katsuhanzala and KME-3, combine resistance or tolerance to cassava mosaic disease with sweeter, lower-cyanide roots suited to direct home consumption, while others are bred mainly for drought tolerance in harsher, semi-arid environments. Varieties also differ in growth habit -- some, like Shibe, Tajirika, and Nzalauka, grow with straight stems that make them well suited to intercropping, while others branch more and suit sole cropping better. Maturity periods vary considerably by variety too, with some ready for harvest in as little as 6 to 8 months and others needing 12 to 18 months, so ask your county agricultural office or local KALRO office which named varieties are currently recommended and available for your specific area, since availability and local disease pressure both shift over time.

## Quality Planting Material

Cassava is propagated from stem cuttings, not seed, so the health of your source stems matters enormously -- take cuttings only from healthy, mature plants that are themselves 10 to 12 months old. Handle stems carefully to avoid damaging the nodes (the small buds along the stem where new growth emerges), since node damage is a direct cause of poor establishment. If you can't plant immediately, store the stems under shade for a few days -- ideally no more than about two weeks -- standing them vertically with the lower end touching lightly moistened soil, in a weed-free area, which helps them sprout faster once planted than stems cut fresh from the field. When you're ready to plant, use a sharp, clean cutting tool (secateurs or a cutlass work well) to cut the stems into pieces about 25cm long, each carrying five to seven nodes, and avoid leaving fresh-cut stems lying in the open, since exposure dries them out quickly.

## Land Preparation

Start by clearing all bushes and undergrowth from the site, which removes early weed competition and gives your cassava a clean start. Till the soil to loosen it, improve aeration, and let cassava's roots penetrate more deeply -- this single step makes a real difference to how well the crop establishes, and it's also your opportunity to mix in dried animal manure or compost to build fertility. Timing matters: prepare the land just before the rains begin, or immediately after, and on sloped or shallow soils, form ridges or mounds to give the roots a deeper zone of loose topsoil to develop in. Land preparation can be done by hand hoe, animal-drawn implements, or tractor-mounted equipment, depending on what's available and appropriate for your scale.

## Planting

Cassava cuttings can be planted three ways: horizontally (buried 5 to 10cm deep, which tends to produce multiple, somewhat smaller stems and roots, and suits mechanised planting or drier climates), vertically (better suited to wetter conditions since the cutting is less likely to rot, though it can dehydrate under low rainfall), or at an inclined angle of around 45 degrees, which leaves two to three nodes above ground and can make harvesting a bit easier thanks to the resulting root orientation. Whichever method you choose, plant early in the morning or late in the afternoon when it's cooler, to reduce heat stress on the cutting, and check back after about two weeks to replace any cuttings that haven't sprouted. Getting cassava planted at the right time relative to rainfall matters more than many farmers expect -- ideally you want at least two months of reliably adequate soil moisture ahead of you after planting, since that's the window the crop needs to establish well.

## Spacing

Spacing in cassava depends heavily on the branching habit of your chosen variety and whether you're growing it alone or intercropped, so this is one area where a blanket figure would do you a disservice -- consult a qualified extension officer for a site-specific recommendation for your variety. As a general guide from Kenyan cassava extension practice, when cassava is grown as an intercrop, spacing is typically widened somewhat (roughly from 0.8m x 1m up to about 1m x 1m) compared to a tight sole-crop stand, specifically to accommodate both crops' growth habits without excessive competition.

## Soil and Nutrient Management

Cassava responds well to integrated approaches to soil fertility rather than relying on any single input. Rotating with or intercropping legumes such as soybean, or using a legume like Mucuna in fallow periods, helps rebuild soil fertility, manage troublesome weeds, and support water retention between cassava crops. Mulching the seedbed -- using dead leaves, rice husks, coffee hulls, crop or weed residues, or leguminous "live mulch" -- is especially valuable in dry areas and on sloped land, since it conserves moisture and organic matter as it breaks down. Beyond these organic approaches, a combination of chemical fertiliser and organic inputs, guided by soil testing where possible, is the integrated soil fertility management approach recommended for cassava; ask your county agricultural office for a site-specific recommendation rather than guessing at rates.

## Water and Irrigation

Cassava is mostly grown as a rainfed crop in Kenya rather than under irrigation, and its real strength is coping with limited and unreliable rainfall better than most staple crops. Water conservation techniques matter more than active irrigation for most cassava farmers: terracing and contour banks slow runoff on sloped land, minimum tillage helps sandy soils retain organic matter and moisture, and ridges or mounds increase the volume of loose topsoil available to each plant on shallow or hard soils. Correct spacing and, as mentioned above, planting at a time when at least two months of adequate soil moisture can be expected, are both effective and low-cost ways to manage water risk without needing irrigation infrastructure at all.

## Weed Management

Weeds are most damaging to cassava in its first three months, while the crop's canopy is still too small to shade them out on its own, so this early window deserves your closest attention. Kenyan cassava guidance describes hoe or cutlass weeding done three or more times depending on the weed pressure, with tractor-operated weeders an option for larger-scale operations. Where herbicides are used, a pre-emergent product applied early is typically followed by post-emergence control as new weeds appear -- if you go this route, use a product currently registered for the purpose in Kenya, follow label instructions carefully, and consult your county agricultural officer or a licensed agrovet, since we haven't listed specific products or rates here.

## Pests and Diseases

The pests most worth watching for in Kenyan cassava are green mites (which cause mottled, dying leaves and a distinctive "candle stick" shoot tip), cassava scales (whitish insects on the lower stems and leaves that can kill the plant from the top down), mealybugs (which cause sooty mould, leaf yellowing, and stunted growth), and termites, which are a particular threat to newly planted cuttings by chewing through the stem material before it can establish; moles can also damage roots underground, mainly by attacking the root ends and accelerating spoilage. On the disease side, Cassava Mosaic Disease and Cassava Brown Streak Disease are two of the most serious threats, since both are spread through infected planting material as well as insect vectors -- Cassava Mosaic causes pale, wrinkled, distorted leaves and stunted plants, while Cassava Brown Streak causes leaf yellowing, blackened stem bark, and (most damagingly) brown discolouration inside the storage roots themselves. Good management leans heavily on prevention: always start with disease-free cuttings from a clean source, favour resistant or tolerant varieties where they're available for your area, inspect your field regularly and remove (rogue out) any infected plants promptly, and plant early enough to avoid peak periods of the whitefly that spreads Cassava Mosaic Disease. If chemical control is genuinely needed for any pest or disease, use a product currently registered for cassava in Kenya, follow label instructions exactly, and get guidance from your county agricultural officer or a licensed agrovet.

## Crop Management

Beyond routine weeding and pest scouting, day-to-day cassava management is fairly low-input compared to many crops, which is part of its appeal for smallholders managing multiple enterprises. Where cassava is intercropped with maize or legumes, this combination has been shown to make better use of land, reduce soil erosion, and lower the risk of a total crop loss compared to growing cassava alone -- when intercropping with maize specifically, plant your cassava on top of the ridge and the maize to the side. Keep an eye on general plant vigour and canopy development through the season as an early warning sign of nutrient, water, or pest problems, since cassava doesn't always show obvious stress symptoms until a problem is fairly advanced.

## Root Development

Cassava's whole value lies underground, and unlike leafy or fruiting crops, there's no dramatic external flowering event to watch for -- the crop quietly builds its storage roots below the soil surface over many months while the visible plant simply grows taller and bushier. One useful external sign that the roots have matured is radial cracking of the soil around the base of the stem, which is a visible clue worth checking for as your expected harvest window approaches. Because good early establishment (proper land preparation, healthy cuttings, and adequate early-season moisture) so strongly influences root development, most of what determines a good harvest happens far earlier in the season than harvest time itself.

## Harvesting

Cassava's maturity period varies by variety, generally somewhere between 8 and 18 months after planting, so knowing your specific variety's typical timeline -- alongside watching for that radial soil cracking -- helps you judge when to harvest. Timing your harvest around having an actual buyer lined up matters more for cassava than for many crops, since fresh roots deteriorate quickly once out of the ground, so unharvested "insurance" stock isn't as forgiving here as it might be with grain crops. Harvesting can be done by hand using simple tools like a hoe, cutlass, mattock, or earth chisel, through semi-manual harvesters that use a lever action to reduce the physical effort of uprooting, or through fully mechanised harvesters on larger operations -- the right choice depends on your scale, soil type, and what equipment is accessible to you.

## Post-Harvest Handling

Fresh cassava roots start deteriorating rapidly once lifted from the ground, so how you handle them in the hours after harvest matters as much as how you grew them. A few practical steps genuinely help: cutting back the stems to a short stub around three weeks before you plan to harvest, lifting the roots with a short section of stem (roughly 2 to 5cm) still attached (which appears to slow the spread of decay into the root), and harvesting when the soil is moist, such as just after rain, to reduce physical damage during lifting. Handle roots gently and inspect them for injury before deciding to store any for more than a week, since damaged roots spoil fastest and can spread decay to healthy ones stored alongside them.

## Storage

Fresh cassava is notoriously hard to store for long because the roots deteriorate quickly, and traditional Kenyan practice reflects this: many farmers simply leave roots in the ground until needed, or process or consume them almost immediately after lifting rather than trying to hold onto fresh stock at all. Where farmers do need to hold roots briefly, simple traditional techniques include re-burying roots in trenches under plant material and soil, piling roots in heaps and keeping them moist with daily watering, coating them in a thick layer of soft clay or mud, or keeping smaller quantities submerged in water. A step up from these are simple improved low-cost options such as storing roots in boxes lined with moist sawdust or wood shavings, or in plastic bags or film wraps, which can meaningfully extend how long fresh roots stay usable without needing expensive infrastructure.

## Marketing

Cassava's real commercial strength is its versatility -- the same crop can be sold fresh, processed into food products, used as livestock feed, or supplied into industrial processing, which gives you more than one route to market if one channel is weak in a given season. Because fresh roots spoil so quickly, converting at least some of your harvest into a more stable form -- dried chips, flour, or starch, produced through peeling, chipping or grating, and drying -- can be a genuinely useful way to preserve value rather than being forced to sell everything fresh and fast. Organised marketing channels and basic processing know-how are what actually turn cassava from a subsistence food crop into a genuine commercial enterprise, so it's worth exploring local buyers, processors, or cooperative arrangements in your area rather than assuming fresh-root sale is your only option.

## Common Mistakes

The recurring mistakes in Kenyan cassava production are: planting cuttings from old, diseased, or poorly handled stems instead of clean material from healthy 10-to-12-month-old plants; neglecting weeding in the crucial first three months when the crop is most vulnerable to competition; choosing a variety without checking its disease resistance or maturity period against local conditions; and harvesting without a buyer or processing plan already in place, which given how fast fresh roots spoil can turn a good harvest into a wasted one very quickly. Planting on waterlogged land, land with a hardpan, or land with a fluctuating water table is another avoidable mistake, since these conditions directly work against the root development the whole crop depends on.

## Farm Business Considerations

Cassava's ability to produce something even from marginal, drought-prone land makes it a genuinely useful risk-management crop within a wider farm plan, not just a stand-alone enterprise. Because it can be sold fresh, processed, or used as feed, thinking through your intended market before you even plant -- rather than after harvest -- shapes decisions like which variety to choose (a sweet, low-cyanide variety for direct consumption versus one suited to industrial processing) and how much of your harvest to process versus sell fresh. Organised marketing channels and basic processing capacity, even at a small scale, are what separate a subsistence cassava plot from a genuinely commercial one, so it's worth investigating local cooperative, processor, or buyer arrangements as part of your planning rather than an afterthought.$c$,
  true
);
