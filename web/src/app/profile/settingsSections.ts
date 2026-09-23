// Shared between ProfileMenu (which triggers a section) and
// ProfileSettingsHost (which owns the one settings panel that's ever
// visible at a time) -- one source of truth for which sections exist and
// their display titles, so the two files can never drift out of sync.
export type SettingsSectionId =
  | "display-name"
  | "bio"
  | "visibility"
  | "county"
  | "crops"
  | "livestock"
  | "alerts";

export const SETTINGS_SECTION_TITLES: Record<SettingsSectionId, string> = {
  "display-name": "Display name",
  bio: "Bio",
  visibility: "Privacy",
  county: "Farmer preferences — Location",
  crops: "Crops & crop alerts",
  livestock: "Livestock & other alerts",
  alerts: "Weather & alert notifications",
};
