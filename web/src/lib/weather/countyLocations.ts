// Server-only: approximate coordinates of each of the 47 Kenyan
// counties' main town/headquarters, used only to query WeatherAPI at
// county granularity. Deliberately NOT farmer GPS or IP-derived location
// -- every farmer in a county shares the same query point, and nothing
// here is tied to an individual profile. These are general-knowledge
// approximate town-center coordinates, not surveyed/official geocodes;
// precise enough for a weather query, not for anything requiring exact
// positioning.
//
// Keys match public.counties.id exactly, so ingestion can link a
// resulting alert straight to the county it was queried for.
export const KENYA_COUNTY_LOCATIONS: Record<string, { lat: number; lon: number }> = {
  mombasa: { lat: -4.0435, lon: 39.6682 },
  kwale: { lat: -4.1816, lon: 39.4606 },
  kilifi: { lat: -3.6305, lon: 39.8499 },
  "tana-river": { lat: -1.0167, lon: 40.1167 },
  lamu: { lat: -2.2717, lon: 40.902 },
  "taita-taveta": { lat: -3.3963, lon: 38.5591 },
  garissa: { lat: -0.4569, lon: 39.6583 },
  wajir: { lat: 1.7471, lon: 40.0629 },
  mandera: { lat: 3.9366, lon: 41.867 },
  marsabit: { lat: 2.3284, lon: 37.9899 },
  isiolo: { lat: 0.3556, lon: 37.5822 },
  meru: { lat: 0.047, lon: 37.6497 },
  "tharaka-nithi": { lat: -0.3031, lon: 37.9899 },
  embu: { lat: -0.531, lon: 37.45 },
  kitui: { lat: -1.3667, lon: 38.0167 },
  machakos: { lat: -1.5177, lon: 37.2634 },
  makueni: { lat: -1.8038, lon: 37.6244 },
  nyandarua: { lat: -0.1833, lon: 36.3667 },
  nyeri: { lat: -0.4201, lon: 36.9476 },
  kirinyaga: { lat: -0.6591, lon: 37.3826 },
  muranga: { lat: -0.7833, lon: 37.15 },
  kiambu: { lat: -1.1714, lon: 36.8356 },
  turkana: { lat: 3.1167, lon: 35.6 },
  "west-pokot": { lat: 1.7333, lon: 35.3833 },
  samburu: { lat: 1.1, lon: 36.6833 },
  "trans-nzoia": { lat: 1.0157, lon: 35.0062 },
  "uasin-gishu": { lat: 0.5143, lon: 35.2698 },
  "elgeyo-marakwet": { lat: 0.8167, lon: 35.5 },
  nandi: { lat: 0.1833, lon: 35.1 },
  baringo: { lat: 0.4667, lon: 35.9667 },
  laikipia: { lat: 0.0333, lon: 36.9667 },
  nakuru: { lat: -0.3031, lon: 36.08 },
  narok: { lat: -1.0833, lon: 35.8667 },
  kajiado: { lat: -1.85, lon: 36.7833 },
  kericho: { lat: -0.3667, lon: 35.2833 },
  bomet: { lat: -0.7833, lon: 35.3417 },
  kakamega: { lat: 0.2827, lon: 34.7519 },
  vihiga: { lat: 0.0667, lon: 34.7167 },
  bungoma: { lat: 0.5667, lon: 34.5667 },
  busia: { lat: 0.4608, lon: 34.1115 },
  siaya: { lat: 0.0667, lon: 34.2833 },
  kisumu: { lat: -0.0917, lon: 34.768 },
  "homa-bay": { lat: -0.5273, lon: 34.4571 },
  migori: { lat: -1.0634, lon: 34.4731 },
  kisii: { lat: -0.6773, lon: 34.7796 },
  nyamira: { lat: -0.5633, lon: 34.9358 },
  nairobi: { lat: -1.2921, lon: 36.8219 },
};
