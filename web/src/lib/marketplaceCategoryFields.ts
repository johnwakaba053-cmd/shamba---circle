// Marketplace 2.0 Batch M3: category-aware listing fields. One shared,
// data-driven definition table drives rendering (CategoryFields.tsx),
// required/optional state, client-side validation, and submit-time
// validation -- a single source of truth, deliberately not 15 bespoke
// per-category components/schemas. Values are stored in
// listings.category_details (jsonb, nullable, no default -- see the
// M3 migration) only for the category the listing actually belongs to;
// there is no cross-category duplication of price/price_unit/location,
// which remain the existing shared listings columns.

export type CategoryFieldType = "text" | "textarea" | "number" | "date" | "select";

export type CategoryFieldOption = { value: string; label: string };

export type CategoryFieldDefinition = {
  key: string;
  label: string;
  type: CategoryFieldType;
  required?: boolean;
  placeholder?: string;
  // "select" only.
  options?: CategoryFieldOption[];
  // "number" only. Deliberately sparse: only `year` gets `integer` and a
  // `max` (a real four-digit year), everything else (age, quantity,
  // operating_hours, ...) only gets `min: 0` -- real farming quantities
  // are often fractional (1.5 acres, 20.5kg), so no blanket integer
  // requirement is imposed anywhere else, per the explicit instruction
  // not to over-restrict real use cases.
  min?: number;
  max?: number;
  integer?: boolean;
};

const CONDITION_OPTIONS: CategoryFieldOption[] = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
];

const CURRENT_YEAR = new Date().getFullYear();

// Keyed by public.marketplace_categories.id exactly -- the same 15
// categories, unchanged, unrenamed, unreordered. A category with no
// entry here (there is none today) simply renders no category-specific
// section at all.
export const CATEGORY_FIELDS: Record<string, CategoryFieldDefinition[]> = {
  livestock: [
    { key: "animal_type", label: "Animal type", type: "text", required: true, placeholder: "e.g. Cattle, Goat, Sheep" },
    { key: "breed", label: "Breed", type: "text" },
    {
      key: "sex",
      label: "Sex",
      type: "select",
      options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
    },
    { key: "age", label: "Age (years)", type: "number", min: 0 },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
    { key: "health_notes", label: "Health / vaccination notes", type: "textarea", placeholder: "e.g. Vaccinated against FMD, dewormed monthly" },
  ],
  poultry: [
    { key: "bird_type", label: "Bird type", type: "text", required: true, placeholder: "e.g. Broiler, Layer, Kienyeji" },
    { key: "breed", label: "Breed", type: "text" },
    { key: "age", label: "Age (weeks)", type: "number", min: 0 },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
  ],
  farm_machinery: [
    { key: "equipment_type", label: "Equipment type", type: "text", required: true, placeholder: "e.g. Tractor, Plough, Harvester" },
    { key: "make", label: "Make", type: "text" },
    { key: "model", label: "Model", type: "text" },
    { key: "year", label: "Year", type: "number", min: 1900, max: CURRENT_YEAR + 1, integer: true },
    { key: "condition", label: "Condition", type: "select", options: CONDITION_OPTIONS },
    { key: "operating_hours", label: "Operating hours", type: "number", min: 0 },
    {
      key: "fuel_type",
      label: "Fuel type",
      type: "select",
      options: [
        { value: "diesel", label: "Diesel" },
        { value: "petrol", label: "Petrol" },
        { value: "electric", label: "Electric" },
        { value: "manual_none", label: "Manual / None" },
      ],
    },
  ],
  seeds_seedlings: [
    { key: "crop", label: "Crop", type: "text", required: true, placeholder: "e.g. Maize, Avocado, Tomato" },
    { key: "variety", label: "Variety", type: "text" },
    { key: "seedling_age", label: "Seedling age", type: "text", placeholder: "e.g. 6 weeks" },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
  ],
  farm_produce: [
    { key: "crop_product", label: "Crop / product", type: "text", required: true, placeholder: "e.g. Maize, Avocado, Milk" },
    { key: "variety", label: "Variety", type: "text" },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
    { key: "grade", label: "Grade / quality", type: "text", placeholder: "e.g. Grade A" },
    { key: "harvest_date", label: "Harvest date", type: "date" },
  ],
  fertilizers_farm_inputs: [
    { key: "product_type", label: "Product type", type: "text", required: true, placeholder: "e.g. DAP fertilizer, Pesticide" },
    { key: "brand", label: "Brand", type: "text" },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
  ],
  animal_feeds: [
    { key: "feed_type", label: "Feed type", type: "text", required: true, placeholder: "e.g. Dairy meal, Layers mash" },
    { key: "target_animal", label: "Target animal", type: "text" },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
  ],
  irrigation_water_equipment: [
    { key: "equipment_type", label: "Equipment type", type: "text", required: true, placeholder: "e.g. Water pump, Drip kit" },
    { key: "capacity_spec", label: "Capacity / specification", type: "text", placeholder: "e.g. 5000L/hr" },
    { key: "condition", label: "Condition", type: "select", options: CONDITION_OPTIONS },
  ],
  farm_tools_equipment: [
    { key: "tool_type", label: "Tool type", type: "text", required: true, placeholder: "e.g. Jembe, Wheelbarrow" },
    { key: "condition", label: "Condition", type: "select", options: CONDITION_OPTIONS },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
  ],
  packaging_storage: [
    { key: "item_type", label: "Item type", type: "text", required: true, placeholder: "e.g. Sacks, Silo, Crates" },
    { key: "capacity", label: "Capacity", type: "text", placeholder: "e.g. 90kg per sack" },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
  ],
  farm_structures: [
    { key: "structure_type", label: "Structure type", type: "text", required: true, placeholder: "e.g. Greenhouse, Store, Chicken coop" },
    { key: "size_spec", label: "Size / specification", type: "text", placeholder: "e.g. 8m x 30m" },
    { key: "condition", label: "Condition", type: "select", options: CONDITION_OPTIONS },
  ],
  farm_transport_services: [
    { key: "service_type", label: "Service type", type: "text", required: true, placeholder: "e.g. Produce transport, Tractor hire" },
    { key: "coverage_area", label: "Coverage area", type: "text", placeholder: "e.g. Nakuru & surrounding areas" },
    { key: "rate_basis", label: "Rate basis", type: "text", placeholder: "e.g. Per trip, per km" },
    { key: "availability_notes", label: "Availability", type: "textarea", placeholder: "e.g. Weekdays, book a day ahead" },
  ],
  dairy: [
    { key: "product_or_animal_type", label: "Product or animal type", type: "text", required: true, placeholder: "e.g. Fresh milk, Dairy cow" },
    { key: "quantity_volume", label: "Quantity / volume", type: "text", placeholder: "e.g. 20 litres/day" },
  ],
  fish_farming: [
    { key: "species", label: "Species", type: "text", required: true, placeholder: "e.g. Tilapia, Catfish" },
    { key: "size_stage", label: "Size / stage", type: "text", placeholder: "e.g. Fingerling, mature" },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
  ],
  beekeeping: [
    { key: "product_or_equipment_type", label: "Product or equipment type", type: "text", required: true, placeholder: "e.g. Honey, Beehive" },
    { key: "quantity", label: "Quantity", type: "number", min: 0 },
  ],
};

export function getCategoryFields(categoryId: string | null | undefined): CategoryFieldDefinition[] {
  if (!categoryId) return [];
  return CATEGORY_FIELDS[categoryId] ?? [];
}

// Raw, string-keyed form values (every HTML input yields a string
// regardless of the field's declared type) -- what ListingForm/
// CategoryFields hold in local state.
export type CategoryFieldFormValues = Record<string, string>;

// The actual stored shape: numbers are real JSON numbers, everything
// else is a string. Never includes a key for a field the seller left
// blank -- an optional field with no value is simply absent, not an
// empty string, so the detail page/preview can render "only fields
// that actually contain values" by just iterating this object's keys.
export type CategoryDetailsValue = string | number;
export type CategoryDetails = Record<string, CategoryDetailsValue>;

export type CategoryFieldValidationError = { key: string; message: string };

// The single validator used by both the "continue to preview" gate and
// the final publish/save call -- never duplicated logic between the two.
// Fields that don't belong to the selected category (or when no
// category is selected at all) are never validated, per the explicit
// instruction that a category's fields should never affect a listing
// in a different category.
export function validateCategoryDetails(
  categoryId: string | null | undefined,
  values: CategoryFieldFormValues,
): { errors: CategoryFieldValidationError[]; parsed: CategoryDetails } {
  const fields = getCategoryFields(categoryId);
  const errors: CategoryFieldValidationError[] = [];
  const parsed: CategoryDetails = {};

  for (const field of fields) {
    const raw = (values[field.key] ?? "").trim();

    if (raw.length === 0) {
      if (field.required) {
        errors.push({ key: field.key, message: `${field.label} is required.` });
      }
      continue;
    }

    if (field.type === "number") {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        errors.push({ key: field.key, message: `${field.label} must be a number.` });
        continue;
      }
      if (field.integer && !Number.isInteger(num)) {
        errors.push({ key: field.key, message: `${field.label} must be a whole number.` });
        continue;
      }
      if (field.min !== undefined && num < field.min) {
        errors.push({ key: field.key, message: `${field.label} cannot be less than ${field.min}.` });
        continue;
      }
      if (field.max !== undefined && num > field.max) {
        errors.push({ key: field.key, message: `${field.label} cannot be more than ${field.max}.` });
        continue;
      }
      parsed[field.key] = num;
    } else {
      parsed[field.key] = raw;
    }
  }

  return { errors, parsed };
}

// Converts a stored category_details value (as read back from Supabase,
// where jsonb numbers already deserialize as JS numbers) into the plain
// string-keyed shape the form's controlled inputs need. Used by the
// edit page to populate ListingForm's initial state -- and is exactly
// how a NULL category_details (every listing that predates M3,
// including the real production listing) becomes a safe empty object
// rather than a crash.
export function categoryDetailsToFormValues(
  details: CategoryDetails | null | undefined,
): CategoryFieldFormValues {
  if (!details) return {};
  const result: CategoryFieldFormValues = {};
  for (const [key, value] of Object.entries(details)) {
    if (value !== null && value !== undefined) {
      result[key] = String(value);
    }
  }
  return result;
}

export type FilledCategoryDetailField = { key: string; label: string; value: string };

// What the detail page and the preview both render: only fields that
// actually have a value, in category-field-definition order, with
// "select" values resolved back to their human-readable label. Returns
// an empty array for a null/empty category_details or an unrecognized
// category -- callers render nothing at all in that case, never a
// placeholder or "N/A".
export function getFilledCategoryDetailFields(
  categoryId: string | null | undefined,
  details: CategoryDetails | null | undefined,
): FilledCategoryDetailField[] {
  if (!details) return [];
  const fields = getCategoryFields(categoryId);
  const result: FilledCategoryDetailField[] = [];

  for (const field of fields) {
    const value = details[field.key];
    if (value === null || value === undefined || value === "") continue;

    const display =
      field.type === "select"
        ? (field.options?.find((option) => option.value === value)?.label ?? String(value))
        : String(value);

    result.push({ key: field.key, label: field.label, value: display });
  }

  return result;
}
