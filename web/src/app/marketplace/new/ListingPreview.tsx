import { MapPin } from "lucide-react";
import type { FilledCategoryDetailField } from "@/lib/marketplaceCategoryFields";

// Read-only summary shown between "continue to preview" and the actual
// publish/save action -- part of ListingForm's own single-page flow
// (see its viewMode state), not a separate route. Deliberately mirrors
// the exact same card layout already used on the browse/detail pages
// (rounded-shamba border, same field order) so what a seller previews
// here looks like what they'll actually see live.
export function ListingPreview({
  title,
  categoryName,
  details,
  description,
  listingType,
  price,
  priceUnit,
  location,
  photoUrls,
}: {
  title: string;
  categoryName: string;
  details: FilledCategoryDetailField[];
  description: string;
  listingType: "for_sale" | "wanted";
  price: string;
  priceUnit: string;
  location: string;
  photoUrls: string[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-bold leading-tight text-shamba-ink">
          {title || "Untitled listing"}
        </h3>
        <span
          className={
            listingType === "for_sale"
              ? "shrink-0 rounded-shamba bg-shamba-green px-2 py-1 font-mono text-xs font-semibold text-shamba-card"
              : "shrink-0 rounded-shamba bg-shamba-blue px-2 py-1 font-mono text-xs font-semibold text-shamba-card"
          }
        >
          {listingType === "for_sale" ? "For Sale" : "Wanted"}
        </span>
      </div>

      {photoUrls.length > 0 && (
        <div className={photoUrls.length === 1 ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
          {photoUrls.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- local/signed preview URLs, same as ListingForm's own existing photo picker
            <img
              key={index}
              src={url}
              alt=""
              className="aspect-square w-full rounded-shamba border border-shamba-line object-cover"
            />
          ))}
        </div>
      )}

      <p className="font-mono text-xs text-shamba-ink-soft">{categoryName}</p>

      {details.length > 0 && (
        <dl className="flex flex-col gap-1 border-t border-shamba-line pt-2">
          {details.map((item) => (
            <div key={item.key} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="text-shamba-ink-soft">{item.label}</dt>
              <dd className="text-right font-semibold text-shamba-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="whitespace-pre-wrap text-base leading-6 text-shamba-ink-soft">
        {description || "No description yet."}
      </p>

      {price && (
        <p className="font-sans text-sm font-semibold text-shamba-ink">
          {price}
          {priceUnit ? ` ${priceUnit}` : ""}
        </p>
      )}

      {location && (
        <p className="flex items-center gap-1 text-xs text-shamba-ink-soft">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          {location}
        </p>
      )}
    </div>
  );
}
