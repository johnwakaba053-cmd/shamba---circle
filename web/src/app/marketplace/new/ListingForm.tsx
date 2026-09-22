"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EditableListingMediaItem } from "@/lib/listingMedia";
import {
  getFilledCategoryDetailFields,
  validateCategoryDetails,
  type CategoryFieldFormValues,
} from "@/lib/marketplaceCategoryFields";
import { CategoryFields } from "./CategoryFields";
import { ListingPreview } from "./ListingPreview";

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

// Marketplace's own product taxonomy (public.marketplace_categories) --
// independent of Communities' discussion taxonomy (public.communities).
// Selecting by stable `id`, not by display name, is what Batch M1 fixes:
// a listing's category_id keeps pointing at the same row even if that
// category's `name` is later renamed, unlike the old text-only category
// that silently orphaned when a Community's name changed.
export type MarketplaceCategoryOption = { id: string; name: string };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

type ViewMode = "form" | "preview";

// Shared by both /marketplace/new (create) and /marketplace/[id]/edit
// (edit) rather than duplicated -- the field set, validation, and photo
// picker are identical in both places; only what happens on submit (and
// a few labels) differs by `mode`. `listingId`/`initialValues`/
// `initialPhotos` are only ever passed by the edit page.
//
// Batch M3 adds category-aware fields (category_details) as a fourth
// concern this form owns: it holds the raw form-string values for
// whichever category is currently selected, resets them whenever the
// category changes (never carrying a value across into a different
// category's differently-shaped fields), and validates/serializes them
// via the same shared marketplaceCategoryFields.ts helpers the detail
// page and preview also use. A new "preview" step sits between filling
// the form and actually publishing/saving -- still one page, one
// component, just a second render mode (`viewMode`), not a new route.
export function ListingForm({
  categories,
  mode = "create",
  listingId,
  initialValues,
  initialPhotos = [],
}: {
  categories: MarketplaceCategoryOption[];
  mode?: "create" | "edit";
  listingId?: string;
  initialValues?: {
    title: string;
    description: string;
    categoryId: string;
    listingType: ListingType;
    price: string;
    priceUnit: string;
    location: string;
    categoryDetails?: CategoryFieldFormValues;
  };
  initialPhotos?: EditableListingMediaItem[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [categoryId, setCategoryId] = useState(
    initialValues?.categoryId ?? categories[0]?.id ?? "",
  );
  const [categoryDetailsValues, setCategoryDetailsValues] = useState<CategoryFieldFormValues>(
    initialValues?.categoryDetails ?? {},
  );
  const [categoryFieldErrors, setCategoryFieldErrors] = useState<Record<string, string>>({});
  const [listingType, setListingType] = useState<ListingType>(
    initialValues?.listingType ?? "for_sale",
  );
  const [price, setPrice] = useState(initialValues?.price ?? "");
  const [priceUnit, setPriceUnit] = useState(initialValues?.priceUnit ?? "");
  const [location, setLocation] = useState(initialValues?.location ?? "");
  // Existing photos already saved on the listing (edit mode only) --
  // removing one here only updates this local state; the actual delete
  // (row + storage object) happens on save, same as a new file only
  // actually uploads on save. Diffed against `initialPhotos` at submit
  // time to know what the seller removed.
  const [existingPhotos, setExistingPhotos] =
    useState<EditableListingMediaItem[]>(initialPhotos);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [viewMode, setViewMode] = useState<ViewMode>("form");

  const isLoading = status.kind === "loading";
  const descriptionRemaining = MAX_DESCRIPTION_LENGTH - description.length;
  const totalPhotoCount = existingPhotos.length + selectedFiles.length;

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

    if (existingPhotos.length + combined.length > MAX_PHOTOS) {
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

  function removeExistingPhoto(id: string) {
    setExistingPhotos((prev) => prev.filter((photo) => photo.id !== id));
    setPhotoError(null);
  }

  // Changing category always replaces the category-specific field set --
  // never carries a value from one category's fields into a differently
  // -shaped category (e.g. a livestock "age" in years is not a seedling
  // "age" in weeks). The notice below the select is always visible
  // rather than a blocking confirmation, since this reset only ever
  // discards data the seller can see was just cleared, in the same form,
  // with nothing else lost.
  function handleCategoryChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setCategoryId(event.target.value);
    setCategoryDetailsValues({});
    setCategoryFieldErrors({});
  }

  function handleCategoryFieldChange(key: string, value: string) {
    setCategoryDetailsValues((prev) => ({ ...prev, [key]: value }));
  }

  // Shared by both the "continue to preview" gate and (defensively)
  // publish itself -- the single validation pass every field goes
  // through, including category-specific ones via the same
  // marketplaceCategoryFields.ts validator the form's rendering and the
  // detail page's display both already read from.
  function validateAll():
    | { ok: true; selectedCategoryName: string; parsedCategoryDetails: Record<string, string | number> }
    | { ok: false; message: string; categoryErrors: Record<string, string> } {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle.length === 0) {
      return { ok: false, message: "Enter a title for your listing.", categoryErrors: {} };
    }
    if (trimmedDescription.length === 0) {
      return { ok: false, message: "Enter a description for your listing.", categoryErrors: {} };
    }

    const selectedCategory = categories.find((option) => option.id === categoryId);
    if (!selectedCategory) {
      return { ok: false, message: "Choose a category.", categoryErrors: {} };
    }

    if (price.trim().length > 0) {
      const value = Number(price);
      if (Number.isNaN(value) || value < 0) {
        return { ok: false, message: "Enter a valid price, or leave it blank.", categoryErrors: {} };
      }
    }

    const { errors: categoryErrors, parsed } = validateCategoryDetails(categoryId, categoryDetailsValues);
    if (categoryErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      for (const error of categoryErrors) errorMap[error.key] = error.message;
      return { ok: false, message: "Please fix the highlighted fields below.", categoryErrors: errorMap };
    }

    return { ok: true, selectedCategoryName: selectedCategory.name, parsedCategoryDetails: parsed };
  }

  function handleContinueToPreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const validation = validateAll();
    if (!validation.ok) {
      setCategoryFieldErrors(validation.categoryErrors);
      setStatus({ kind: "error", message: validation.message });
      return;
    }

    setCategoryFieldErrors({});
    setStatus({ kind: "idle" });
    setViewMode("preview");
  }

  async function handlePublish() {
    if (isLoading) return;

    const validation = validateAll();
    if (!validation.ok) {
      // Defensive only -- reachable only if something changed between
      // entering preview and clicking publish, which the UI doesn't
      // allow, but this avoids ever saving unvalidated data.
      setCategoryFieldErrors(validation.categoryErrors);
      setStatus({ kind: "error", message: validation.message });
      setViewMode("form");
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const parsedPrice = price.trim().length > 0 ? Number(price) : null;
    const categoryDetailsPayload =
      Object.keys(validation.parsedCategoryDetails).length > 0 ? validation.parsedCategoryDetails : null;

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

      const fields = {
        title: trimmedTitle,
        description: trimmedDescription,
        // Both written together during this transition: `category`
        // (free text) is what every existing read path (browse, detail)
        // still displays, kept in sync with the chosen category's name
        // so nothing there needs to change in this batch; `category_id`
        // is the new stable-identity relationship going forward. See
        // public.marketplace_categories.
        category: validation.selectedCategoryName,
        category_id: categoryId,
        // category_details: null when the category has no filled
        // fields (every field left blank isn't possible once the
        // required identity field validated, but this stays a safe,
        // explicit fallback) -- never an ambiguous empty object.
        category_details: categoryDetailsPayload,
        listing_type: listingType,
        price: parsedPrice,
        price_unit: priceUnit.trim() || null,
        location: location.trim() || null,
      };

      if (mode === "edit") {
        if (!listingId) {
          setStatus({
            kind: "error",
            message: "Something went wrong. Please try again.",
          });
          return;
        }

        // Fields are saved first -- mirrors create mode's own "anchor
        // resource first" ordering (there, the listing row is created
        // before any photo work happens). A failure here is a clean,
        // total no-op: nothing about the seller's photos is touched at
        // all. profile_id is never part of this payload -- ownership
        // can't change through this form, and the .eq("profile_id", ...)
        // filter below is a belt-and-braces mirror of the RLS policy
        // that already enforces this server-side.
        const { data: updatedListing, error: updateError } = await supabase
          .from("listings")
          .update(fields)
          .eq("id", listingId)
          .eq("profile_id", user.id)
          .select("id")
          .single();

        if (updateError || !updatedListing) {
          setStatus({
            kind: "error",
            message: "We couldn't save your listing. Please try again.",
          });
          return;
        }

        // Existing photos the seller unselected -- diffed against the
        // form's original snapshot, not tracked as a separate removal
        // list. Deleting the listing_media row first (the authoritative
        // record) then best-effort removing the Storage object mirrors
        // StoryViewer's own delete-then-cleanup precedent exactly: a
        // failed storage remove only ever leaves an orphaned object
        // nothing in the app can render or link to again, never a
        // dangling/broken row.
        const removedPhotos = initialPhotos.filter(
          (photo) => !existingPhotos.some((kept) => kept.id === photo.id),
        );

        for (const photo of removedPhotos) {
          const { error: removeRowError } = await supabase
            .from("listing_media")
            .delete()
            .eq("id", photo.id)
            .eq("profile_id", user.id);

          if (removeRowError) {
            setStatus({
              kind: "error",
              message: "We couldn't remove one of your photos. Please try again.",
            });
            return;
          }

          void supabase.storage.from("listing-media").remove([photo.storagePath]);
        }

        // New photos, if any -- identical upload-then-insert-with-
        // rollback shape as create mode, scoped only to this batch: a
        // failure here never touches the field update or photo removals
        // already committed above in this same save.
        if (selectedFiles.length > 0) {
          const uploadedPaths: string[] = [];
          let uploadFailed = false;

          for (const file of selectedFiles) {
            const extension = file.name.includes(".")
              ? file.name.split(".").pop()
              : file.type.split("/")[1];
            const path = `${user.id}/${listingId}/${crypto.randomUUID()}.${extension}`;

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
            if (uploadedPaths.length > 0) {
              await supabase.storage.from("listing-media").remove(uploadedPaths);
            }
            setStatus({
              kind: "error",
              message: "We couldn't upload your new photos. Please try again.",
            });
            return;
          }

          const mediaRows = uploadedPaths.map((path, index) => ({
            listing_id: listingId,
            profile_id: user.id,
            storage_path: path,
            media_type: selectedFiles[index].type,
          }));

          const { error: mediaInsertError } = await supabase
            .from("listing_media")
            .insert(mediaRows);

          if (mediaInsertError) {
            await supabase.storage.from("listing-media").remove(uploadedPaths);
            setStatus({
              kind: "error",
              message: "We couldn't attach your new photos. Please try again.",
            });
            return;
          }
        }

        router.push(`/marketplace/${listingId}`);
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
        .insert({ profile_id: user.id, ...fields })
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

  if (viewMode === "preview") {
    const selectedCategory = categories.find((option) => option.id === categoryId);
    const { parsed } = validateCategoryDetails(categoryId, categoryDetailsValues);
    const filledDetails = getFilledCategoryDetailFields(categoryId, parsed);
    const photoUrls = [...existingPhotos.map((photo) => photo.url), ...previewUrls];

    return (
      <div className="mt-6 flex flex-col gap-4">
        <ListingPreview
          title={title.trim()}
          categoryName={selectedCategory?.name ?? ""}
          details={filledDetails}
          description={description.trim()}
          listingType={listingType}
          price={price}
          priceUnit={priceUnit}
          location={location}
          photoUrls={photoUrls}
        />

        {status.kind === "error" && (
          <p role="alert" className="text-sm font-semibold text-shamba-rust">
            {status.message}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode("form")}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
          >
            Back to edit
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isLoading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {mode === "edit"
              ? isLoading
                ? "Saving…"
                : "Save changes"
              : isLoading
                ? "Publishing…"
                : "Publish listing"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleContinueToPreview} className="mt-6 flex flex-col gap-4">
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
        <label htmlFor="category" className="font-sans text-sm font-semibold text-shamba-ink">
          Category
        </label>
        <select
          id="category"
          value={categoryId}
          onChange={handleCategoryChange}
          disabled={isLoading}
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        >
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <p className="font-mono text-[11px] leading-4 text-shamba-ink-soft">
          Changing category will clear the category-specific details you&apos;ve entered.
        </p>
      </div>

      {categoryId && (
        <CategoryFields
          categoryId={categoryId}
          values={categoryDetailsValues}
          onChange={handleCategoryFieldChange}
          errors={categoryFieldErrors}
          disabled={isLoading}
        />
      )}

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
            {totalPhotoCount}/{MAX_PHOTOS}
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES.join(",")}
          multiple
          onChange={handleFilesSelected}
          disabled={isLoading || totalPhotoCount >= MAX_PHOTOS}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || totalPhotoCount >= MAX_PHOTOS}
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

        {(existingPhotos.length > 0 || selectedFiles.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {existingPhotos.map((photo) => (
              <div key={photo.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, signed-URL bucket, same as ListingMedia.tsx */}
                <img
                  src={photo.url}
                  alt="Listing photo"
                  className="size-20 rounded-shamba border border-shamba-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExistingPhoto(photo.id)}
                  disabled={isLoading}
                  aria-label="Remove this photo"
                  className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-shamba-rust text-shamba-card disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}

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
        {mode === "edit" ? "Preview changes" : "Continue to preview"}
      </button>
    </form>
  );
}
