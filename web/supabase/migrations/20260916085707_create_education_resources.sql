-- Agricultural Education & Resources foundation.
--
-- education_categories mirrors communities: a small, rarely-changing
-- text-slug lookup table, read-only from the app. education_resources
-- mirrors posts' "belongs to a parent via FK" shape, but content is
-- platform-curated (seeded here), not user-authored -- there is no
-- author/profile_id column and no author-display-name trigger, since
-- there is no per-resource user author in this stage.
create table public.education_categories (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.education_categories enable row level security;

create policy "Authenticated users can view education categories"
on public.education_categories
for select
to authenticated
using (true);

-- is_published exists so a future admin/content-manager tool can add
-- draft rows without them being publicly visible -- not exercised by
-- this stage (every seeded row below is published), but the RLS
-- policy is already written against it so that future capability
-- doesn't require a security-relevant migration later.
create table public.education_resources (
  id text primary key,
  category_id text not null references public.education_categories (id),
  title text not null check (char_length(title) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 500),
  content text not null check (char_length(content) >= 1),
  source_name text,
  source_url text,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index education_resources_category_id_idx on public.education_resources (category_id);
create index education_resources_published_at_idx on public.education_resources (published_at desc);

alter table public.education_resources enable row level security;

-- Read access is scoped to published content only. There is
-- deliberately no INSERT/UPDATE/DELETE policy for any role -- content
-- management is out of scope for this stage and is seeded through
-- migrations instead, so "no policy" correctly means "no one can
-- write to this table from the app," not an oversight.
create policy "Authenticated users can view published education resources"
on public.education_resources
for select
to authenticated
using (is_published = true);

insert into public.education_categories (id, name) values
  ('crop-farming', 'Crop Farming'),
  ('livestock', 'Livestock'),
  ('poultry', 'Poultry'),
  ('soil-fertility', 'Soil & Fertility'),
  ('pest-disease', 'Pest & Disease Management'),
  ('farm-business', 'Farm Business'),
  ('agri-insurance', 'Agricultural Insurance'),
  ('climate-weather', 'Climate & Weather'),
  ('post-harvest', 'Post-Harvest'),
  ('general-farming', 'General Farming');

insert into public.education_resources
  (id, category_id, title, summary, content, source_name, source_url)
values
(
  'maize-production-basics',
  'crop-farming',
  'Maize Production Basics',
  'The core stages of growing maize, from land preparation to harvest, and the factors that most affect yield.',
  'Maize does best on well-drained soil with a near-neutral pH, planted after the soil has warmed and early-season rains have stabilised. Land preparation that breaks up compacted soil and clears old crop residue gives seedlings an even start.

Spacing and planting depth affect yield more than many farmers expect: crowded rows compete for light, water and nutrients, while seed placed too shallow or too deep germinates unevenly. Local extension guidance usually gives spacing and seed-rate recommendations suited to the specific maize variety and rainfall pattern in your area, so treat generic spacing figures as a starting point, not a fixed rule.

Maize has a few nutrient-hungry growth stages, particularly around knee-high growth and tasseling, when nitrogen shortages show up as pale, stunted plants. Weeding during the first six to eight weeks matters more than later weeding, since early competition from weeds has the largest effect on final yield.

Because maize varieties, planting windows and pest pressure vary a great deal by region and season, pair general guidance like this with advice from your local agricultural extension office or a trusted agro-dealer before making input decisions.',
  'Shamba Circle Editorial Team',
  null
),
(
  'vegetable-production-basics',
  'crop-farming',
  'Vegetable Production Basics',
  'General principles for growing healthy vegetables: soil preparation, watering consistency, spacing and rotation.',
  'Most vegetable crops share a few common needs: loose, well-drained soil rich in organic matter, consistent moisture (not waterlogged, not drought-stressed), and enough spacing for airflow between plants to reduce disease pressure.

Irregular watering is one of the most common causes of poor vegetable quality -- cracked tomatoes, bitter cucumbers, or bolting leafy greens can often be traced back to alternating dry and wet spells rather than pests or soil fertility. A consistent watering schedule, adjusted for rainfall, is usually more valuable than a large one-time watering.

Rotating vegetable families across seasons (rather than planting the same family in the same bed repeatedly) reduces the build-up of soil-borne pests and diseases specific to that family. Mixing in legumes as part of a rotation can also help replenish soil nitrogen.

Vegetable varieties differ widely in their climate, spacing and nutrient needs, so this guide should be treated as general orientation. Ask your local agricultural extension office which varieties are recommended for your specific area and season.',
  'Shamba Circle Editorial Team',
  null
),
(
  'basic-cattle-management',
  'livestock',
  'Basic Cattle Management',
  'Foundational practices for keeping cattle healthy and productive: shelter, water, nutrition and routine health checks.',
  'Cattle need reliable access to clean water, adequate shelter from extreme sun and rain, and enough grazing or feed to meet their energy needs, which rise sharply during growth, pregnancy and lactation.

A simple daily routine -- checking for lameness, unusual behaviour, reduced appetite or signs of illness -- catches most problems early, when they are cheapest and easiest to treat. Keeping a basic health record per animal (vaccinations, deworming dates, any treatments) makes it much easier to spot patterns and advise a vet quickly when something changes.

Herd health also depends on preventing disease spread: quarantining new animals before mixing them with an existing herd, and maintaining clean housing and water points, reduces the risk of introducing illness.

Specific vaccination schedules, deworming products and feeding rations vary by region, breed and local disease pressure. Work with a local veterinarian or livestock extension officer to tailor a health and feeding plan to your specific herd.',
  'Shamba Circle Editorial Team',
  null
),
(
  'basic-dairy-feeding-principles',
  'livestock',
  'Basic Dairy Feeding Principles',
  'How feeding quality and consistency affect milk yield, and the basic building blocks of a dairy feeding plan.',
  'Milk production is highly sensitive to feed quality and consistency. A dairy cow needs a diet that balances energy, protein, fibre, minerals and clean water -- and needs it delivered on a steady schedule, since abrupt changes in diet can reduce yield and upset digestion.

Good quality forage (fresh pasture, hay or silage) is typically the foundation of a dairy diet, with concentrate feeds used to fill any energy or protein gap that forage alone cannot meet, especially during peak lactation.

Mineral and vitamin supplementation matters more for dairy cattle than for many other livestock, since lactation draws heavily on the animal''s mineral reserves. Deficiencies often show up gradually, as reduced yield or fertility problems, rather than as an obvious sudden illness.

Exact feeding ratios depend on the breed, stage of lactation, forage quality and locally available feed ingredients. A local livestock extension officer or dairy cooperative can help design a feeding plan suited to your specific herd and available resources.',
  'Shamba Circle Editorial Team',
  null
),
(
  'poultry-farming-basics',
  'poultry',
  'Poultry Farming Basics',
  'The essentials of starting and running a small poultry flock: housing, feeding, and basic biosecurity.',
  'Poultry housing needs to protect birds from predators and extreme weather, while allowing enough ventilation to prevent the build-up of ammonia and moisture, which are major contributors to respiratory disease in flocks.

A balanced commercial or home-mixed ration appropriate to the bird''s age and purpose (layers, broilers, or dual-purpose) is central to good growth and egg production. Clean water should always be available -- birds that go without water for even a few hours can show a lasting drop in performance.

Biosecurity is often under-appreciated in small flocks: limiting visitor access, cleaning equipment between batches, and isolating sick birds quickly can prevent a single illness from becoming a flock-wide outbreak.

Breed choice, feeding programmes and vaccination schedules vary by production goal and region. A local poultry extension officer or reputable hatchery can advise on the right combination for your setup.',
  'Shamba Circle Editorial Team',
  null
),
(
  'backyard-chicken-health-essentials',
  'poultry',
  'Backyard Chicken Health Essentials',
  'Simple daily and weekly habits that catch poultry health problems early, before they spread through a flock.',
  'A quick daily check of the flock -- watching how birds move, eat and interact -- is often enough to spot the earliest signs of illness: a hunched posture, ruffled feathers, reduced feed or water intake, or a bird isolating itself from the group.

Keeping housing dry and regularly cleaned reduces the parasite and bacterial load birds are exposed to. Damp litter is one of the most common contributors to both respiratory disease and foot problems in backyard flocks.

New birds should be kept separate from the existing flock for a period before mixing, since apparently healthy birds can still be carrying and spreading disease.

If you notice sudden deaths, a sharp drop in egg production, or multiple birds showing symptoms at once, contact a local veterinary or livestock extension officer promptly -- some poultry diseases spread quickly and are easier to manage the earlier they are identified.',
  'Shamba Circle Editorial Team',
  null
),
(
  'soil-fertility-fundamentals',
  'soil-fertility',
  'Soil Fertility Fundamentals',
  'What soil fertility actually means, why testing matters, and the basic nutrients every crop depends on.',
  'Soil fertility is more than just "good soil" -- it is the combination of physical structure (how well roots, water and air move through it), chemical balance (nutrient availability and pH), and biological activity (organisms that cycle nutrients and build soil structure).

The three nutrients most commonly limiting crop growth are nitrogen, phosphorus and potassium, but micronutrient deficiencies and poor soil pH can just as easily limit yield even when the "big three" are adequate. This is why a soil test, where available, is far more reliable than guessing at fertility problems from plant symptoms alone.

Soil pH affects how available nutrients actually are to plants, regardless of how much fertilizer is applied -- very acidic or very alkaline soils can lock up nutrients that are technically present in the soil.

Because soil fertility issues are specific to each plot of land, a soil test through a local agricultural office or lab is the most reliable way to know what your soil actually needs, rather than applying fertilizer based on general assumptions.',
  'Shamba Circle Editorial Team',
  null
),
(
  'compost-and-manure-basics',
  'soil-fertility',
  'Compost and Manure Basics',
  'How composting and well-managed manure improve soil over time, and the basics of doing it safely.',
  'Compost and well-rotted manure improve soil structure, water retention and nutrient availability in ways that mineral fertilizer alone does not -- they feed the soil''s biological activity, not just the crop directly.

A basic compost pile needs a mix of "green" material (fresh plant waste, manure) for nitrogen and "brown" material (dry leaves, straw) for carbon, kept moist but not waterlogged, and turned occasionally to supply oxygen to the composting process.

Fresh manure should generally be composted or aged before applying it directly to food crops, since fresh manure can carry pathogens and its nutrients are not yet in a form most plants can use efficiently. Applying it too close to harvest is a food-safety risk worth taking seriously.

Composting times, ratios and manure-aging periods vary with climate and material available. If you are new to composting, a local agricultural extension office can offer guidance suited to your conditions.',
  'Shamba Circle Editorial Team',
  null
),
(
  'integrated-pest-management-basics',
  'pest-disease',
  'Integrated Pest Management Basics',
  'A practical introduction to managing pests using a combination of methods, rather than relying on one tool alone.',
  'Integrated Pest Management (IPM) is an approach that combines several tactics -- monitoring, prevention, biological control, cultural practices and, where needed, targeted chemical control -- rather than relying on a single method to manage pests.

Regular monitoring is the foundation of IPM: checking crops for pest presence and damage levels helps you decide whether action is actually needed, instead of applying treatment on a fixed schedule regardless of real pest pressure.

Cultural practices -- crop rotation, removing infested plant material, choosing resistant varieties where available, and maintaining healthy soil -- often reduce pest problems before they start, and are usually cheaper and lower-risk than chemical control.

When chemical control is genuinely needed, using the right product, at the right rate, at the right time, and following label instructions and safety precautions, protects both the crop and the person applying it. Overuse of a single product also encourages pests to develop resistance over time.

Specific pests, thresholds and recommended products vary by crop and region. A local agricultural extension officer can help identify pests accurately and recommend an appropriate response.',
  'Food and Agriculture Organization of the United Nations (FAO)',
  'https://www.fao.org'
),
(
  'early-disease-identification',
  'pest-disease',
  'Why Early Disease Identification Matters',
  'How catching crop or livestock disease early changes the outcome, and simple habits that support early detection.',
  'Most crop and livestock diseases are far easier -- and cheaper -- to manage when caught early, before they spread through a field or a herd/flock. Waiting until symptoms are severe often means the available options are more limited and more costly.

For crops, this means walking fields regularly rather than only when a problem is already obvious, and looking closely at leaves, stems and fruit for early signs like discoloration, spotting, wilting or stunted growth, especially after periods of humid or wet weather that favour disease development.

For livestock, this means observing normal behaviour closely enough to notice small changes -- appetite, movement, social behaviour -- since animals often show subtle signs before an illness becomes obvious or severe.

If you are unsure what you are seeing, it is worth getting a second opinion quickly from an extension officer, veterinarian or experienced neighbouring farmer rather than waiting to see if the problem resolves on its own. Misidentifying a disease and treating for the wrong problem can waste time and money while the real issue continues to spread.',
  'Shamba Circle Editorial Team',
  null
),
(
  'farm-record-keeping',
  'farm-business',
  'Farm Record Keeping',
  'Why simple, consistent records make a real difference to farm decisions, and what is worth tracking first.',
  'Good record keeping does not need to be complicated to be useful. Tracking a small set of numbers consistently -- what you planted or stocked, what you spent, what you harvested or sold, and when -- gives you the basis for almost every other farm business decision.

Records let you compare seasons or batches honestly, instead of relying on memory, which tends to remember the best and worst years more vividly than the typical ones. Over time, this makes it much easier to see which practices, inputs or varieties are actually paying off.

Records are also often required, or at least very helpful, when applying for credit, insurance, or support programmes, since they give a lender or insurer evidence of how the farm actually performs rather than just a verbal description.

A notebook, a simple spreadsheet, or a basic farm record app are all valid starting points -- the format matters far less than actually keeping the habit consistent, season after season.',
  'Shamba Circle Editorial Team',
  null
),
(
  'basic-farm-budgeting',
  'farm-business',
  'Basic Farm Budgeting',
  'A simple approach to planning farm income and costs before the season starts, not just tracking them afterward.',
  'A basic farm budget estimates expected costs (seed, inputs, labour, equipment, transport) and expected income (based on realistic yield and price assumptions) before the season begins, so you can judge whether a plan is likely to be viable before committing money to it.

Separating costs into fixed costs (that do not change much with how much you produce, like land rent or equipment) and variable costs (that scale with production, like seed and fertilizer) helps you understand how sensitive your profit is to a change in yield or price.

It is worth budgeting with a deliberately cautious yield and price estimate, rather than a best-case scenario, since unexpected weather, pests or market price drops are common, not rare. A budget that only works in the best case is a fragile plan.

Comparing your budget to your actual results at the end of the season (using the records described in farm record keeping) is what turns budgeting into a genuinely useful planning tool over time, rather than a one-off exercise.',
  'Shamba Circle Editorial Team',
  null
),
(
  'why-agricultural-insurance-matters',
  'agri-insurance',
  'Why Agricultural Insurance Matters',
  'What agricultural insurance is, and why farmers in unpredictable climates often consider it as part of managing risk.',
  'Farming is exposed to risks that are often outside a farmer''s control: drought, floods, pest outbreaks, disease, and price swings can all significantly affect a season''s outcome even when everything was managed well. Agricultural insurance is a way of transferring some of that risk: in exchange for a premium, an insurer agrees to pay out under specific, pre-agreed conditions if a covered loss occurs.

Agricultural insurance is not a substitute for good farm management -- it is a financial tool that can help a farm survive a genuinely bad season (severe drought, a major disease outbreak) without losing the ability to plant again next season. This is often described as protecting a farm''s resilience, not its profit.

There are different models of agricultural insurance, including traditional indemnity-based cover (which pays out based on an assessed loss) and index-based cover (which pays out based on a measured trigger, like rainfall levels, rather than an individual farm assessment). Each has different trade-offs in cost, speed of payout, and how closely it matches an individual farm''s actual experience.

This is general education, not a product offer. Shamba Circle does not currently provide agricultural insurance directly -- this content is intended to help farmers understand the concept so they can evaluate real offers from licensed insurers more confidently.',
  'Shamba Circle Editorial Team',
  null
),
(
  'common-agricultural-risks',
  'agri-insurance',
  'Common Agricultural Risks',
  'The main categories of risk that affect farms, and why understanding them helps you evaluate what insurance actually covers.',
  'Weather-related risks -- drought, excess rainfall, floods, hailstorms, and extreme temperatures -- are among the most significant and most commonly insured agricultural risks, because they can affect an entire region at once and are largely outside any individual farmer''s control.

Biological risks include pest outbreaks, plant diseases, and livestock disease, which can cause serious loss even in a season with otherwise good weather. Some insurance products cover specific named diseases or pest events; many do not cover gradual, low-level pest or disease pressure that a farmer could reasonably have managed.

Market risks -- a sharp drop in the price a farmer receives at harvest or sale time -- are a real source of income loss but are covered by a different category of financial product (such as price or revenue insurance) than most weather- or disease-focused agricultural insurance.

Operational risks, like theft, fire, or equipment failure, are sometimes covered under general farm insurance policies rather than agricultural/crop-specific policies. Understanding which category of risk a given policy actually addresses is one of the most important things to check before assuming you are covered for a particular kind of loss.',
  'Shamba Circle Editorial Team',
  null
),
(
  'questions-before-buying-agricultural-insurance',
  'agri-insurance',
  'What to Consider Before Buying Agricultural Insurance',
  'Practical questions to ask an insurer, and why reading the exclusions matters as much as reading the coverage.',
  'Before purchasing any agricultural insurance policy, it is worth asking the insurer directly: exactly what perils are covered, how a loss is assessed or triggered, how long payouts typically take, and what the policy explicitly excludes. The exclusions are often just as important as the coverage -- a policy that sounds broad in its marketing can still exclude the specific type of loss you are most exposed to.

For index-based policies (which pay out based on a measured trigger like rainfall, rather than an assessment of your specific farm), it is worth understanding how closely the index is expected to match your actual experience. A rainfall station some distance from your farm may record different conditions than what you actually experienced, which affects whether a real loss triggers a real payout.

It is reasonable to ask about the insurer''s claims process before you buy, not after you need to file one: what documentation is required, how a loss is verified, and how long the process typically takes in practice. A policy is only as useful as the claims process behind it.

Finally, only work with licensed, verifiable insurers, and be cautious of any offer that seems to guarantee payouts regardless of loss, pressures you to decide quickly, or is difficult to verify independently. This article is educational information, not financial or insurance advice, and Shamba Circle does not currently sell or underwrite insurance -- always confirm terms directly with a licensed insurer before purchasing a policy.',
  'Shamba Circle Editorial Team',
  null
),
(
  'climate-smart-farming-practices',
  'climate-weather',
  'Basic Climate-Smart Farming Practices',
  'An introduction to farming practices that help manage a changing and more unpredictable climate.',
  'Climate-smart farming is broadly about three goals at once: maintaining or improving productivity, building resilience to climate shocks like drought or erratic rainfall, and reducing practices that make climate conditions worse over time.

Practices like mulching, cover cropping, and reduced tillage help soil retain moisture and organic matter, which makes crops more resilient during dry spells and reduces erosion during heavy rain -- both increasingly common as rainfall patterns become less predictable.

Diversifying what is grown or raised -- rather than depending entirely on a single crop or livestock type -- spreads risk across a season, since different crops and animals respond differently to a given weather event. This does not remove risk but reduces the chance that one bad season wipes out an entire farm''s income.

Because climate patterns, growing seasons and appropriate crop choices vary significantly by region, local agricultural extension services are usually the most reliable source for which specific climate-smart practices suit your area.',
  'Shamba Circle Editorial Team',
  null
),
(
  'water-conservation-on-the-farm',
  'climate-weather',
  'Water Conservation on the Farm',
  'Practical ways to make the most of available water, especially in areas where rainfall is limited or unpredictable.',
  'Mulching around crops reduces evaporation from the soil surface, keeping moisture available to roots for longer after rainfall or irrigation, and has the added benefit of suppressing weeds that would otherwise compete for the same water.

Timing irrigation for early morning or evening, rather than the heat of the day, reduces water lost to evaporation before it reaches plant roots. Watering deeply but less frequently, rather than shallow and often, also encourages roots to grow deeper in search of moisture, which improves drought tolerance over time.

Simple water harvesting -- directing roof or surface runoff into a storage tank or a water pan -- can provide a valuable buffer during dry spells, particularly for kitchen gardens or livestock water needs where the volumes required are manageable.

Soil health and water conservation are closely linked: soil with good organic matter content holds significantly more water than compacted or depleted soil, which is one of the reasons compost and reduced tillage (covered in the soil fertility and climate-smart farming articles) are often recommended together with water conservation.',
  'Shamba Circle Editorial Team',
  null
),
(
  'reducing-post-harvest-losses',
  'post-harvest',
  'Reducing Post-Harvest Losses',
  'Why a significant share of harvested produce is lost after harvest, and the main points where losses can be reduced.',
  'A large share of agricultural loss happens after harvest, not before it -- through spoilage, pests, poor handling, and inadequate storage -- meaning that protecting a harvest is often as important as growing it well in the first place.

Harvesting at the right maturity stage and handling produce gently during and after harvest reduces bruising and damage that speeds up spoilage, particularly for fruits and vegetables. Sorting out damaged or diseased produce before storage prevents it from accelerating spoilage in the rest of the batch.

Fast, appropriate drying (for grains) or cooling (for perishables) soon after harvest is one of the highest-impact steps in reducing losses, since both pests and spoilage organisms thrive in warm, moist conditions.

The specific post-harvest risks and best practices differ significantly between grains, root crops, fruits and vegetables. Local agricultural extension resources can offer guidance tailored to the specific crop and storage conditions you are working with.',
  'Food and Agriculture Organization of the United Nations (FAO)',
  'https://www.fao.org'
),
(
  'safe-grain-storage-fundamentals',
  'post-harvest',
  'Safe Storage Fundamentals',
  'The basics of storing harvested produce safely, with a focus on grain, to protect both quality and food safety.',
  'Grain must be dried to a safe moisture level before storage -- grain stored too moist is highly vulnerable to mould growth, some of which can produce toxins that make the grain unsafe to eat or sell, not just lower quality.

Storage containers and structures should be clean, pest-free, and protected from moisture before grain goes in. Reusing old sacks or containers without cleaning them first can reintroduce the very pests or mould you are trying to avoid.

Regularly inspecting stored produce for signs of pests, mould, or moisture allows problems to be caught and addressed before they spread through an entire store. Where hermetic (airtight) storage bags or containers are available, they can significantly reduce insect damage compared to traditional open storage.

Safe moisture levels and storage durations vary by crop and local climate. If you are unsure whether your grain is dry enough for safe storage, a local extension office can often help verify this before you commit to long-term storage.',
  'Shamba Circle Editorial Team',
  null
),
(
  'planning-your-farming-season',
  'general-farming',
  'Planning Your Farming Season',
  'A simple framework for thinking through a season before it starts, useful across almost any type of farming.',
  'A season plan does not need to be elaborate to be useful. At a minimum, it helps to have a rough answer to a few questions before the season starts: what will you plant or raise, how much land or resources will it need, what inputs and labour will it require, and what is a realistic, cautious estimate of what you will harvest or produce.

Thinking through timing matters as much as thinking through what to grow: planting or restocking windows, expected rainfall or dry periods, and key labour-intensive moments (planting, weeding, harvest) are easier to manage well when planned for in advance rather than reacted to as they arrive.

It also helps to plan with some flexibility built in -- a backup plan for a delayed rainy season, or a lower-cost fallback if input prices rise -- rather than a single rigid plan that only works if everything goes exactly as expected.

Reviewing how the previous season actually went (see farm record keeping) is one of the most useful inputs into planning the next one, since it replaces guesswork with your own real experience.',
  'Shamba Circle Editorial Team',
  null
),
(
  'farm-safety-basics',
  'general-farming',
  'Basic Farm Safety Practices',
  'Simple, practical safety habits that reduce the most common causes of injury on small and medium farms.',
  'Many farm injuries come from a small set of recurring causes: unsafe handling of tools and machinery, poor chemical storage and handling, and animal-handling accidents. Being deliberate about these three areas prevents a large share of common injuries.

Chemical inputs (pesticides, herbicides, veterinary medicines) should be stored in their original, labelled containers, out of reach of children, and away from food or water sources. Following label instructions for protective equipment when applying chemicals is a basic safety step that is easy to skip but meaningfully reduces health risk.

Tools and machinery should be kept in good working condition and used with appropriate care and protective equipment; a disproportionate number of serious farm injuries involve equipment that was already known to be faulty or was used in a way it was not designed for.

When working with livestock, understanding the animal''s typical behaviour and having a clear, calm handling routine reduces the risk of injury to both the handler and the animal, particularly during stressful moments like treatment, loading, or separating animals.',
  'Shamba Circle Editorial Team',
  null
);
