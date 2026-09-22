-- Education 2.2: Learning Library Foundation + verified resource catalogue.
--
-- Adds KALRO as a source organization and seeds 27 independently
-- verified, authoritative external resources (KALRO/FAO) across 22 of
-- the 24 existing crop/livestock topics plus 5 general-category
-- resources. Every title, URL and publication date below was
-- independently confirmed live (HTTP status + extracted PDF/page text)
-- before this migration was written -- none is invented. sheep and
-- sugarcane have no resource: no genuinely verifiable KALRO/FAO
-- document could be found for either after real search effort, so
-- neither was forced. All 21 pre-existing resources are untouched.
--
-- Every resource is origin='external_linked' (we link to the official
-- source, we do not rehost) except one FAO manual explicitly published
-- under CC BY 4.0, which is classified 'external_redistributable' to
-- reflect that real permission -- but per this batch's explicit scope,
-- storage_path stays NULL and is_downloadable stays false for every
-- resource including that one: no PDF is rehosted in this batch, only
-- the rights classification is recorded for future use.

insert into public.education_sources (id, name, url) values
  ('kalro', 'Kenya Agricultural and Livestock Research Organization (KALRO)', 'https://www.kalro.org');

insert into public.education_resources
  (id, category_id, topic_id, learning_category, resource_type, origin, source_id, external_url, title, summary, content, is_published)
values
(
  'kalro-maize-timps-inventory', 'crop-farming', 'maize', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/MAIZE_TIMPS_Volume-1_for_Upload.pdf',
  'Inventory of Climate Smart Agriculture Technologies, Innovations and Management Practices for Maize Value Chain',
  $s$An official KALRO inventory of climate-smart technologies and practices for maize, covering varieties, agronomy, pest and disease management, and post-harvest handling.$s$,
  $c$Compiled by KALRO researchers under the Kenya Climate-Smart Agriculture Project (KCSAP) and published in 2022, this document catalogues validated technologies, innovations and management practices (TIMPs) across the maize value chain -- from variety selection and agronomy to crop health and post-harvest handling. It is the reference base for KALRO's companion Maize Training-of-Trainers manual used to train extension officers and lead farmers across Kenya's maize-growing regions.$c$,
  true
),
(
  'kalro-dry-bean-training-manual', 'crop-farming', 'beans', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/Dry-Beans-Manual-5-Feb-2021.pdf',
  $t$Climate Smart Agriculture Technologies, Innovations and Management Practices for Dry Bean Value Chain -- Training of Trainers' Manual$t$,
  $s$KALRO's official Training-of-Trainers manual for dry beans, teaching climate-smart planting, soil fertility, pest and disease control, and harvest practices.$s$,
  $c$Published by KALRO in February 2021 under the Kenya Climate-Smart Agriculture Project (KCSAP), this trainer's manual translates KALRO's dry bean technologies, innovations and management practices into step-by-step training modules for extension staff and lead farmers -- covering variety selection, land preparation, planting, fertility management, integrated pest and disease control, harvesting and post-harvest handling.$c$,
  true
),
(
  'kalro-potato-training-manual', 'crop-farming', 'irish-potatoes', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/Potato-ToT-8-June-2021.pdf',
  $t$Climate Smart Agricultural Technologies, Innovations and Management Practices for Potato Value Chain -- Training of Trainers' Manual$t$,
  $s$KALRO's official Irish potato Training-of-Trainers manual covering seed systems, agronomy, pest and disease management, and post-harvest handling.$s$,
  $c$Published by KALRO in March 2021 under KCSAP, this manual covers certified seed use, land preparation and planting, soil fertility and water management, integrated pest and disease management (including late blight), harvesting, storage and marketing for Irish potato growers in Kenya.$c$,
  true
),
(
  'fao-sweet-potato-post-harvest-system', 'crop-farming', 'sweet-potatoes', 'harvest_post_harvest', 'article', 'external_linked', 'fao',
  'https://openknowledge.fao.org/server/api/core/bitstreams/6b53b08d-f473-4677-a416-99f997c88d1a/content/x5420e05.htm',
  'Sweet Potato Post-Harvest System (Kenya Field Study)',
  $s$An FAO-hosted Kenya field study describing how smallholder farmers in western Kenya handle, process and market sweet potatoes after harvest.$s$,
  $c$A chapter of a 1998 joint GTZ/Ministry of Agriculture post-harvest systems study, hosted on FAO's knowledge repository, documenting sweet potato production patterns, on-farm handling, local marketing chains, and small-scale processing (chips, crisps, flour) based on fieldwork in Kenya's Kisii district -- including practical post-harvest challenges such as spoilage and weevil damage in stored flour.$c$,
  true
),
(
  'kalro-tomato-training-manual', 'crop-farming', 'tomatoes', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/tomato-training-manual-8-12-20.pdf',
  $t$Climate Smart Agricultural Technologies, Innovations and Management Practices for Tomato Value Chain -- Training of Trainers' Manual$t$,
  $s$KALRO's official Training-of-Trainers manual for tomato production, covering varieties, crop husbandry, pest and disease control, and post-harvest handling.$s$,
  $c$Published by KALRO in March 2020 under KCSAP, this manual covers nursery and transplanting practices, staking and pruning, irrigation and fertility management, integrated pest and disease management (blight, bacterial wilt), harvesting and post-harvest handling to reduce losses for tomato growers.$c$,
  true
),
(
  'kalro-kale-timps', 'crop-farming', 'kale', null, 'article', 'external_linked', 'kalro',
  'http://kalrotimps.com/timps/10',
  'Kale (Sukuma Wiki) TIMPs',
  $s$KALRO's official web-based guide for kale (sukuma wiki), covering varieties, seed systems, soil fertility, crop health, harvesting and marketing.$s$,
  $c$Part of KALRO's public Technologies, Innovations and Management Practices (TIMPs) portal, this page presents recommended kale varieties and certified seed sources, good agricultural and food-safety practices, soil fertility management, pest and disease management, step-by-step growing guidance, post-harvest handling and market information for kale/sukuma wiki growers in Kenya.$c$,
  true
),
(
  'kalro-cabbage-timps', 'crop-farming', 'cabbage', null, 'article', 'external_linked', 'kalro',
  'http://kalrotimps.com/timps/3',
  'Cabbage TIMPs',
  $s$KALRO's official web-based guide for cabbage, covering site selection, transplanting, water and weed management, pest and disease control, and marketing.$s$,
  $c$Part of KALRO's public TIMPs portal, this resource walks farmers through the cabbage production cycle: ecological requirements, land preparation and nursery establishment, transplanting spacing, irrigation and weed management, soil fertility, pest and disease control, harvesting, storage and marketing.$c$,
  true
),
(
  'kalro-onion-timps-inventory', 'crop-farming', 'onions', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/onion-timps.pdf',
  'Inventory of Climate Smart Agriculture Technologies, Innovations and Management Practices for Onion Value Chain',
  $s$KALRO's official inventory of climate-smart technologies and practices for onion production, from variety choice through pest management to post-harvest handling.$s$,
  $c$Published by KALRO in July 2021 under KCSAP, this inventory documents validated onion technologies including recommended varieties, nursery and transplanting practices, irrigation and fertility management, integrated pest and disease management, harvesting, curing, storage and marketing for onion growers in Kenya.$c$,
  true
),
(
  'kalro-mango-training-manual', 'crop-farming', 'mango', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/mango-tot.pdf',
  'Climate Smart Agriculture Technologies, Innovations and Management Practices for Mango Value Chain -- Training of Trainers'' Manual',
  $s$A KALRO training manual teaching extension officers and farmers how to grow, manage and market mango using climate-smart practices.$s$,
  $c$Published by KALRO in July 2021, this trainer's manual covers recommended mango varieties, site and orchard establishment, water and nutrient management, pest and disease control, harvest maturity indices, and post-harvest handling across the mango value chain.$c$,
  true
),
(
  'kalro-banana-training-manual', 'crop-farming', 'bananas', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/banana-training-manual-8-12-20.pdf',
  $t$Climate Smart Agricultural Technologies, Innovations and Management Practices for Banana Value Chain -- Training of Trainers' Manual$t$,
  $s$A KALRO trainer's manual explaining climate-smart banana growing, from site selection and planting material to pest control and post-harvest handling.$s$,
  $c$Published by KALRO in March 2020, this manual covers agro-ecological requirements, cultivar selection, land preparation, crop and water management, disease and pest management (including banana bacterial wilt and weevils), harvesting, post-harvest handling and value addition for banana growers.$c$,
  true
),
(
  'kalro-coffee-timps', 'crop-farming', 'coffee', null, 'article', 'external_linked', 'kalro',
  'https://kalrotimps.com/timps/30',
  'Coffee TIMPs',
  $s$A KALRO knowledge-portal guide introducing coffee species and Kenya's coffee-growing regions, as a gateway into climate-smart coffee production practices.$s$,
  $c$Part of KALRO's public TIMPs knowledge base, this page introduces Coffea arabica and Coffea canephora and traces the spread of coffee growing across Kenya's regions, forming the entry point into KALRO's detailed technologies, innovations and management practices for coffee farmers and extension workers.$c$,
  true
),
(
  'kalro-cassava-timps', 'crop-farming', 'cassava', null, 'article', 'external_linked', 'kalro',
  'https://kalrotimps.com/timps/4',
  'Cassava TIMPs',
  $s$A KALRO guide walking farmers through the full cassava production cycle across Kenya's three main growing belts (Coast, Western and Central).$s$,
  $c$Part of KALRO's public TIMPs portal, this page covers cassava variety choice, suitable growing areas, land preparation, planting, weeding, water and fertility management, maturity signs, disease control, harvesting, fresh-root storage and basic processing -- positioning cassava as a drought-tolerant food-security crop.$c$,
  true
),
(
  'kalro-avocado-farming-course', 'crop-farming', 'avocado', null, 'article', 'external_linked', 'kalro',
  'https://mkulima.kalro.org/course/view.php?id=66',
  'Avocado Farming',
  $s$A KALRO e-learning course teaching farmers and extension officers how to establish and run a profitable, climate-smart avocado enterprise in Kenya.$s$,
  $c$Delivered through KALRO's Mkulima e-learning platform, this course covers site selection, seedling propagation and grafting, orchard spacing, nutrition, irrigation and pruning, pest and disease identification and control, harvest maturity, post-harvest handling and marketing -- highlighting Kenya's key commercial varieties (Hass, Fuerte and Puebla).$c$,
  true
),
(
  'fao-groundnut-good-agricultural-practices', 'crop-farming', 'groundnuts', null, 'document', 'external_linked', 'fao',
  'https://openknowledge.fao.org/server/api/core/bitstreams/ea33e92e-6509-463f-8730-4f6d9d360798/content',
  'Good Agricultural Practices (GAP) -- Groundnut (Arachis hypogaea L.)',
  $s$An FAO good-agricultural-practices guide teaching groundnut growers quality-focused production techniques from planting through storage.$s$,
  $c$Published by FAO in 2024, this guide covers groundnut variety selection, seed inoculation, planting geometry, nutrient-deficiency diagnosis, integrated pest management, correct harvest timing, drying methods and aflatoxin prevention during drying and storage. Its agronomic guidance was written for Myanmar's Central Dry Zone but the underlying practices are generally applicable to groundnut production. Note: this document is published under a Creative Commons Attribution-NonCommercial-ShareAlike 3.0 IGO licence, which permits sharing but restricts commercial use -- classified external_linked here rather than external_redistributable pending a clear determination of whether that non-commercial restriction applies to this platform.$c$,
  true
),
(
  'kalro-tea-common-diseases', 'crop-farming', 'tea', 'pests_diseases', 'document', 'external_linked', 'kalro',
  'https://kalroerepository.kalro.org/server/api/core/bitstreams/15377e0f-5118-4d1a-93d5-3d15a3885c3a/content',
  'Common Diseases of Tea in Kenya',
  $s$A KALRO Tea Research Institute brochure helping tea farmers identify and manage the most common tea diseases found in Kenya's growing regions.$s$,
  $c$Published by KALRO's Tea Research Institute in Kericho (Information Brochure Series No. 2017/029), this brochure describes major tea diseases -- including Armillaria root rot, Hypoxylon wood/stem canker, Grey Leaf Spot and Brown Leaf Spot -- their symptoms, and prevention/control measures such as using disease-free mother bushes and shade management.$c$,
  true
),
(
  'kalro-dairy-cattle-training-manual', 'livestock', 'dairy-cattle', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/dairy_value_chain.pdf',
  $t$Climate Smart Agricultural Technologies, Innovations and Management Practices for Dairy Value Chain -- Training of Trainers' Manual$t$,
  $s$An official KALRO training manual covering climate-smart dairy cattle breeds, feeding, housing, health and marketing for Kenyan farmers and extension officers.$s$,
  $c$Published by KALRO in March 2020 under KCSAP, this Training-of-Trainers manual covers dairy breeds, feeding and fodder, animal health, housing, and marketing/value addition suited to Kenya's different agro-climatic zones.$c$,
  true
),
(
  'kalro-beef-cattle-training-manual', 'livestock', 'beef-cattle', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/beef-tot-22-12-20.pdf',
  $t$Climate Smart Agricultural Technologies, Innovations and Management Practices for Beef Value Chain -- Training of Trainers' Manual$t$,
  $s$A KALRO training manual on climate-smart beef cattle breeds, fodder, health management and marketing for extension officers and lead farmers.$s$,
  $c$Published by KALRO in March 2020, this manual covers beef cattle breeds and fodder systems, animal health, herd management, and marketing, tailored to Kenya's agro-climatic zones.$c$,
  true
),
(
  'kalro-goat-production', 'livestock', 'goats', 'getting_started', 'document', 'external_linked', 'kalro',
  'https://www.kalro.org/elrp/locust/contentfiles/2-4-5%20Sub-Module%205-Goat%20Production.pdf',
  'Goat Production',
  $s$A KALRO extension sub-module teaching goat breeds, housing design and basic management practices suited to Kenya's dry and marginal areas.$s$,
  $c$Sub-Module 5 of KALRO's "Sustainable Agricultural Livelihood Restoration, Rehabilitation and Resilience in Kenya" training manual, explaining why meat-goat farming suits smallholders in dry areas, listing common commercial breeds used in Kenya (Small East African Goat, Galla, Anglo-Nubian, Kenyan Alpine, Boer), and giving concrete housing specifications.$c$,
  true
),
(
  'fao-pig-sector-kenya', 'livestock', 'pigs', null, 'document', 'external_linked', 'fao',
  'https://www.fao.org/4/i2566e/i2566e00.pdf',
  'Pig Sector Kenya',
  $s$An FAO country review of Kenya's pig sector covering production systems, breeds, disease constraints, marketing and the policy environment for pig farming.$s$,
  $c$Published by FAO in 2012 as part of its Animal Production and Health Livestock Country Reviews series, this report reviews the history, production systems, consumption patterns, trade and value-chain structure of Kenya's pig subsector, plus the national policy and veterinary framework affecting producers.$c$,
  true
),
(
  'kalro-indigenous-chicken-training-manual', 'poultry', 'poultry', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/indigenous_chicken.pdf',
  $t$Climate Smart Agricultural Technologies, Innovations and Management Practices for Indigenous Chicken Value Chain -- Training of Trainers' Manual$t$,
  $s$A KALRO manual teaching indigenous (kienyeji) chicken breeds, housing, feeding, biosecurity, health and marketing for Kenyan smallholder poultry keepers.$s$,
  $c$Published by KALRO in March 2020, this manual covers breed selection, housing, feeding, biosecurity and disease management, record keeping, and post-harvest handling/marketing specifically for indigenous chicken production systems common among Kenyan smallholders.$c$,
  true
),
(
  'kalro-rabbit-production', 'livestock', 'rabbits', 'getting_started', 'document', 'external_linked', 'kalro',
  'https://www.kalro.org/elrp/locust/contentfiles/3-4%20Module%204%20Rabbbit%20production.pdf',
  'Rabbit Production and Management',
  $s$A KALRO training module explaining why rabbit farming suits Kenyan smallholders and how to house and manage rabbits for meat production.$s$,
  $c$Module 4 of KALRO's "Sustainable Agricultural Livelihood Restoration, Rehabilitation and Resilience in Kenya" training manual, introducing rabbit biology and terminology, explaining rabbits' feed efficiency compared to larger livestock, and detailing rabbitry housing requirements (ventilation, lighting, cage design).$c$,
  true
),
(
  'kalro-apiculture-training-manual', 'livestock', 'bees', null, 'document', 'external_linked', 'kalro',
  'https://keep.kalro.org/appfiles/media/vc_files/apiculture.pdf',
  $t$Climate Smart Technologies, Innovations and Management Practices for Apiculture Value Chain -- Training of Trainers' Manual$t$,
  $s$A KALRO manual teaching beekeeping practices -- hive types, bee forage, colony management, harvesting and marketing -- for Kenyan farmers.$s$,
  $c$Published by KALRO in March 2020, this manual covers bee species used in Kenyan beekeeping, hive and equipment selection, bee forage and pasture management, colony management and pollination services, and harvesting and post-harvest handling of honey.$c$,
  true
),
(
  'fao-livestock-ffs-behaviour-change-manual', 'general-farming', null, 'general', 'document', 'external_redistributable', 'fao',
  'https://openknowledge.fao.org/server/api/core/bitstreams/d8193a17-1c41-4787-b176-57c62e7be0cf/content',
  'Driving Behaviour Change in Livestock Farmer Field Schools',
  $s$A 2025 FAO facilitator's manual, co-authored by FAO's Nairobi office, for running livestock-focused Farmer Field Schools using behavioural-science techniques.$s$,
  $c$Published by FAO in 2025 and licensed under Creative Commons Attribution 4.0 International (CC BY 4.0), this step-by-step facilitator's guide integrates social and behavioural science into livestock-focused Farmer Field Schools to improve adoption of animal health and production practices among smallholder livestock keepers.$c$,
  true
),
(
  'fao-farm-business-school-manual', 'farm-business', null, 'marketing', 'document', 'external_linked', 'fao',
  'https://www.fao.org/4/i2133e/i2133e.pdf',
  'Farm Business School: Training of Facilitators Programme Manual',
  $s$An FAO facilitator's manual teaching the Farm Business School method -- helping smallholder farmers understand costs, profit and market-oriented decisions.$s$,
  $c$Published by FAO in 2011, this structured, learning-by-doing curriculum trains facilitators to run Farm Business Schools, covering basic farm business planning, record keeping, cost/profit analysis and market orientation for smallholder farmers.$c$,
  true
),
(
  'fao-climate-smart-agriculture-sourcebook', 'climate-weather', null, 'general', 'document', 'external_linked', 'fao',
  'https://www.fao.org/4/i3325e/i3325e.pdf',
  'Climate-Smart Agriculture Sourcebook',
  $s$FAO's flagship reference guide explaining what climate-smart agriculture is and how to apply it across crops, livestock, fisheries and forestry.$s$,
  $c$Published by FAO in 2013, this comprehensive sourcebook lays out the concept and practice of climate-smart agriculture for policymakers, extension staff and practitioners, covering production systems, ecosystem services, and institutional and financing approaches to building resilience to climate change.$c$,
  true
),
(
  'fao-soil-nutrient-management-ffs-guidelines', 'soil-fertility', null, 'crop_management', 'document', 'external_linked', 'fao',
  'https://www.fao.org/fileadmin/templates/nr/images/resources/pdf_documents/misc27.pdf',
  'Guidelines and Reference Material on Integrated Soil and Nutrient Management and Conservation for Farmer Field Schools',
  $s$An FAO reference guide for Farmer Field School facilitators teaching integrated soil fertility management and soil conservation practices.$s$,
  $c$Published by FAO in 2000, this guide provides technical background and field-school session guidance on soil fertility diagnosis, organic and inorganic nutrient management, and soil and water conservation practices for use in participatory Farmer Field School training.$c$,
  true
),
(
  'fao-integrated-pest-management-principles', 'pest-disease', null, 'pests_diseases', 'article', 'external_linked', 'fao',
  'https://www.fao.org/pest-and-pesticide-management/ipm/principles-and-practices/en/',
  'Integrated Pest Management: Principles and Practices',
  $s$FAO's official statement of general Integrated Pest Management (IPM) principles, applicable across crops rather than tied to one specific pest.$s$,
  $c$Published on FAO's official website, this page lays out FAO's core IPM principles -- an ecosystem approach to pest prevention, conserving beneficial predators and parasites, and a hierarchy of control methods (cultural, biological, mechanical, and chemical as a last resort) -- as general guidance for designing pest management programmes.$c$,
  true
);
