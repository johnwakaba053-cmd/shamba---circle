"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import type { SettingsSectionId } from "./settingsSections";

// The three-dot menu is pure navigation/disclosure -- it holds no
// preference logic of its own. Every non-photo item calls back into
// ProfileSettingsHost (the sole owner of "which one settings panel is
// currently open"), which shows the matching existing control -- never a
// DOM id/hash jump, since the seven settings sections no longer live
// inline on the page as always-visible <details>. The two photo items
// are a plain <button role="menuitem"> that programmatically clicks a
// hidden element already rendered by AvatarUploadControl -- the hidden
// file input for "Change", the hidden remove-trigger button for
// "Remove" -- so neither duplicates any upload/remove logic or avatar
// state. The actual saving logic for every other item lives entirely in
// the existing DisplayNameControl/ProfileVisibilityControl/CountyControl/
// PreferenceMultiSelectControl/AlertPreferencesControl/BioControl
// components rendered by ProfileSettingsHost -- nothing here duplicates it.
type MenuLink = { label: string; sectionId: SettingsSectionId };

const PROFILE_LINKS: MenuLink[] = [
  { label: "Edit display name", sectionId: "display-name" },
  { label: "Edit bio", sectionId: "bio" },
];

const FARMER_LINKS: MenuLink[] = [
  { label: "Farmer preferences / Location", sectionId: "county" },
  { label: "Crops & crop alerts", sectionId: "crops" },
  { label: "Livestock & other alerts", sectionId: "livestock" },
  { label: "Weather & alert notifications", sectionId: "alerts" },
];

export function ProfileMenu({
  isPublic,
  onSelectSection,
}: {
  isPublic: boolean;
  onSelectSection: (sectionId: SettingsSectionId) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  // Click outside closes the menu -- checked against the whole
  // trigger+panel container, so clicking the three-dot button itself to
  // close it doesn't also immediately reopen it via this same listener.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      firstItemRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function selectSection(sectionId: SettingsSectionId) {
    onSelectSection(sectionId);
    setOpen(false);
  }

  // Clicks AvatarUploadControl's own hidden file input -- that component
  // still owns the only upload implementation and the only avatar state;
  // this never duplicates either, it just triggers the native file picker
  // programmatically instead of relying on a <label htmlFor>.
  function handleChangePhoto() {
    const input = document.getElementById("avatar-file-input");
    if (input instanceof HTMLInputElement) {
      input.click();
    }
    setOpen(false);
  }

  // Clicks AvatarUploadControl's own hidden remove button -- that
  // component still owns the only remove implementation and the only
  // avatar state; this never duplicates either. It no-ops harmlessly when
  // there's no photo to remove, so this item can stay unconditionally
  // visible without this menu needing to track avatar state of its own.
  function handleRemovePhoto() {
    const trigger = document.getElementById("avatar-remove-trigger");
    if (trigger instanceof HTMLButtonElement) {
      trigger.click();
    }
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Profile settings menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex size-9 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green"
      >
        <MoreVertical className="size-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile settings"
          className="absolute right-0 top-full z-10 mt-2 w-64 rounded-shamba border border-shamba-line bg-shamba-card p-1.5 shadow-lg"
        >
          <p className="px-3 pt-1.5 pb-1 font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">
            Profile
          </p>
          <button
            ref={firstItemRef}
            type="button"
            role="menuitem"
            onClick={handleChangePhoto}
            className="block w-full rounded-shamba px-3 py-2 text-left font-sans text-sm text-shamba-ink transition-colors hover:bg-shamba-bg focus:outline-none focus:ring-2 focus:ring-shamba-green"
          >
            Change profile photo
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleRemovePhoto}
            className="block w-full rounded-shamba px-3 py-2 text-left font-sans text-sm text-shamba-ink transition-colors hover:bg-shamba-bg focus:outline-none focus:ring-2 focus:ring-shamba-green"
          >
            Remove profile photo
          </button>
          {PROFILE_LINKS.map((link) => (
            <button
              key={link.sectionId}
              type="button"
              role="menuitem"
              onClick={() => selectSection(link.sectionId)}
              className="block w-full rounded-shamba px-3 py-2 text-left font-sans text-sm text-shamba-ink transition-colors hover:bg-shamba-bg focus:outline-none focus:ring-2 focus:ring-shamba-green"
            >
              {link.label}
            </button>
          ))}

          <div className="my-1.5 border-t border-shamba-line" />

          <p className="px-3 pt-1.5 pb-1 font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">
            Privacy
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => selectSection("visibility")}
            className="block w-full rounded-shamba px-3 py-2 text-left font-sans text-sm text-shamba-ink transition-colors hover:bg-shamba-bg focus:outline-none focus:ring-2 focus:ring-shamba-green"
          >
            <span className="block">Public / Private account</span>
            <span className="block font-mono text-xs text-shamba-ink-soft">
              Currently: {isPublic ? "Public account" : "Private account"}
            </span>
          </button>

          <div className="my-1.5 border-t border-shamba-line" />

          <p className="px-3 pt-1.5 pb-1 font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">
            Farmer settings
          </p>
          {FARMER_LINKS.map((link) => (
            <button
              key={link.sectionId}
              type="button"
              role="menuitem"
              onClick={() => selectSection(link.sectionId)}
              className="block w-full rounded-shamba px-3 py-2 text-left font-sans text-sm text-shamba-ink transition-colors hover:bg-shamba-bg focus:outline-none focus:ring-2 focus:ring-shamba-green"
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
