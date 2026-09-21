"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

// Mirrors the listing-media bucket's own limits exactly (Stage 1
// migration: 10MB file_size_limit, image/jpeg|png|webp allowed_mime_types)
// -- kept in sync deliberately, since a looser client-side check here
// would just mean every rejection happens server-side instead, with a
// worse error message.
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ListingType = "for_sale" | "wanted";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export function ListingForm({ categories }: { categories: string[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [listingType, setListingType] = useState<ListingType>("for_sale");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState("");
  const [location, setLocation] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const descriptionRemaining = MAX_DESCRIPTION_LENGTH - description.length;

  // Same object-URL preview pattern as FeedComposer.tsx/StoryComposer.tsx
  // -- revoked on unmount/change so nothing leaks.
  const previewUrls = useMemo(
    () => selectedFiles.map((file) => URL.createObjectURL(file)),
    [selectedFiles],
  );
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) return;

    const combined = [...selectedFiles, ...files];

    if (combined.length > MAX_PHOTOS) {
      setPhotoError(`You can attach up to ${MAX_PHOTOS} photos per listing.`);
      return;
    }

    for (const file of combined) {
      if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
        setPhotoError(`${file.name} isn't a supported photo type. Use JPEG, PNG, or WebP.`);
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError(`${file.name} is too large. Photos must be under 10MB.`);
        return;
      }
    }

    setPhotoError(null);
    setSelectedFiles(combined);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoError(null);
  }

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

      // The listing must exist before any listing_media row can
      // reference it (listing_media.listing_id is a not-null FK), and
      // its id is also the second path segment every uploaded photo
      // needs -- so the listing is always created first, exactly per
      // the Stage 1/2/3 sequencing, unlike StoryComposer's "upload
      // first" flow (stories store their single media path directly on
      // the stories row itself, so there is no separate row to create
      // afterward there).
      const { data: newListing, error: listingError } = await supabase
        .from("listings")
        .insert({
          profile_id: user.id,
          title: trimmedTitle,
          description: trimmedDescription,
          category,
          listing_type: listingType,
          price: parsedPrice,
          price_unit: priceUnit.trim() || null,
          location: location.trim() || null,
        })
        .select("id")
        .single();

      if (listingError || !newListing) {
        setStatus({
          kind: "error",
          message: "We couldn't create your listing. Please try again.",
        });
        return;
      }

      if (selectedFiles.length > 0) {
        // user.id (never a client-editable field) is the first path
        // segment -- the exact segment the Stage 1 storage policy
        // ("Owners can upload their own listing media") checks against
        // auth.uid(). A random UUID per file (not the original filename)
        // rules out any collision between two uploads landing in the
        // same {profile_id}/{listing_id}/ folder.
        const uploadedPaths: string[] = [];
        let uploadFailed = false;

        for (const file of selectedFiles) {
          const extension = file.name.includes(".")
            ? file.name.split(".").pop()
            : file.type.split("/")[1];
          const path = `${user.id}/${newListing.id}/${crypto.randomUUID()}.${extension}`;

          const { error: uploadError } = await supabase.storage
            .from("listing-media")
            .upload(path, file, { contentType: file.type });

          if (uploadError) {
            uploadFailed = true;
            break;
          }
          uploadedPaths.push(path);
        }

        if (uploadFailed) {
          // Best-effort cleanup: remove whatever did make it into
          // Storage, then delete the listing itself -- its own
          // ON DELETE CASCADE takes care of any listing_media rows
          // (there can't be any yet at this point, but the delete is
          // unconditional cleanup either way). The seller never ends up
          // with a half-created listing sitting in the Marketplace.
          if (uploadedPaths.length > 0) {
            await supabase.storage.from("listing-media").remove(uploadedPaths);
          }
          await supabase.from("listings").delete().eq("id", newListing.id).eq("profile_id", user.id);
          setStatus({
            kind: "error",
            message: "We couldn't upload your photos. Please try again.",
          });
          return;
        }

        const mediaRows = uploadedPaths.map((path, index) => ({
          listing_id: newListing.id,
          profile_id: user.id,
          storage_path: path,
          media_type: selectedFiles[index].type,
        }));

        const { error: mediaInsertError } = await supabase.from("listing_media").insert(mediaRows);

        if (mediaInsertError) {
          await supabase.storage.from("listing-media").remove(uploadedPaths);
          await supabase.from("listings").delete().eq("id", newListing.id).eq("profile_id", user.id);
          setStatus({
            kind: "error",
            message: "We couldn't attach your photos. Please try again.",
          });
          return;
        }
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

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-sans text-sm font-semibold text-shamba-ink">
            Photos <span className="font-normal text-shamba-ink-soft">(optional)</span>
          </span>
          <span className="font-mono text-xs text-shamba-ink-soft">
            {selectedFiles.length}/{MAX_PHOTOS}
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES.join(",")}
          multiple
          onChange={handleFilesSelected}
          disabled={isLoading || selectedFiles.length >= MAX_PHOTOS}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || selectedFiles.length >= MAX_PHOTOS}
          className="inline-flex w-fit items-center gap-2 rounded-shamba border border-shamba-line px-4 py-2 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          Add photos
        </button>

        {photoError && (
          <p role="alert" className="text-xs font-semibold text-shamba-rust">
            {photoError}
          </p>
        )}

        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a remote/signed image */}
                <img
                  src={previewUrls[index]}
                  alt={`Selected photo ${index + 1}`}
                  className="size-20 rounded-shamba border border-shamba-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={isLoading}
                  aria-label={`Remove ${file.name}`}
                  className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-shamba-rust text-shamba-card disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
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
