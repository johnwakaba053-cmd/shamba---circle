import {
  Bird,
  Briefcase,
  Bug,
  CloudSun,
  HelpCircle,
  Layers,
  PawPrint,
  ShieldCheck,
  Warehouse,
  Wheat,
} from "lucide-react";

// One icon per category id, shared by the landing and detail pages so
// the mapping only needs to be kept in sync with the seeded
// education_categories rows in one place.
export const EDUCATION_CATEGORY_ICON: Record<string, typeof Wheat> = {
  "crop-farming": Wheat,
  livestock: PawPrint,
  poultry: Bird,
  "soil-fertility": Layers,
  "pest-disease": Bug,
  "farm-business": Briefcase,
  "agri-insurance": ShieldCheck,
  "climate-weather": CloudSun,
  "post-harvest": Warehouse,
  "general-farming": HelpCircle,
};

export const EDUCATION_CATEGORY_FALLBACK_ICON = HelpCircle;
