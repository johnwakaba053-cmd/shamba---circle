-- Education 3.0, Phase 2: Shamba Space Crop School (batch 5 of 5, final).
--
-- Adds 2 new education_resources rows -- original Shamba Space guides
-- for Tea and Groundnuts -- same pattern as prior batches: existing
-- topic_id, category_id='crop-farming', resource_type='article',
-- origin='shamba_original', no rehosting, no schema change.
--
-- Tea's assigned KALRO source ("Common Diseases of Tea in Kenya") is
-- genuinely disease-only (2 pages), so this guide also draws on the Tea
-- Research Foundation of Kenya's "Tea Growers Handbook" and "Tea
-- Cultivation Manual for Good Agricultural Practices" (both verified,
-- byte-exact downloads from teaboard.or.ke) for site, planting, spacing
-- and pruning content; Post-Harvest Handling, Storage and Marketing
-- sections were omitted entirely for Tea since none of the three
-- verified sources cover farm-level handling beyond the factory gate.
-- Groundnuts' assigned FAO source is a Good Agricultural Practices
-- manual written for Myanmar's Central Dry Zone; its agronomic content
-- is used only as general good practice, explicitly not presented as
-- Kenya-specific, since no independently verifiable Kenya-specific
-- groundnut source could be found within this batch's research.

insert into public.education_resources
  (id, category_id, topic_id, learning_category, resource_type, origin, source_id, external_url, title, summary, content, is_published)
values

-- ============================================================
-- TEA
-- ============================================================
(
  'shamba-space-tea-guide', 'crop-farming', 'tea', null, 'article', 'shamba_original', null, null,
  'Growing Tea in Kenya: A Shamba Space Guide to Site Selection, Planting, Pruning and Common Pests and Diseases',
  $s$A practical guide to establishing and managing a tea bush in Kenya, covering site and planting decisions, spacing, pruning cycles, and the pests and diseases most likely to affect your bushes.$s$,
  $c$## Getting Started

Tea (Camellia sinensis) is a woody, evergreen perennial grown in Kenya's cool, high-altitude regions, harvested repeatedly through the year via regular "plucking" rounds once the bush is established. Unlike an annual crop, tea is a multi-decade commitment -- Kenyan tea research literature notes that a well-sited, well-managed bush can go on producing for up to 100 years or more. That long horizon is exactly why the early decisions matter so much: site selection, planting material, spacing, and how you shape the young bush in its first few years are all expensive and slow to correct later in a crop you can't simply replant next season. This guide draws on verified agronomic literature from Kenya's own tea research institutions to help you get those early decisions right, and to manage the bush wisely once it's producing.

## Choosing the Right Site

Altitude and rainfall matter more for tea than for most crops. Kenyan tea research guidance places suitable tea country at roughly 1,500 to 2,250 metres above sea level, with a minimum annual rainfall of around 1,200mm -- though how evenly that rain is spread through the year matters as much as the yearly total, since tea suffers badly through extended dry spells even in an otherwise wet year. Workable temperatures run roughly 13 to 30 degrees Celsius, but yields decline as altitude rises and temperatures cool. The soil itself needs to be deep (guidance calls for at least around 2 metres) and free-draining; avoid waterlogged ground, very steep slopes (gradients of 20 percent or more are discouraged), and land close to eucalyptus trees, whose roots compete strongly with tea for water -- a separation of at least 30 metres from eucalyptus is recommended. Given how long a tea planting lasts, it's well worth having a prospective site formally assessed, including a proper soil test, before you commit.

## Suitable Varieties

Kenya's tea is grown from three broad botanical types -- the Chinery type, the Assam type, and Assam-Cambod hybrids -- each with somewhat different growth habit and leaf character. Beyond these broad types, Kenya's tea research institute has released a large number of named clones (vegetatively propagated selections) bred for traits like yield, quality, drought tolerance, and pest or disease resistance. We weren't able to verify the specific performance characteristics of individual named clones from the material available to us, so rather than recommend particular clones by name, we'd encourage you to ask your county agricultural or tea extension officer for the current clonal catalogue and a recommendation matched to your altitude, soil, and rainfall.

## Quality Planting Material

Tea can be established from seed or, more commonly for modern plantings, from vegetatively propagated cuttings of a selected clone, which reproduce the mother bush's characteristics exactly. If using seed, viability testing matters: one accepted method soaks seed in water and sorts it by flotation, discarding seed still floating after about 72 hours as well as anything blackened, sticky, or showing fungal growth, since only reliably sinking seed germinates well. Cuttings need proper nursery care -- consistent moisture, partial shade, and time to fill their growing "sleeve" with roots -- before they're ready to move to the field; well-hardened plants are generally the ones with roots reaching the bottom of the sleeve and reasonable top growth. Whichever route you take, source planting material from a reputable nursery working with recognised clones, since poor planting material is very hard to correct later in a crop that stays in the ground for decades.

## Land Preparation

How you clear land for tea depends on what's growing there. Long grass can be cleared mechanically or by hand with pangas and jembes, short grass by ploughing and harrowing, and light bush with a rotovator; forest or heavily wooded land needs trees ring-barked or killed standing for at least around 18 months before felling, so roots die back rather than resprouting. If the land was previously under wattle trees, wait -- wattle stumps can harbour fungal diseases that also attack tea, so a gap of at least around three years after clearing wattle (with food crops like beans or potatoes grown in the meantime) is recommended before planting tea. On sloping ground, plough and rip across the slope rather than up and down it to control erosion, and finish preparation with at least two ploughing and harrowing passes to break up root clumps. This is also the stage to take soil samples and correct any drainage problems, since it's far easier to fix before bushes are in the ground.

## Planting

Line out and stake your rows before the rains, but leave the actual holing until just before planting -- ideally right after the first rain -- since holes left open too long either dry out or turn to mud, both of which harm establishment. The ideal moment to plant is when soil is damp rather than waterlogged, in cloudy rather than harsh sunny weather; aim to start once the soil is damp to at least a metre deep. When setting the plant, firm the soil in well and leave just one to two centimetres of the original nursery soil covered by field soil, since an exposed root-ball dries out quickly. Well-hardened nursery plants generally don't need extra field shading, but plants that weren't properly hardened off should get the same shade level they had in the nursery until established.

## Spacing

Kenyan tea guidance sets out several proven spacing options rather than a single number, because the right choice trades off establishment cost against how quickly bushes close canopy. Commonly used single-row spacings fall in a range including roughly 1.2m x 0.6m and 0.9m x 0.9m, giving populations of very roughly 10,000 to 14,000 bushes per hectare; double-hedge planting systems (two closely spaced rows grouped together) push population higher still. Closer spacing is specifically noted as producing earlier canopy closure, which helps control erosion on new plantings -- but it also costs more in planting material and management upfront. There's no single right answer here; discuss your options with a tea extension officer before ordering planting material and staking out your field.

## Soil and Nutrient Management

Tea prefers distinctly acidic soil, with guidance putting the ideal range at roughly pH 4.0 to 5.6 depending on the specific source (nursery soils are managed even more tightly, since cuttings generally won't root above about pH 5.5). If a soil test shows your land is more alkaline than this, soil amendments to acidify it exist, but getting the right one and rate is a job for your extension officer rather than guesswork. Established Kenyan guidance for mature tea nitrogen fertilizer sits in a broad range of roughly 150-200 kg of nitrogen per hectare per year, with lower rates for lower-yielding plantings and higher rates for higher-yielding ones -- but the right rate, formulation, and split for your specific spacing, clone, and soil test is something to work out with your tea extension officer or agrovet rather than apply blind. Well-rotted manure, applied once per pruning cycle and never mixed simultaneously with fertilizer, is a widely used supplement. Regular soil and leaf sampling (commonly done once per pruning cycle) is the standard way growers and their advisors track whether nutrition is on track.

## Water and Irrigation

Kenyan tea is mostly grown as a rainfed crop, with roughly 1,200mm of annual rainfall considered the practical minimum -- though even distribution through the year matters more than the yearly total, since prolonged dry spells hurt tea even in an otherwise adequate year. For a smallholder, mulching is the most practical drought buffer: a mulch layer of around 5cm using tea prunings, leaf litter, or suitable grasses, applied before the dry season sets in and left undisturbed once down, conserves soil moisture and moderates soil temperature. One caution: continuous, uninterrupted mulching over a long period is not recommended, since it can push roots to stay shallow rather than developing depth.

## Weed Management

For young tea, cover crops (such as oats, beans or potatoes grown between the rows) and mulch both help suppress weeds while the canopy is still open; shallow, careful cultivation only controls annual weeds and should generally be avoided since deeper cultivation damages tea's shallow root system. For mature tea, a combination of cultural and chemical methods, used together, is described as the most effective approach. If you do use a herbicide, use one currently registered for tea in Kenya, applied by a trained operator exactly per label instructions -- we've deliberately not named specific products here since registrations change. Whatever method you use, the key principle is timing: deal with weeds before they set seed or before perennial weeds' underground storage parts mature, since established weeds are far harder to control.

## Pruning and Canopy Management

Mature tea is managed around a flat, evenly spaced layer of harvestable shoots at the top of the bush called the "plucking table," built and maintained through a repeating cycle of pruning and plucking. A young bush goes through a formative period of "tipping" -- progressively removing the growing tip at increasing heights over several rounds -- to build this table, a process that takes roughly three years from field planting to the point where a bush is ready for full plucking. Once mature, bushes are pruned on a repeating multi-year cycle: an initial prune at roughly 45cm (18 inches), with each subsequent cycle raising the height by about 5cm (2 inches) until a practical maximum around 70cm (28 inches) is reached, at which point growers cut back down and start a new cycle. Two main pruning types exist: normal (cut-across) pruning, where the whole bush is cut level, and "lung" pruning, where a number of branches are deliberately left unpruned on one side to keep the bush photosynthesising through recovery. Timing and technique matter for bush health: prune when there's still adequate soil moisture, generally as the dry season begins (exact timing varies by region) and never right at the end of one; slope each cut so rainwater runs off rather than causing rot, and cover freshly pruned wood promptly if the weather is sunny, to prevent sun-scorch. A lighter operation called "skiffing" -- trimming just the top maintenance layer -- can flatten a bush that's grown domed from uneven plucking, or open up the canopy when pest pressure calls for it.

## Pests and Diseases

The clearest disease risks documented for Kenyan tea are Armillaria root rot (a soil fungus causing reduced growth, yellowing, premature flowering, and eventual death, with roots showing characteristic rot and a mushroom-like smell when uprooted), Hypoxylon wood rot (sectoral dieback strongly linked to poor or low pruning), grey and brown leaf blight (mainly a nursery problem, causing brown-to-grey lesions with concentric rings), root-knot nematodes (microscopic soil worms causing root galls, stunting and wilting that can look like a nutrient deficiency), and branch and collar canker (a fungus causing sectoral branch death and stem-girdling lesions). On the pest side, watch for mites (several species cause leaf browning, drying, and premature leaf fall, and are worse on dry, unshaded, or poorly fertilised tea), citrus aphids and scale insects clustering on young shoots and leaves, thrips (worse in dry weather, dying back naturally with the rains), Helopeltis (the tea mosquito bug, which sucks young shoots and can cause branch canker in severe cases), and termites (which attack recent plantings, girdling stems below the soil surface). Sensible first-line management applies across most of these: select resistant or tolerant clones where possible, keep pruning technique and timing correct (since poor pruning is repeatedly flagged as a disease risk factor), avoid both over- and under-fertilising (both are linked to greater disease susceptibility), and practise field sanitation by removing and burning affected material. If you do need to use a pesticide or fungicide, always choose a product currently registered for tea use in Kenya, follow the label instructions exactly, respect any pre-harvest interval before plucking again, and get guidance from your county agricultural officer or a licensed agrovet. We've deliberately not listed specific products or application rates here, since approvals and recommended rates change over time.

## Harvesting

Tea is picked to a "plucking standard" that describes how much leaf is removed: fine plucking takes one or two leaves and the bud, coarse plucking takes three or more; light plucking leaves new growth above the previous pick line, hard plucking takes shoots back down to it. "Two leaves and a bud" is the classic benchmark that balances quality and yield, while coarser plucking is noted as producing distinctly inferior quality tea. Hand plucking is described as producing better quality and healthier bushes over time than shears or plucking machines, though it demands more labour. We weren't able to verify a specific recommended plucking round length (the interval between successive picks) from the sources reviewed, so ask your factory or extension officer what round length suits your clone, elevation, and season.

## Common Mistakes

Several mistakes come up repeatedly in the source material: planting without a proper soil test or site assessment on a crop that will occupy the land for decades; planting too close to eucalyptus or other water-competing trees; planting into recently cleared wattle land without waiting out the recommended gap; incorrect or low pruning height and technique, which is specifically linked to wood-rot disease; applying fertilizer immediately after pruning or during heavy rain, both of which are explicitly discouraged; under- or over-fertilising, which several sources connect to greater pest and disease susceptibility; coarse or careless plucking, which lowers quality and stresses the bush; and continuous, uninterrupted mulching without a break, which can encourage shallow rooting.

## Farm Business Considerations

Tea is a genuinely long-horizon investment: a well-established bush can go on producing for up to 100 years, which means the costs and mistakes of the first few years echo for decades. It's worth budgeting properly for a real site assessment, soil test, and quality planting material rather than cutting corners early. Because the crop takes several years of formative tipping to build a proper plucking table before it settles into regular cropping, plan your household finances around a genuine multi-year establishment period rather than expecting early income. We haven't included price or yield figures in this guide since they change over time and by region -- talk to your tea factory and county agricultural office for current, area-specific numbers before making planting decisions.

For more detail on the diseases covered above -- including additional photographs and the specific causal organisms -- see KALRO Tea Research Institute's "Common Diseases of Tea in Kenya" brochure, the Go Deeper resource linked for this topic. For the wider agronomic picture, Kenya's Tea Research Foundation (now KALRO's Tea Research Institute) and the Tea Board of Kenya also publish detailed technical manuals on nursery practice, pruning, and field management in far more depth than fits here.$c$,
  true
),

-- ============================================================
-- GROUNDNUTS
-- ============================================================
(
  'shamba-space-groundnuts-guide', 'crop-farming', 'groundnuts', null, 'article', 'shamba_original', null, null,
  'Growing Groundnuts: A Shamba Space Guide to Planting, Pegging, Harvest and Aflatoxin-Safe Handling',
  $s$A practical guide to growing groundnuts from seed through harvest and storage, with particular attention to the underground "pegging" process and to drying and storage practices that reduce aflatoxin risk.$s$,
  $c$## Getting Started

Groundnuts (Arachis hypogaea), also called peanuts, are an annual legume grown from seed each season, valued both as food and, through their root nodules, for adding nitrogen back into the soil for crops that follow. Groundnut has an unusual growth habit: after the flower is pollinated above ground, a stalk called a "peg" grows downward and buries the developing pod in the soil, where it matures underground -- a habit called geocarpy. That underground pod development shapes many of the decisions in this guide, from the soil texture you choose to how carefully and when you weed. This guide is based on internationally recognised good agricultural practice for groundnut; because the detailed technical source behind much of it was written for a different growing region, we've been careful to present it as general good practice rather than Kenya-specific recommendations, and we flag wherever you should check locally relevant detail with your county agricultural office.

## Choosing the Right Site

Soil physical structure matters more for groundnut than for many crops, precisely because of that underground pod development. A well-drained, coarse-textured sandy loam or sandy clay loam is considered ideal: heavy clay makes it hard for pegs to penetrate, and high clay content in the topsoil can cause pegs to snap off at harvest, leaving pods behind in the ground. Good agricultural practice guidance puts ideal soil pH at around 6.5 to 7, and generally treats soils below pH 5.5, along with saline or sodic soils, as unsuitable. Because developing pods sit against and within the soil, it's also worth avoiding land with a history of industrial, hospital or hazardous-waste use, or land close to sewage or drainage lines. Beyond soil, groundnut needs warm growing conditions and moderate, reasonably well-distributed rainfall through the season -- very heavy, waterlogged, or extremely dry sites are all poor matches.

## Suitable Varieties

Groundnut varieties mainly differ in three ways that matter to a grower: growth habit (upright "bunch" types versus more spreading "runner" types), how long they take to mature, and their tolerance of drought or specific diseases. The detailed variety data behind our source material comes from outside Kenya, so we can't responsibly recommend specific named varieties here. What we can say with confidence is that using a certified variety recommended for your specific area, rather than uncertified saved seed of unknown origin, is consistently identified as good practice, since certified seed has a known germination rate and is far less likely to carry seed-borne disease. Ask your county agricultural office or KALRO which groundnut varieties are currently recommended for your growing area.

## Quality Planting Material / Seed

Seed quality has an outsized effect on a groundnut crop, since damaged or diseased seed germinates poorly and can introduce disease directly into the field. Good practice calls for seed with at least 80 percent germination and high physical purity, free of cracks, wrinkles, shrivelling or mould. It's best to shell seed only shortly before planting -- about two weeks ahead -- and to shell by hand rather than by machine, since mechanical shelling is more likely to crack or bruise the kernel; after shelling, sort out and discard any shrivelled, discoloured, undersized or damaged seed. If you're unsure whether a seed lot will germinate well, you can test a sample yourself: plant twenty or so seeds in a trench of moist soil, keep it damp, and count how many emerge over five to seven days as a rough guide to germination percentage.

## Land Preparation

Groundnut benefits from deep tillage, since the crop needs loose, workable soil for both root growth and peg penetration. Good practice recommends ploughing to a depth of around 25 to 30cm, followed by discing or harrowing to break up clods and leave a level, friable seedbed; working well-rotted farmyard manure into the soil at this stage is a widely recommended way to build organic matter and structure ahead of planting. On sloping land, plough across the slope rather than up and down it to reduce erosion, and in rainfed areas, aim to plough ahead of the rains so the soil retains moisture for germination and early root establishment.

## Planting

Groundnut is typically sown once there's reliably enough soil moisture for germination -- for a rainfed crop, that generally means waiting until the rains have properly set in rather than planting into dry or marginal soil. Seed should go in shallow, since planting too deep delays emergence and weakens early root and nodule development; seed rate needs adjusting upward if germination is below the 80 percent standard, if soil is compacted, or if conditions are otherwise less than ideal. If you're planting into land that hasn't grown groundnut or another legume recently, treating seed with the correct rhizobium inoculant just before sowing is well worth doing, since it kick-starts the nitrogen-fixing partnership in the root nodules that groundnut relies on for much of its nitrogen supply. A few details matter for the inoculant to work: use one made specifically for groundnut (not one meant for soybean or other legumes), keep it cool and out of direct sun before use, check that it hasn't expired, and sow within about six hours of treating the seed so the bacteria don't die before reaching the soil.

## Spacing

Exact spacing depends heavily on whether your variety has an upright, bunched growth habit or spreads more widely, and we weren't able to verify spacing figures specific to Kenyan conditions or varieties. As a general principle, upright bunch types are usually planted closer together than spreading types, since they take up less lateral space; whatever variety you use, getting the plant population right matters, since low plant populations are a commonly cited reason for disappointing yields. Ask your county agricultural office or seed supplier for a spacing recommendation matched to the specific variety you're planting.

## Soil and Nutrient Management

Groundnut gets a substantial share of its nitrogen "for free," fixing it from the air via its root-nodule bacteria rather than relying only on soil or fertilizer nitrogen -- one reason it's often grown in rotation with cereals. That said, the crop is genuinely demanding of a few other nutrients: calcium is particularly important, since a shortage shows up directly as poorer pod filling and a lower shelling percentage (the share of pod weight that's actually kernel); potassium supports peg formation and pod filling; and phosphorus is important for root growth and flowering. A shortage of any of these tends to show up first as poor growth, pale or discoloured leaves, or reduced pod set, rather than being obvious at a glance. Because exact fertilizer types and rates depend heavily on your specific soil's nutrient status, we're not giving specific rates here -- a soil test and a recommendation from a qualified extension officer or agrovet is the reliable way to get this right, rather than applying a generic blend and hoping.

## Water and Irrigation

Groundnut is relatively drought-tolerant compared with many crops, but it still has genuinely critical periods when a water shortage does real damage: germination and early emergence, flowering, peg formation (when the fertilised peg needs to penetrate soft, moist soil), and pod filling. Moisture stress at these stages doesn't just reduce yield -- it also raises the risk of the fungus responsible for aflatoxin contamination infecting the pods, so water management is a food-safety issue as much as a yield one. Where irrigation is available, timing applications around these critical stages matters more than watering on a fixed schedule; where it isn't, practices like inter-row mulching and simple water-harvesting structures (small trenches or tied ridges that capture rainfall in the field) can meaningfully extend the moisture available through a dry spell.

## Weed Management

Weed control in groundnut has an unusual urgency: leaving it too late doesn't just cost yield to competition, it can physically expose or damage pegs that have already started pushing into the soil, since disturbing established weeds disturbs the ground right where the crop is forming pods. Good practice guidance points to getting weeding done early -- within the first month after sowing is a commonly cited target -- and finishing weeding before applying any fertiliser, so the crop rather than the weeds gets the benefit of the nutrients. Once pegging is well underway, avoid further deep cultivation between the rows and rely on careful hand-pulling for any remaining weeds instead.

## Pests and Diseases

The clearest pest risk in the good agricultural practice guidance we reviewed is termites, which can attack developing pods underground and create wounds that make it easier for the aflatoxin-causing fungus to get in -- so termite control is as much a food-safety measure as a yield-protection one. On the disease side, leaf spot is a recognised problem in groundnut generally, which is part of why some improved varieties are specifically bred for leaf spot resistance -- worth asking about when choosing a variety for your area. Because groundnut is a legume, avoiding repeated groundnut-on-groundnut planting and practising crop rotation is a genuinely effective way to reduce insect pest and fungal disease build-up in your soil over time. If you do need to control a pest or disease chemically, use a product currently registered for groundnut use in Kenya, follow label instructions precisely, and get guidance from your county agricultural officer or a licensed agrovet -- we haven't named specific products or rates here since registrations and recommendations change.

## Pod Development

Groundnut's underground fruiting habit, known as pegging, is worth understanding on its own, since it explains several of the practices elsewhere in this guide. After the flower (which appears above ground, close to the soil surface) is pollinated, the base of the ovary elongates into a stalk-like structure -- the peg -- which grows downward and buries its tip, carrying the developing seed, into the soil. Once underground, that buried tip swells and develops into the mature pod. Because this whole process happens right at and just below the soil surface, anything that disturbs that zone at the wrong time -- late or careless weeding, soil compaction, or waterlogging -- can physically damage pegs and pods or prevent pegs from penetrating the soil at all, which is why loose, workable soil and carefully timed field operations matter so much for this crop specifically.

## Harvesting

Timing is everything at harvest: pulling the crop too early sacrifices yield, oil content and flavour, while leaving it too long past maturity increases the risk of aflatoxin-producing fungus getting into the pods and, in wet conditions, can even let mature pods sprout in the ground. A widely used rule of thumb is to harvest once roughly three-quarters of pods on sample plants show mature markings: pods with a fresh white interior are still immature, while a darkening to brown or black inside the shell signals maturity. Harvest by hand-pulling in soft, moist, well-drained soil, or with a hoe or ox-drawn plough on heavier or drier ground, taking care in either case not to cut, bruise or crush the pods, since any wound is a point where fungus can enter. Where possible, harvest at the cooler part of the day, avoid harvesting in the rain, and move plucked plants off bare soil promptly rather than leaving them in contact with the ground.

## Post-Harvest Handling

Good post-harvest handling for groundnut is really about one thing above all: getting moisture down safely and quickly, because damp pods are exactly the conditions the aflatoxin-causing fungus needs to grow. Freshly dug pods carry a great deal of water -- commonly on the order of a third to well over half of their weight -- and need to be dried, in the sun or otherwise, until firm and safely storable; drying on a clean tarpaulin, mat, or raised surface rather than directly on bare soil is consistently recommended, since bare-ground drying both slows drying and invites soil-borne contamination. Once dry, thresh and winnow on a clean, hard surface (never inside sacks, which bruises the pods), and sort out any damaged, discoloured, shrivelled or mouldy pods before they go anywhere near your clean produce, since a small number of contaminated pods can spoil an entire batch. Hand shelling is gentler on the kernel than mechanical shelling and is the more practical option on a smaller farm; whichever method you use, avoid wetting pods to make shelling easier, since that reintroduces the very moisture you worked to remove.

## Storage

Store groundnut only once it's properly dry, and only in a clean, dry, well-ventilated space -- damp storage conditions are one of the most commonly cited causes of after-the-fact aflatoxin contamination. Keep the store rodent- and pest-proof, don't mix newly harvested produce with old stock still in store, and never reuse sacks or containers that previously held chemicals or other contaminating substances. It's generally recommended to store groundnut in the shell (pod form) rather than as shelled kernels wherever practical, since the shell offers the kernel some physical protection. This is a genuine food-safety issue, not just a quality one: aflatoxins are a recognised health hazard linked to liver damage, and produce that's visibly mouldy, badly discoloured or damaged should be set aside -- never consumed or fed to animals.

## Marketing

We haven't included specific price, demand, or market-channel figures in this guide, since these vary by season, region and buyer, and go out of date quickly. What we can say in general terms is that groundnut quality at the point of sale -- clean, well-dried, well-sorted, undamaged pods free of visible mould -- genuinely affects marketability, since buyers supplying food markets are increasingly conscious of aflatoxin risk in groundnut specifically. Keeping clean, well-graded produce, and being able to show it was dried and stored properly, is likely to serve you better with buyers than a mixed, poorly sorted batch, even before price enters the conversation. For current, area-specific market information, your county agricultural office or a local farmer cooperative is a far better source than any figure we could print here.

## Common Mistakes

Some mistakes come up repeatedly in good agricultural practice guidance: planting on heavy clay or poorly drained soil, which makes pegging and harvest difficult and increases pod losses; using uncertified, saved seed of unknown germination and health status; skipping or mistiming rhizobium inoculation and missing out on much of the crop's natural nitrogen supply; weeding late, after pegging is well underway, which can physically expose or damage developing pods; harvesting by guesswork rather than checking pod maturity, especially harvesting too early or leaving the crop in wet soil too long; drying pods on bare ground instead of a clean raised surface or tarpaulin; wetting pods to ease shelling, or storing them damp, both of which significantly raise aflatoxin risk; and mixing damaged, diseased or discoloured pods in with clean produce at any stage from harvest through storage.

## Farm Business Considerations

Groundnut is a relatively fast-turnaround crop compared with tree or perennial crops, since it's planted and harvested within a single season, making it easier to adjust your approach season to season based on what worked. Because so much of the crop's value and safety rests on post-harvest handling -- drying, sorting, and storage -- it's worth treating those steps as seriously as the growing itself rather than as an afterthought once the crop is out of the ground; poor drying or storage can turn a good harvest into unsellable or unsafe produce. We haven't included price or yield figures in this guide because they vary too much by season and location to be reliable here -- talk to your county agricultural office, a local cooperative, or other groundnut farmers in your area for realistic, current expectations before you plan your season around this crop.

For much more technical depth on any of the topics above -- including detailed fertilizer and micronutrient guidance, extensive coverage of aflatoxin biology and management, and step-by-step post-harvest guidance -- see the FAO's "Good Agricultural Practices (GAP) - Groundnut" manual, the Go Deeper resource linked for this topic. Just remember, as noted throughout this guide, that document was written for a different growing region (Myanmar's Central Dry Zone), so treat its detailed agronomic guidance as a strong technical foundation rather than a Kenya-specific rulebook, and check anything Kenya-specific -- particularly which varieties are recommended and what exact rates to apply -- with your county agricultural office or KALRO.$c$,
  true
);
