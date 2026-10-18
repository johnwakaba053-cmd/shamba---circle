"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DOCUMENT_COLUMNS,
  EXPERT_DOCUMENTS_BUCKET,
  expertErrorMessage,
  fileProblem,
  removeExpertDocument,
  uploadExpertDocument,
  type ExpertDocument,
} from "@/lib/experts";
import { DocumentCard, FilePickButton } from "../documentParts";
import { ErrorText, StepActions, type Status, type StepProps } from "../formParts";

// Step 6: the CV, one PDF. The database allows exactly one CV record per
// application, so replacing it removes the old record first, uploads the
// new file, then deletes the old file. If the new upload fails, the old
// record is put back (its file is still there), so the farmer never loses
// the CV they had.
export function CvStep({ profileId, parts, setParts, goTo }: StepProps) {
  const app = parts.application!;
  const cv = parts.documents.find((document) => document.kind === "cv") ?? null;
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [removing, setRemoving] = useState(false);
  const isUploading = status.kind === "loading";

  function replaceDocuments(remove: ExpertDocument | null, add: ExpertDocument | null) {
    setParts((current) => ({
      ...current,
      documents: [...current.documents.filter((document) => document.id !== remove?.id), ...(add ? [add] : [])],
    }));
  }

  async function handleFile(file: File) {
    if (isUploading || removing) return;
    const problem = fileProblem(file, "cv");
    if (problem) {
      setStatus({ kind: "error", message: problem });
      return;
    }

    setStatus({ kind: "loading" });
    try {
      const supabase = createClient();

      if (cv) {
        const { error } = await supabase.from("expert_documents").delete().eq("id", cv.id);
        if (error) {
          setStatus({ kind: "error", message: expertErrorMessage(error, "We couldn't replace your CV. Please try again.") });
          return;
        }
      }

      const result = await uploadExpertDocument(supabase, { profileId, applicationId: app.id, kind: "cv", file });

      if (!result.ok) {
        if (cv) {
          const { data: restored } = await supabase
            .from("expert_documents")
            .insert({ application_id: app.id, profile_id: profileId, kind: "cv", storage_path: cv.storage_path, file_name: cv.file_name })
            .select(DOCUMENT_COLUMNS)
            .single();
          replaceDocuments(cv, (restored as ExpertDocument | null) ?? null);
        }
        setStatus({ kind: "error", message: result.message });
        return;
      }

      if (cv) {
        await supabase.storage.from(EXPERT_DOCUMENTS_BUCKET).remove([cv.storage_path]);
      }
      replaceDocuments(cv, result.document);
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    }
  }

  async function handleRemove() {
    if (!cv || removing || isUploading) return;
    setRemoving(true);
    setStatus({ kind: "idle" });
    try {
      const result = await removeExpertDocument(createClient(), cv);
      if (!result.ok) {
        setStatus({ kind: "error", message: result.message });
        return;
      }
      replaceDocuments(cv, null);
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base leading-6 text-shamba-ink-soft">
        Upload your CV as a PDF, up to 10 MB. It helps our team check your experience.
      </p>

      {cv ? (
        <DocumentCard
          document={cv}
          actions={
            <>
              <FilePickButton
                id="expert-cv-replace"
                accept="application/pdf,.pdf"
                label="Replace"
                busy={isUploading}
                disabled={removing}
                onFile={handleFile}
              />
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing || isUploading}
                className="inline-flex min-h-11 items-center font-sans text-sm font-semibold text-shamba-rust hover:underline disabled:opacity-70"
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            </>
          }
        />
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-shamba border border-dashed border-shamba-line bg-shamba-bg px-4 py-5">
          <FilePickButton
            id="expert-cv"
            accept="application/pdf,.pdf"
            label="Choose your CV (PDF)"
            busy={isUploading}
            onFile={handleFile}
          />
          <p className="text-xs leading-4 text-shamba-ink-soft">On a slow connection this can take a minute. Keep this page open.</p>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs leading-4 text-shamba-ink-soft">
        <Lock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Only you and Shamba Space reviewers can see your CV. It&apos;s never shown on your profile.
      </p>

      <ErrorText status={status} />

      <StepActions
        onBack={() => goTo("experience")}
        primaryLabel={cv ? "Continue" : "Skip for now"}
        primaryType="button"
        onPrimary={() => goTo("languages")}
        disabled={isUploading || removing}
      />
    </div>
  );
}
