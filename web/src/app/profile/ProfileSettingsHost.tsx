"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ProfileMenu } from "./ProfileMenu";
import { DisplayNameControl } from "./DisplayNameControl";
import { BioControl } from "./BioControl";
import { ProfileVisibilityControl } from "./ProfileVisibilityControl";
import { CountyControl } from "./CountyControl";
import { PreferenceMultiSelectControl } from "./PreferenceMultiSelectControl";
import { AlertPreferencesControl } from "./AlertPreferencesControl";
import { SETTINGS_SECTION_TITLES, type SettingsSectionId } from "./settingsSections";

type AlertType = "weather" | "pest_disease" | "market_price";

// Owns the one piece of shared state the three-dot menu and the settings
// panel both need: which section (if any) is currently open. Renders the
// menu trigger plus a single full-screen panel that shows exactly one of
// the seven existing controls at a time -- never all seven at once (the
// old always-visible <details> stack). Every control below stays
// mounted for this page's whole lifetime; only which one is visible
// toggles, via a plain CSS class, not conditional mounting -- so a
// farmer who saves a change, closes the panel, and reopens the same item
// still sees what they just saved, not the page's original server-fetched
// value. No control's own save/validation logic is touched.
export function ProfileSettingsHost({
  userId,
  isPublic,
  initialDisplayName,
  initialBio,
  initialVisibility,
  counties,
  initialCountyId,
  cropTypes,
  initialCropIds,
  livestockTypes,
  initialLivestockIds,
  initialEnabledByType,
}: {
  userId: string;
  isPublic: boolean;
  initialDisplayName: string;
  initialBio: string;
  initialVisibility: "public" | "private";
  counties: { id: string; name: string }[];
  initialCountyId: string | null;
  cropTypes: { id: string; name: string }[];
  initialCropIds: string[];
  livestockTypes: { id: string; name: string }[];
  initialLivestockIds: string[];
  initialEnabledByType: Record<AlertType, boolean>;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpen = activeSection !== null;

  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      containerRef.current?.focus();
    }
  }, [isOpen]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setActiveSection(null);
    }
  }

  return (
    <>
      <ProfileMenu isPublic={isPublic} onSelectSection={setActiveSection} />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-settings-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={
          isOpen
            ? "fixed inset-0 z-50 flex flex-col bg-shamba-bg outline-none"
            : "hidden"
        }
      >
        <div className="flex items-center gap-3 border-b border-shamba-line bg-shamba-card px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
          <button
            type="button"
            onClick={() => setActiveSection(null)}
            aria-label="Back to profile"
            className="inline-flex size-9 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <h2
            id="profile-settings-title"
            className="font-display text-base font-semibold text-shamba-ink"
          >
            {activeSection ? SETTINGS_SECTION_TITLES[activeSection] : "Settings"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2 sm:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className={activeSection === "display-name" ? "" : "hidden"}>
              <DisplayNameControl userId={userId} initialDisplayName={initialDisplayName} />
            </div>

            <div className={activeSection === "bio" ? "" : "hidden"}>
              <BioControl userId={userId} initialBio={initialBio} />
            </div>

            <div className={activeSection === "visibility" ? "" : "hidden"}>
              <ProfileVisibilityControl userId={userId} initialVisibility={initialVisibility} />
            </div>

            <div className={activeSection === "county" ? "" : "hidden"}>
              <p className="mt-4 text-sm text-shamba-ink-soft">The county where you farm.</p>
              <CountyControl userId={userId} counties={counties} initialCountyId={initialCountyId} />
            </div>

            <div className={activeSection === "crops" ? "" : "hidden"}>
              <p className="mt-4 text-sm text-shamba-ink-soft">Select the crops you grow.</p>
              <PreferenceMultiSelectControl
                userId={userId}
                tableName="farmer_crop_preferences"
                idColumn="crop_type_id"
                items={cropTypes}
                initialSelectedIds={initialCropIds}
                groupLabel="Crops you grow"
                savedMessage="Crops saved."
              />
            </div>

            <div className={activeSection === "livestock" ? "" : "hidden"}>
              <p className="mt-4 text-sm text-shamba-ink-soft">Select the livestock you keep.</p>
              <PreferenceMultiSelectControl
                userId={userId}
                tableName="farmer_livestock_preferences"
                idColumn="livestock_type_id"
                items={livestockTypes}
                initialSelectedIds={initialLivestockIds}
                groupLabel="Livestock you keep"
                savedMessage="Livestock saved."
              />
            </div>

            <div className={activeSection === "alerts" ? "" : "hidden"}>
              <p className="mt-4 text-sm text-shamba-ink-soft">
                Choose which future alerts you&apos;d like to receive.
              </p>
              <AlertPreferencesControl userId={userId} initialEnabledByType={initialEnabledByType} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
