"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MIN_RECORD_DATE, formatRecordDate, parseRecordDate } from "@/lib/farmRecords";
import {
  MAX_ACTIVITY_DESCRIPTION_LENGTH,
  MAX_ACTIVITY_NOTES_LENGTH,
  MAX_ACTIVITY_QUANTITY,
  MAX_COST_KES,
  MAX_INPUT_PRODUCT_NAME_LENGTH,
  MAX_LABOUR_HOURS,
  MAX_LABOUR_WORKERS,
  MAX_VOID_REASON_LENGTH,
  activityErrorMessage,
  formatKes,
  formatLabour,
  formatQuantity,
  parseAmount,
  splitActivities,
  type ActivityKind,
  type FarmActivity,
  type InputCategory,
  type MeasurementUnit,
} from "@/lib/farmActivities";
import { FormButtons, FormError, INPUT_CLASS, LABEL_CLASS, Optional, type Status } from "../../recordParts";

// The activities on one crop season: oldest first, each opening to its
// full details. Adding inserts into farm_records directly (RLS and the
// table's triggers set the owner and check the kind, date and parents);
// correcting and removing go through correct_farm_record /
// void_farm_record, so a saved activity is never overwritten -- the old
// version stays under "Corrected or removed".
//
// `kinds`, `inputCategories` and `units` are the full lists (to name what
// older records used); the `form*` lists are what can be chosen now.
export function CropActivities({
  farmId,
  seasonId,
  activities,
  kinds,
  formKinds,
  inputCategories,
  formInputCategories,
  units,
  formUnits,
  today,
  readOnlyReason,
}: {
  farmId: string;
  seasonId: string;
  activities: FarmActivity[];
  kinds: ActivityKind[];
  formKinds: ActivityKind[];
  inputCategories: InputCategory[];
  formInputCategories: InputCategory[];
  units: MeasurementUnit[];
  formUnits: MeasurementUnit[];
  today: string;
  readOnlyReason: string | null;
}) {
  const [mode, setMode] = useState<{ kind: "idle" } | { kind: "add" } | { kind: "correct"; id: string } | { kind: "remove"; id: string }>({
    kind: "idle",
  });
  const { current, history } = splitActivities(activities);
  const kindName = (id: string) => kinds.find((kind) => kind.id === id)?.name ?? "Activity";
  const replacedBy = new Set(activities.map((activity) => activity.supersedes_id).filter(Boolean));
  const lists = { kinds, inputCategories, units };
  const formLists = { kinds: formKinds, inputCategories: formInputCategories, units: formUnits };

  return (
    <div>
      {readOnlyReason && <p className="mt-1 text-sm leading-5 text-shamba-ink-soft">{readOnlyReason}</p>}

      {current.length === 0 && mode.kind !== "add" && (
        <p className="mt-1 text-sm leading-5 text-shamba-ink-soft">
          No activities yet. Record the work done on this crop, from preparing the land to harvesting, to keep its
          history in one place.
        </p>
      )}

      {current.length > 0 && (
        <ol aria-label="Activities, oldest first" className="mt-2 flex flex-col divide-y divide-shamba-line">
          {current.map((activity) => (
            <li key={activity.id} className="py-1">
              {mode.kind === "correct" && mode.id === activity.id ? (
                <div className="py-2">
                  <p className="mb-3 font-sans text-sm font-semibold text-shamba-ink">
                    Correct {kindName(activity.kind_id).toLowerCase()} on {formatRecordDate(activity.occurred_on)}
                  </p>
                  <ActivityForm
                    farmId={farmId}
                    seasonId={seasonId}
                    activity={activity}
                    lists={lists}
                    formLists={formLists}
                    today={today}
                    onDone={() => setMode({ kind: "idle" })}
                  />
                </div>
              ) : (
                <ActivityItem
                  activity={activity}
                  kindName={kindName(activity.kind_id)}
                  lists={lists}
                  actions={
                    readOnlyReason ? null : mode.kind === "remove" && mode.id === activity.id ? (
                      <RemoveForm activity={activity} onDone={() => setMode({ kind: "idle" })} />
                    ) : (
                      <div className="-ml-2 mt-2 flex flex-wrap gap-x-1">
                        <button
                          type="button"
                          onClick={() => setMode({ kind: "correct", id: activity.id })}
                          className="inline-flex min-h-11 items-center gap-1.5 px-2 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          Correct
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode({ kind: "remove", id: activity.id })}
                          className="inline-flex min-h-11 items-center gap-1.5 px-2 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-rust"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    )
                  }
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {!readOnlyReason &&
        (mode.kind === "add" ? (
          <div className="mt-3 border-t border-shamba-line pt-3">
            <h3 className="mb-3 font-sans text-sm font-semibold text-shamba-ink">New activity</h3>
            <ActivityForm
              farmId={farmId}
              seasonId={seasonId}
              lists={lists}
              formLists={formLists}
              today={today}
              onDone={() => setMode({ kind: "idle" })}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMode({ kind: "add" })}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-shamba bg-shamba-green px-4 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add activity
          </button>
        ))}

      {history.length > 0 && (
        <details className="mt-4 border-t border-shamba-line pt-1">
          <summary className="flex min-h-11 cursor-pointer items-center font-sans text-sm font-semibold text-shamba-ink-soft hover:text-shamba-ink">
            Corrected or removed ({history.length})
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-shamba-line">
            {history.map((activity) => (
              <li key={activity.id} className="py-2 text-sm text-shamba-ink-soft">
                <p>
                  <span className="font-mono text-xs">{formatRecordDate(activity.occurred_on)}</span> ·{" "}
                  {kindName(activity.kind_id)}
                  {activity.description && ` · ${activity.description}`}
                </p>
                <p className="text-xs">
                  {replacedBy.has(activity.id) ? "Corrected" : "Removed"}: {activity.void_reason}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type Lists = { kinds: ActivityKind[]; inputCategories: InputCategory[]; units: MeasurementUnit[] };

function ActivityItem({
  activity,
  kindName,
  lists,
  actions,
}: {
  activity: FarmActivity;
  kindName: string;
  lists: Lists;
  actions: React.ReactNode;
}) {
  const quantity = activity.quantity !== null ? formatQuantity(activity.quantity, activity.quantity_unit_id, lists.units) : null;
  const inputName = lists.inputCategories.find((category) => category.id === activity.input_category_id)?.name ?? null;
  const input = activity.input_category_id
    ? [
        activity.input_product_name ?? inputName,
        activity.input_quantity !== null ? formatQuantity(activity.input_quantity, activity.input_unit_id, lists.units) : null,
      ]
        .filter(Boolean)
        .join(", ")
    : null;
  const labour = formatLabour(activity.labour_workers, activity.labour_hours);
  const cost = activity.cost_kes !== null ? formatKes(activity.cost_kes) : null;
  const glance = [quantity, input, cost].filter(Boolean).join(" · ");

  const details = [
    { label: activity.kind_id === "harvest" ? "Harvested" : "Amount", value: quantity },
    { label: "Input", value: inputName && activity.input_product_name ? `${inputName}: ${input}` : input },
    { label: "Labour", value: labour },
    { label: "Cost", value: cost },
    { label: "Notes", value: activity.notes },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="w-24 shrink-0 pt-0.5 font-mono text-xs text-shamba-ink-soft">{formatRecordDate(activity.occurred_on)}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-sm font-semibold text-shamba-ink">
            {kindName}
            {activity.description && <span className="font-normal text-shamba-ink"> · {activity.description}</span>}
          </span>
          {glance && <span className="block break-words text-xs leading-5 text-shamba-ink-soft">{glance}</span>}
        </span>
        <ChevronDown className="mt-0.5 size-4 shrink-0 text-shamba-ink-soft transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="pb-2 pl-0 sm:pl-27">
        {details.length > 0 ? (
          <dl className="flex flex-col gap-1.5 rounded-shamba bg-shamba-bg p-3 text-sm">
            {details.map((item) => (
              <div key={item.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 text-shamba-ink-soft sm:w-20">{item.label}</dt>
                <dd className="whitespace-pre-line break-words text-shamba-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-shamba-ink-soft">No other details recorded.</p>
        )}
        {actions}
      </div>
    </details>
  );
}

// Both fields of an amount, or neither.
function pairError(amount: number | null, unit: string, what: string): string | null {
  if (amount !== null && !unit) return `Choose the unit for the ${what}.`;
  if (amount === null && unit) return `Enter the ${what}, or clear its unit.`;
  return null;
}

function ActivityForm({
  farmId,
  seasonId,
  activity,
  lists,
  formLists,
  today,
  onDone,
}: {
  farmId: string;
  seasonId: string;
  activity?: FarmActivity;
  lists: Lists;
  formLists: Lists;
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [kindId, setKindId] = useState(activity?.kind_id ?? "");
  const [occurredOn, setOccurredOn] = useState(activity?.occurred_on ?? today);
  const [description, setDescription] = useState(activity?.description ?? "");
  const [quantity, setQuantity] = useState(activity?.quantity != null ? String(activity.quantity) : "");
  const [quantityUnit, setQuantityUnit] = useState(activity?.quantity_unit_id ?? "");
  const [inputCategory, setInputCategory] = useState(activity?.input_category_id ?? "");
  const [inputProduct, setInputProduct] = useState(activity?.input_product_name ?? "");
  const [inputQuantity, setInputQuantity] = useState(activity?.input_quantity != null ? String(activity.input_quantity) : "");
  const [inputUnit, setInputUnit] = useState(activity?.input_unit_id ?? "");
  const [workers, setWorkers] = useState(activity?.labour_workers != null ? String(activity.labour_workers) : "");
  const [hours, setHours] = useState(activity?.labour_hours != null ? String(activity.labour_hours) : "");
  const [cost, setCost] = useState(activity?.cost_kes != null ? String(activity.cost_kes) : "");
  const [notes, setNotes] = useState(activity?.notes ?? "");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const idPrefix = activity ? `activity-${activity.id}` : "new-activity";
  // A correction may keep a kind, input type or unit that has since been
  // switched off (the database allows that); new choices come from the
  // active lists.
  const withCurrent = <T extends { id: string }>(active: T[], all: T[], ...keep: (string | null | undefined)[]) => [
    ...active,
    ...all.filter((item) => keep.includes(item.id) && !active.some((option) => option.id === item.id)),
  ];
  const kindOptions = withCurrent(formLists.kinds, lists.kinds, activity?.kind_id);
  const categoryOptions = withCurrent(formLists.inputCategories, lists.inputCategories, activity?.input_category_id);
  const unitOptions = withCurrent(formLists.units, lists.units, activity?.quantity_unit_id, activity?.input_unit_id);
  const kind = kindOptions.find((option) => option.id === kindId) ?? null;
  const takesInput = kind !== null && kind.input_mode !== "none";
  const isHarvest = kindId === "harvest";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    const fail = (message: string) => setStatus({ kind: "error", message });

    if (!kindId) return fail("Choose what was done.");
    const date = parseRecordDate(occurredOn, { required: true, field: "date" });
    if (!date.ok) return fail(date.message);
    if (date.value !== null && date.value > today) return fail("The date can't be after today.");
    if (description.trim().length > MAX_ACTIVITY_DESCRIPTION_LENGTH) {
      return fail(`Keep the description to ${MAX_ACTIVITY_DESCRIPTION_LENGTH} characters or fewer.`);
    }

    const amount = parseAmount(quantity, { field: isHarvest ? "amount harvested" : "amount", max: MAX_ACTIVITY_QUANTITY, decimals: 3 });
    if (!amount.ok) return fail(amount.message);
    const amountPair = pairError(amount.value, quantityUnit, isHarvest ? "amount harvested" : "amount");
    if (amountPair) return fail(amountPair);

    const inputAmount = parseAmount(takesInput ? inputQuantity : "", { field: "input amount", max: MAX_ACTIVITY_QUANTITY, decimals: 3 });
    if (!inputAmount.ok) return fail(inputAmount.message);
    const product = takesInput ? inputProduct.trim() : "";
    if (product.length > MAX_INPUT_PRODUCT_NAME_LENGTH) {
      return fail(`Keep the product name to ${MAX_INPUT_PRODUCT_NAME_LENGTH} characters or fewer.`);
    }
    const inputUnitValue = takesInput ? inputUnit : "";
    const category = takesInput ? inputCategory : "";
    if (!category && (product || inputAmount.value !== null || inputUnitValue)) return fail("Choose the type of input used.");
    const inputPair = pairError(inputAmount.value, inputUnitValue, "input amount");
    if (inputPair) return fail(inputPair);

    const labourWorkers = parseAmount(workers, { field: "number of workers", max: MAX_LABOUR_WORKERS, decimals: 0 });
    if (!labourWorkers.ok) return fail(labourWorkers.message);
    const labourHours = parseAmount(hours, { field: "hours", max: MAX_LABOUR_HOURS, decimals: 2 });
    if (!labourHours.ok) return fail(labourHours.message);
    const costKes = parseAmount(cost, { field: "cost", max: MAX_COST_KES, decimals: 2, allowZero: true });
    if (!costKes.ok) return fail(costKes.message);
    if (notes.trim().length > MAX_ACTIVITY_NOTES_LENGTH) {
      return fail(`Keep the notes to ${MAX_ACTIVITY_NOTES_LENGTH} characters or fewer.`);
    }
    if (activity) {
      if (!reason.trim()) return fail("Say why you're correcting this activity.");
      if (reason.trim().length > MAX_VOID_REASON_LENGTH) return fail(`Keep the reason to ${MAX_VOID_REASON_LENGTH} characters or fewer.`);
    }

    setStatus({ kind: "loading" });

    const fields = {
      kind_id: kindId,
      occurred_on: date.value,
      description: description.trim() || null,
      input_category_id: category || null,
      input_product_name: product || null,
      input_quantity: inputAmount.value,
      input_unit_id: inputUnitValue || null,
      quantity: amount.value,
      quantity_unit_id: quantityUnit || null,
      labour_workers: labourWorkers.value,
      labour_hours: labourHours.value,
      cost_kes: costKes.value,
      notes: notes.trim() || null,
    };

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus({ kind: "error", message: "Please sign in again." });
        return;
      }

      const { error } = activity
        ? await supabase.rpc("correct_farm_record", {
            p_record_id: activity.id,
            p_reason: reason.trim(),
            p_kind_id: fields.kind_id,
            p_occurred_on: fields.occurred_on,
            p_crop_season_id: seasonId,
            p_input_category_id: fields.input_category_id,
            p_input_product_name: fields.input_product_name,
            p_input_quantity: fields.input_quantity,
            p_input_unit_id: fields.input_unit_id,
            p_notes: fields.notes,
            p_description: fields.description,
            p_quantity: fields.quantity,
            p_quantity_unit_id: fields.quantity_unit_id,
            p_labour_workers: fields.labour_workers,
            p_labour_hours: fields.labour_hours,
            p_cost_kes: fields.cost_kes,
          })
        : await supabase.from("farm_records").insert({ farm_id: farmId, crop_season_id: seasonId, ...fields });

      if (error) {
        setStatus({ kind: "error", message: activityErrorMessage(error, "We couldn't save this activity. Please try again.") });
        return;
      }

      setStatus({ kind: "idle" });
      onDone();
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Please try again in a moment." });
    }
  }

  const unitSelect = (id: string, value: string, onChange: (value: string) => void, label: string) => (
    <select id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} disabled={isLoading} className={INPUT_CLASS}>
      <option value="">Unit</option>
      {unitOptions.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.name}
        </option>
      ))}
    </select>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-kind`} className={LABEL_CLASS}>
            What was done
          </label>
          <select
            id={`${idPrefix}-kind`}
            value={kindId}
            onChange={(event) => setKindId(event.target.value)}
            required
            autoFocus
            disabled={isLoading}
            className={INPUT_CLASS}
          >
            <option value="">Choose an activity</option>
            {kindOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-date`} className={LABEL_CLASS}>
            Date
          </label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
            min={MIN_RECORD_DATE}
            max={today}
            required
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-description`} className={LABEL_CLASS}>
          Description <Optional />
        </label>
        <input
          id={`${idPrefix}-description`}
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={MAX_ACTIVITY_DESCRIPTION_LENGTH}
          placeholder="e.g. Top dressing on the lower half"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL_CLASS}>
          {isHarvest ? "Amount harvested" : "Amount of work"} <Optional />
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <input
            id={`${idPrefix}-quantity`}
            aria-label={isHarvest ? "Amount harvested" : "Amount of work"}
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder={isHarvest ? "e.g. 12" : "e.g. 2"}
            disabled={isLoading}
            className={INPUT_CLASS}
          />
          {unitSelect(`${idPrefix}-quantity-unit`, quantityUnit, setQuantityUnit, isHarvest ? "Unit harvested" : "Unit of work")}
        </div>
        {!isHarvest && <p className="text-xs leading-5 text-shamba-ink-soft">For example acres weeded or litres of water.</p>}
      </fieldset>

      {takesInput && (
        <fieldset className="flex flex-col gap-2 rounded-shamba border border-shamba-line p-3">
          <legend className={`${LABEL_CLASS} px-1`}>
            Input used{" "}
            {kind?.input_mode === "optional" ? <Optional /> : <span className="font-normal text-shamba-ink-soft">(recommended)</span>}
          </legend>
          <select
            id={`${idPrefix}-input-category`}
            aria-label="Type of input"
            value={inputCategory}
            onChange={(event) => setInputCategory(event.target.value)}
            disabled={isLoading}
            className={INPUT_CLASS}
          >
            <option value="">Type of input</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            id={`${idPrefix}-input-product`}
            aria-label="Product name"
            type="text"
            value={inputProduct}
            onChange={(event) => setInputProduct(event.target.value)}
            maxLength={MAX_INPUT_PRODUCT_NAME_LENGTH}
            placeholder="Product name, e.g. CAN"
            disabled={isLoading}
            className={INPUT_CLASS}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              id={`${idPrefix}-input-quantity`}
              aria-label="Input amount"
              type="text"
              inputMode="decimal"
              value={inputQuantity}
              onChange={(event) => setInputQuantity(event.target.value)}
              placeholder="Amount"
              disabled={isLoading}
              className={INPUT_CLASS}
            />
            {unitSelect(`${idPrefix}-input-unit`, inputUnit, setInputUnit, "Input unit")}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL_CLASS}>
          Labour and cost <Optional />
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idPrefix}-workers`} className="text-xs text-shamba-ink-soft">
              Workers
            </label>
            <input
              id={`${idPrefix}-workers`}
              type="text"
              inputMode="numeric"
              value={workers}
              onChange={(event) => setWorkers(event.target.value)}
              placeholder="e.g. 3"
              disabled={isLoading}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idPrefix}-hours`} className="text-xs text-shamba-ink-soft">
              Hours
            </label>
            <input
              id={`${idPrefix}-hours`}
              type="text"
              inputMode="decimal"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              placeholder="e.g. 4.5"
              disabled={isLoading}
              className={INPUT_CLASS}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <label htmlFor={`${idPrefix}-cost`} className="text-xs text-shamba-ink-soft">
              Cost (KES)
            </label>
            <input
              id={`${idPrefix}-cost`}
              type="text"
              inputMode="decimal"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              placeholder="e.g. 2500"
              disabled={isLoading}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-notes`} className={LABEL_CLASS}>
          Notes <Optional />
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={MAX_ACTIVITY_NOTES_LENGTH}
          rows={3}
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      {activity && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-reason`} className={LABEL_CLASS}>
            Why are you correcting it?
          </label>
          <input
            id={`${idPrefix}-reason`}
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_VOID_REASON_LENGTH}
            placeholder="e.g. Wrong date"
            required
            disabled={isLoading}
            className={INPUT_CLASS}
          />
          <p className="text-xs leading-5 text-shamba-ink-soft">The old version is kept under &ldquo;Corrected or removed&rdquo;.</p>
        </div>
      )}

      <FormError status={status} />
      <FormButtons isLoading={isLoading} submitLabel={activity ? "Save correction" : "Save activity"} onCancel={onDone} />
    </form>
  );
}

// Removing is voiding with a reason: the record stays in the history.
function RemoveForm({ activity, onDone }: { activity: FarmActivity; onDone: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";
  const id = `remove-${activity.id}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    if (!reason.trim()) {
      setStatus({ kind: "error", message: "Say why you're removing this activity." });
      return;
    }
    if (reason.trim().length > MAX_VOID_REASON_LENGTH) {
      setStatus({ kind: "error", message: `Keep the reason to ${MAX_VOID_REASON_LENGTH} characters or fewer.` });
      return;
    }

    setStatus({ kind: "loading" });
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("void_farm_record", { p_record_id: activity.id, p_reason: reason.trim() });
      if (error) {
        setStatus({ kind: "error", message: activityErrorMessage(error, "We couldn't remove this activity. Please try again.") });
        return;
      }
      setStatus({ kind: "idle" });
      onDone();
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Please try again in a moment." });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-3 flex flex-col gap-2 rounded-shamba border border-shamba-rust/30 p-3">
      <label htmlFor={id} className={LABEL_CLASS}>
        Why are you removing it?
      </label>
      <input
        id={id}
        type="text"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={MAX_VOID_REASON_LENGTH}
        placeholder="e.g. Recorded twice"
        autoFocus
        disabled={isLoading}
        className={INPUT_CLASS}
      />
      <p className="text-xs leading-5 text-shamba-ink-soft">It moves to &ldquo;Corrected or removed&rdquo;; nothing is deleted.</p>
      <FormError status={status} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDone}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-shamba border border-shamba-line px-5 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:opacity-70"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-shamba bg-shamba-rust px-5 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-rust/90 disabled:opacity-70"
        >
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isLoading ? "Removing…" : "Remove activity"}
        </button>
      </div>
    </form>
  );
}
