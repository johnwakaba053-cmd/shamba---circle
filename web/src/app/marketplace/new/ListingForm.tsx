"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

type ListingType = "for_sale" | "wanted";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export function ListingForm({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [listingType, setListingType] = useState<ListingType>("for_sale");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const descriptionRemaining = MAX_DESCRIPTION_LENGTH - description.length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle.length === 0) {
      setStatus({ kind: "error", message: "Enter a title for your listing." });
      return;
    }
    if (trimmedDescription.length === 0) {
      setStatus({ kind: "error", message: "Enter a description for your listing." });
      return;
    }
    if (!category) {
      setStatus({ kind: "error", message: "Choose a category." });
      return;
    }

    let parsedPrice: number | null = null;
    if (price.trim().length > 0) {
      const value = Number(price);
      if (Number.isNaN(value) || value < 0) {
        setStatus({ kind: "error", message: "Enter a valid price, or leave it blank." });
        return;
      }
      parsedPrice = value;
    }

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus({ kind: "error", message: "Please sign in again." });
        return;
      }

      const { error } = await supabase.from("listings").insert({
        profile_id: user.id,
        title: trimmedTitle,
        description: trimmedDescription,
        category,
        listing_type: listingType,
        price: parsedPrice,
        price_unit: priceUnit.trim() || null,
        location: location.trim() || null,
      });

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't create your listing. Please try again.",
        });
        return;
      }

      router.push("/marketplace");
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="font-sans text-sm font-semibold text-shamba-ink">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
          disabled={isLoading}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="e.g. 5 bags of certified maize seed"
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="description"
          className="font-sans text-sm font-semibold text-shamba-ink"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(event) =>
            setDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))
          }
          disabled={isLoading}
          rows={4}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Describe what you're selling or looking for…"
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />
        <span className="font-mono text-xs text-shamba-ink-soft">
          {descriptionRemaining} characters left
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="category" className="font-sans text-sm font-semibold text-shamba-ink">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={isLoading}
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        >
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-sans text-sm font-semibold text-shamba-ink">Listing type</span>
        <div role="radiogroup" aria-label="Listing type" className="flex flex-col gap-3">
          {(
            [
              { value: "for_sale", label: "For Sale", description: "I'm offering this" },
              { value: "wanted", label: "Wanted", description: "I'm looking for this" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink"
            >
              <input
                type="radio"
                name="listing_type"
                value={option.value}
                checked={listingType === option.value}
                onChange={() => setListingType(option.value)}
                disabled={isLoading}
                className="size-5 border-shamba-line text-shamba-green focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
              />
              <span className="flex flex-col">
                <span className="font-semibold">{option.label}</span>
                <span className="text-sm text-shamba-ink-soft">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="price" className="font-sans text-sm font-semibold text-shamba-ink">
          Price <span className="font-normal text-shamba-ink-soft">(optional)</span>
        </label>
        <input
          id="price"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          disabled={isLoading}
          placeholder="e.g. 500"
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="price_unit" className="font-sans text-sm font-semibold text-shamba-ink">
          Price unit <span className="font-normal text-shamba-ink-soft">(optional)</span>
        </label>
        <input
          id="price_unit"
          type="text"
          value={priceUnit}
          onChange={(event) => setPriceUnit(event.target.value)}
          disabled={isLoading}
          placeholder="e.g. per kg, per bag, per bird"
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="location" className="font-sans text-sm font-semibold text-shamba-ink">
          Location <span className="font-normal text-shamba-ink-soft">(optional)</span>
        </label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          disabled={isLoading}
          placeholder="e.g. Nakuru"
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />
      </div>

      {status.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isLoading ? "Publishing…" : "Publish listing"}
      </button>
    </form>
  );
}
