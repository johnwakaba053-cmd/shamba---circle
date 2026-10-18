"use client";

import { useState } from "react";
import { Lock, Paperclip, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_CREDENTIAL_NUMBER_LENGTH,
  MAX_NAME_LENGTH,
  MAX_QUALIFICATIONS,
  QUALIFICATION_COLUMNS,
  expertErrorMessage,
  fileProblem,
  formatFileSize,
  formatMonth,
  removeExpertDocument,
  uploadExpertDocument,
  type ExpertDocument,
  type QualificationEntry,
} from "@/lib/experts";
import { DocumentCard, FilePickButton } from "../documentParts";
import {
  EntryFormActions,
  EntryRow,
  ErrorText,
  Field,
  INPUT_CLASS,
  StepActions,
  textOrNull,
  type Status,
  type StepProps,
} from "../formParts";

// Step 4 (optional): professional qualifications, licences and
// certificates, each with an optional supporting file (PDF, JPEG or PNG).
// Credential numbers and files are private to the applicant and
// reviewers.
export function QualificationsStep({ profileId, parts, setParts, goTo }: StepProps) {
  const app = parts.application!;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function documentFor(entry: QualificationEntry): ExpertDocument | null {
    return parts.documents.find((document) => document.id === entry.document_id) ?? null;
  }

  function applySaved(saved: QualificationEntry, added: ExpertDocument | null, removed: ExpertDocument | null) {
    setParts((current) => ({
      ...current,
      qualifications: current.qualifications.some((item) => item.id === saved.id)
        ? current.qualifications.map((item) => (item.id === saved.id ? saved : item))
        : [...current.qualifications, saved],
      documents: [...current.documents.filter((document) => document.id !== removed?.id), ...(added ? [added] : [])],
    }));
    setEditing(null);
  }

  async function remove(entry: QualificationEntry) {
    if (removingId) return;
    setRemovingId(entry.id);
    setStatus({ kind: "idle" });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("expert_qualifications").delete().eq("id", entry.id).select("id");
      if (error || !data?.length) {
        setStatus({
          kind: "error",
          message: error
            ? expertErrorMessage(error, "We couldn't remove that qualification. Please try again.")
            : "This application can't be changed right now. Refresh the page to see its status.",
        });
        return;
      }
      const document = documentFor(entry);
      if (document) await removeExpertDocument(supabase, document);
      setParts((current) => ({
        ...current,
        qualifications: current.qualifications.filter((item) => item.id !== entry.id),
        documents: current.documents.filter((item) => item.id !== document?.id),
      }));
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base leading-6 text-shamba-ink-soft">
        Add professional licences and certificates, such as a Kenya Veterinary Board licence or a pest control
        certificate. This step is optional, but certificates help our team verify you faster.
      </p>

      {parts.qualifications.length > 0 && (
        <ul className="flex flex-col divide-y divide-shamba-line border-y border-shamba-line">
          {parts.qualifications.map((entry) => {
            const document = documentFor(entry);
            return editing === entry.id ? (
              <li key={entry.id} className="py-3">
                <QualificationForm
                  applicationId={app.id}
                  profileId={profileId}
                  entry={entry}
                  existingDocument={document}
                  onSaved={applySaved}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <EntryRow
                key={entry.id}
                title={entry.title}
                lines={[
                  entry.issuing_body,
                  ...(entry.issued_on ? [<span key="issued" className="font-mono text-xs">Issued {formatMonth(entry.issued_on)}</span>] : []),
                  ...(document
                    ? [
                        <span key="file" className="inline-flex items-center gap-1">
                          <Paperclip className="size-3.5" aria-hidden="true" />
                          {document.file_name}
                        </span>,
                      ]
                    : []),
                ]}
                onEdit={() => setEditing(entry.id)}
                onRemove={() => remove(entry)}
                removing={removingId === entry.id}
                disabled={editing !== null || removingId !== null}
              />
            );
          })}
        </ul>
      )}

      {editing === "new" ? (
        <div className="rounded-shamba border border-shamba-line bg-shamba-bg/40 p-4">
          <QualificationForm
            applicationId={app.id}
            profileId={profileId}
            existingDocument={null}
            onSaved={applySaved}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        editing === null &&
        parts.qualifications.length < MAX_QUALIFICATIONS && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex min-h-11 items-center gap-1.5 self-start font-sans text-sm font-semibold text-shamba-green hover:underline"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a qualification or certificate
          </button>
        )
      )}

      <ErrorText status={status} />

      {editing !== null && (
        <p className="text-xs leading-4 text-shamba-ink-soft">Save or cancel the entry you&apos;re editing to continue.</p>
      )}

      <StepActions
        onBack={() => goTo("education")}
        primaryLabel={parts.qualifications.length === 0 ? "Skip this step" : "Continue"}
        primaryType="button"
        onPrimary={() => goTo("experience")}
        disabled={editing !== null}
      />
    </div>
  );
}

function QualificationForm({
  applicationId,
  profileId,
  entry,
  existingDocument,
  onSaved,
  onCancel,
}: {
  applicationId: string;
  profileId: string;
  entry?: QualificationEntry;
  existingDocument: ExpertDocument | null;
  onSaved: (entry: QualificationEntry, added: ExpertDocument | null, removed: ExpertDocument | null) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [issuingBody, setIssuingBody] = useState(entry?.issuing_body ?? "");
  const [credentialNumber, setCredentialNumber] = useState(entry?.credential_number ?? "");
  const [issuedOn, setIssuedOn] = useState(entry?.issued_on ?? "");
  const [expiresOn, setExpiresOn] = useState(entry?.expires_on ?? "");
  // A newly chosen file (uploaded on save), and whether the existing one
  // should be dropped.
  const [newFile, setNewFile] = useState<File | null>(null);
  const [dropExisting, setDropExisting] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";
  const idPrefix = entry ? `qualification-${entry.id}` : "qualification-new";
  const keptDocument = dropExisting || newFile ? null : existingDocument;

  function chooseFile(file: File) {
    const problem = fileProblem(file, "certificate");
    if (problem) {
      setStatus({ kind: "error", message: problem });
      return;
    }
    setStatus({ kind: "idle" });
    setNewFile(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    if (!title.trim()) return setStatus({ kind: "error", message: "Enter the name of the qualification or certificate." });
    if (!issuingBody.trim()) return setStatus({ kind: "error", message: "Enter who issued it." });
    if (issuedOn && expiresOn && expiresOn < issuedOn) {
      return setStatus({ kind: "error", message: "The expiry date can't be before the date it was issued." });
    }

    setStatus({ kind: "loading" });
    try {
      const supabase = createClient();

      let uploaded: ExpertDocument | null = null;
      if (newFile) {
        const result = await uploadExpertDocument(supabase, { profileId, applicationId, kind: "certificate", file: newFile });
        if (!result.ok) {
          setStatus({ kind: "error", message: result.message });
          return;
        }
        uploaded = result.document;
      }

      const fields = {
        title: title.trim(),
        issuing_body: issuingBody.trim(),
        credential_number: textOrNull(credentialNumber),
        issued_on: issuedOn || null,
        expires_on: expiresOn || null,
        document_id: uploaded?.id ?? keptDocument?.id ?? null,
      };

      const { data, error } = entry
        ? await supabase.from("expert_qualifications").update(fields).eq("id", entry.id).select(QUALIFICATION_COLUMNS).maybeSingle()
        : await supabase
            .from("expert_qualifications")
            .insert({ application_id: applicationId, profile_id: profileId, ...fields })
            .select(QUALIFICATION_COLUMNS)
            .single();

      if (error || !data) {
        // Don't leave the just-uploaded file behind.
        if (uploaded) await removeExpertDocument(supabase, uploaded);
        setStatus({
          kind: "error",
          message: error
            ? expertErrorMessage(error, "We couldn't save this qualification. Please try again.")
            : "This application can't be changed right now. Refresh the page to see its status.",
        });
        return;
      }

      // The old file is no longer linked: remove it.
      const replaced = existingDocument && existingDocument.id !== fields.document_id ? existingDocument : null;
      if (replaced) await removeExpertDocument(supabase, replaced);

      onSaved(data as QualificationEntry, uploaded, replaced);
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id={`${idPrefix}-title`} label="Qualification, licence or certificate">
        <input
          id={`${idPrefix}-title`}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Veterinary surgeon licence"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </Field>
      <Field id={`${idPrefix}-issuer`} label="Issued by">
        <input
          id={`${idPrefix}-issuer`}
          type="text"
          value={issuingBody}
          onChange={(event) => setIssuingBody(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Kenya Veterinary Board"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </Field>
      <Field
        id={`${idPrefix}-number`}
        label="Certificate or licence number"
        optional
        hint={
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" aria-hidden="true" />
            Private. Only Shamba Space reviewers see this.
          </span>
        }
      >
        <input
          id={`${idPrefix}-number`}
          type="text"
          value={credentialNumber}
          onChange={(event) => setCredentialNumber(event.target.value)}
          maxLength={MAX_CREDENTIAL_NUMBER_LENGTH}
          autoComplete="off"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field id={`${idPrefix}-issued`} label="Date issued" optional>
          <input
            id={`${idPrefix}-issued`}
            type="date"
            value={issuedOn}
            onChange={(event) => setIssuedOn(event.target.value)}
            min="1950-01-01"
            max="2100-12-31"
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </Field>
        <Field id={`${idPrefix}-expires`} label="Expiry date" optional>
          <input
            id={`${idPrefix}-expires`}
            type="date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
            min="1950-01-01"
            max="2100-12-31"
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-sans text-sm font-semibold text-shamba-ink">
          Certificate file <span className="font-normal text-shamba-ink-soft">(optional)</span>
        </p>
        {keptDocument && (
          <DocumentCard
            document={keptDocument}
            actions={
              <button
                type="button"
                onClick={() => setDropExisting(true)}
                disabled={isLoading}
                className="inline-flex min-h-11 items-center font-sans text-sm font-semibold text-shamba-rust hover:underline disabled:opacity-70"
              >
                Remove file
              </button>
            }
          />
        )}
        {newFile && (
          <div className="flex items-center justify-between gap-3 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-2">
            <div className="min-w-0">
              <p className="break-all text-sm font-semibold text-shamba-ink">{newFile.name}</p>
              <p className="font-mono text-xs text-shamba-ink-soft">{formatFileSize(newFile.size)} · uploads when you save</p>
            </div>
            <button
              type="button"
              onClick={() => setNewFile(null)}
              disabled={isLoading}
              className="inline-flex min-h-11 shrink-0 items-center font-sans text-sm font-semibold text-shamba-rust hover:underline disabled:opacity-70"
            >
              Remove
            </button>
          </div>
        )}
        {!keptDocument && !newFile && (
          <div className="flex flex-col items-start gap-1">
            <FilePickButton
              id={`${idPrefix}-file`}
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              label="Choose a file"
              busy={false}
              disabled={isLoading}
              onFile={chooseFile}
            />
            <p className="text-xs leading-4 text-shamba-ink-soft">PDF, JPEG or PNG, up to 10 MB. A clear photo of the certificate is fine.</p>
          </div>
        )}
      </div>

      <ErrorText status={status} />
      <EntryFormActions busy={isLoading} onCancel={onCancel} saveLabel={entry ? "Save changes" : "Add"} />
    </form>
  );
}
