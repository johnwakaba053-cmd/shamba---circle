import { getCategoryFields, type CategoryFieldFormValues } from "@/lib/marketplaceCategoryFields";

// One generic, data-driven dispatcher -- not fifteen bespoke per-category
// components. Every category's fields are the same handful of input
// shapes (text/textarea/number/date/select); a new or adjusted category
// is a data change in marketplaceCategoryFields.ts, never a new
// component. Purely a controlled-inputs view: all state lives in
// ListingForm.tsx, which already carries "use client" -- this component
// has no hooks of its own and needs none.
export function CategoryFields({
  categoryId,
  values,
  onChange,
  errors,
  disabled,
}: {
  categoryId: string;
  values: CategoryFieldFormValues;
  onChange: (key: string, value: string) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  const fields = getCategoryFields(categoryId);

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 rounded-shamba border border-shamba-line bg-shamba-card p-4">
      <p className="font-sans text-sm font-semibold text-shamba-ink">Category details</p>

      {fields.map((field) => {
        const inputId = `category-field-${field.key}`;
        const value = values[field.key] ?? "";

        return (
          <div key={field.key} className="flex flex-col gap-2">
            <label htmlFor={inputId} className="font-sans text-sm font-semibold text-shamba-ink">
              {field.label}
              {field.required ? (
                <span className="text-shamba-rust"> *</span>
              ) : (
                <span className="font-normal text-shamba-ink-soft"> (optional)</span>
              )}
            </label>

            {field.type === "select" ? (
              <select
                id={inputId}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
                disabled={disabled}
                className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
              >
                <option value="">Select…</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                id={inputId}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
                disabled={disabled}
                rows={3}
                placeholder={field.placeholder}
                className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
              />
            ) : (
              <input
                id={inputId}
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                inputMode={field.type === "number" ? "decimal" : undefined}
                min={field.type === "number" ? field.min : undefined}
                max={field.type === "number" ? field.max : undefined}
                step={field.type === "number" ? (field.integer ? 1 : "any") : undefined}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
                disabled={disabled}
                placeholder={field.placeholder}
                className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
              />
            )}

            {errors[field.key] && (
              <p role="alert" className="text-xs font-semibold text-shamba-rust">
                {errors[field.key]}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
