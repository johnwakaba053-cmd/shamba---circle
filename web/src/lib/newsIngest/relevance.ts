// Agriculture relevance and language checks for imported items.
//
// Every item gets a score: how many distinct farming terms its headline +
// description mention (topics plus farming institutions), so admins can
// see why it was picked. Which items pass depends on the feed:
//
//   agri_feed (text)  The feed is agriculture-only by source choice, so
//                     items pass unless clearly off-topic (an exclusion
//                     term with fewer than 3 farming topics).
//   strict (text)     Aggregators whose agriculture section also carries
//                     politics, crime, recipes and lifestyle stories
//                     (AllAfrica): the HEADLINE must name a farming topic,
//                     or the item must mention at least 3 -- and the
//                     exclusion rule still applies.
//   keyword_filter    Wider feeds (UNEP): at least 1 farming topic.
//   video             Every YouTube video, whatever the feed: at least 1
//                     farming TOPIC (an organisation's name alone, e.g.
//                     "FAO", doesn't count -- institutional videos are
//                     out), and in English or Kiswahili.

const TOPIC_TERMS = [
  // general
  "agriculture", "agricultural", "agribusiness", "agritech", "agtech", "agrifood", "agri-food",
  "farm", "farms", "farmer", "farmers", "farming", "smallholder", "smallholders",
  "harvest", "harvests", "crop", "crops", "food security", "food systems", "food system",
  "value chain", "value chains", "extension officers", "cooperative", "cooperatives",
  "post-harvest", "postharvest", "grain", "grains", "cereal", "cereals", "commodity", "commodities",
  "food prices", "food production", "hunger", "malnutrition", "climate-smart", "agroforestry", "agroecology",
  "drought", "rainfall", "irrigation", "soil", "soils", "fertiliser", "fertilizer", "fertilisers", "fertilizers",
  "seed", "seeds", "seedlings", "pesticide", "pesticides", "agrochemical", "agrochemicals",
  "locust", "locusts", "fall armyworm", "aflatoxin", "pest", "pests", "plant disease", "phytosanitary",
  "tractor", "tractors", "mechanisation", "mechanization", "greenhouse", "greenhouses",
  // crops
  "maize", "wheat", "rice", "bean", "beans", "sorghum", "millet", "cassava", "potato", "potatoes",
  "tea", "coffee", "cocoa", "avocado", "avocados", "horticulture", "horticultural", "vegetables",
  "fruit", "fruits", "citrus", "floriculture", "cut flowers", "cotton", "sugarcane", "macadamia", "cashew",
  "pyrethrum", "sunflower", "soybean", "soybeans", "soya", "groundnut", "groundnuts", "legumes",
  "pulses", "banana", "bananas", "mango", "mangoes", "tomato", "tomatoes", "onions",
  // livestock and fisheries
  "livestock", "dairy", "milk", "cattle", "cows", "goat", "goats", "sheep", "poultry",
  "chicken", "chickens", "eggs", "pigs", "beef", "camel", "camels", "fisheries", "aquaculture",
  "fish farming", "beekeeping", "honey", "veterinary", "fodder", "pasture", "pastoralists",
  "rangeland", "animal feed", "animal health", "foot-and-mouth", "foot and mouth",
  // Kiswahili
  "kilimo", "mkulima", "wakulima", "shamba", "mbolea", "mbegu", "mifugo", "maziwa", "mahindi",
  "mavuno", "ufugaji", "chakula",
] as const;

// Count towards the score, but never make an item relevant on their own.
const INSTITUTION_TERMS = [
  "kalro", "kephis", "fao", "ifad", "cgiar", "ilri", "cimmyt", "ifpri", "agra", "ncpb",
  "ministry of agriculture",
] as const;

const EXCLUSIONS = [
  // politics
  "election", "elections", "re-election", "presidential", "campaign rally",
  // crime and conflict
  "convoy attack", "bombing", "murder", "arrested",
  // lifestyle and entertainment
  "recipe", "barista", "cold brew", "latte", "celebrity", "music video", "box office",
  // sport and gambling
  "football", "premier league", "champions league", "betting", "lottery",
  // digests that list unrelated headlines
  "all of africa today",
] as const;

const INSTITUTION_SET: ReadonlySet<string> = new Set(INSTITUTION_TERMS);

export function isInstitutionTerm(term: string): boolean {
  return INSTITUTION_SET.has(term);
}

function termPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
}

const TOPIC_PATTERNS = TOPIC_TERMS.map((term) => ({ term, pattern: termPattern(term) }));
const INSTITUTION_PATTERNS = INSTITUTION_TERMS.map((term) => ({ term, pattern: termPattern(term) }));
const EXCLUSION_PATTERNS = EXCLUSIONS.map((term) => ({ term, pattern: termPattern(term) }));

function matches(patterns: { term: string; pattern: RegExp }[], text: string): string[] {
  return patterns.filter(({ pattern }) => pattern.test(text)).map(({ term }) => term);
}

// --- language -----------------------------------------------------------------

// A light stop-word check, enough to tell English/Kiswahili video titles
// and descriptions from Spanish, Portuguese and French ones (FAO posts
// in all of them). Unclear text (too few stop words) passes.
const ENGLISH_WORDS = new Set([
  "the", "and", "of", "to", "in", "for", "with", "is", "are", "on", "how", "what", "this",
  "that", "from", "by", "an", "at", "your", "you", "can", "more", "will", "about",
]);
const SWAHILI_WORDS = new Set(["na", "ya", "wa", "kwa", "za", "katika", "ni", "la", "cha", "vya", "hii", "jinsi"]);
const ROMANCE_WORDS = new Set([
  // Spanish
  "el", "los", "las", "del", "para", "con", "por", "que", "una", "un", "como", "mediante", "sobre", "su",
  // Portuguese
  // ("do" is left out: it is also everyday English.)
  "da", "dos", "das", "um", "uma", "não", "nao", "pelo", "pela", "meio", "ao", "às",
  // French
  "le", "les", "des", "du", "et", "pour", "avec", "dans", "sur", "est", "une", "au", "aux",
]);

export function isEnglishOrSwahili(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  let english = 0;
  let swahili = 0;
  let romance = 0;
  for (const word of words) {
    if (ENGLISH_WORDS.has(word)) english += 1;
    if (SWAHILI_WORDS.has(word)) swahili += 1;
    if (ROMANCE_WORDS.has(word)) romance += 1;
  }
  if (romance < 2) return true;
  return english + swahili >= romance;
}

// --- decision -----------------------------------------------------------------

export type RelevanceMode = "agri_feed" | "strict" | "keyword_filter" | "video";

export type Relevance = {
  relevant: boolean;
  score: number;
  matched: string[];
  reason: string | null;
};

export function assessRelevance(
  { title, body }: { title: string; body: string },
  mode: RelevanceMode,
): Relevance {
  const text = `${title} ${body}`;
  const topics = matches(TOPIC_PATTERNS, text);
  const titleTopics = matches(TOPIC_PATTERNS, title);
  const institutions = matches(INSTITUTION_PATTERNS, text);
  const excluded = matches(EXCLUSION_PATTERNS, text);
  const matched = [...topics, ...institutions];
  const score = Math.min(matched.length, 100);
  const result = (relevant: boolean, reason: string | null): Relevance => ({
    relevant,
    score,
    matched: matched.slice(0, 8),
    reason,
  });

  if (excluded.length > 0 && topics.length < 3) {
    return result(false, `off_topic:${excluded[0]}`);
  }

  switch (mode) {
    case "agri_feed":
      return result(true, null);
    case "strict":
      return titleTopics.length >= 1 || topics.length >= 3
        ? result(true, null)
        : result(false, "headline_not_about_farming");
    case "keyword_filter":
      return topics.length >= 1 ? result(true, null) : result(false, "no_farming_terms");
    case "video":
      if (topics.length === 0) return result(false, "no_farming_terms");
      if (!isEnglishOrSwahili(text)) return result(false, "not_english_or_kiswahili");
      return result(true, null);
  }
}
