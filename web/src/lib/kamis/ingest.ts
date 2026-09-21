import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchKamisExport,
  hasXlsxMagicBytes,
  KAMIS_SEARCH_ENDPOINT,
  WHITELISTED_KAMIS_PRODUCTS,
  type KamisFetchParams,
} from "./client";
import { normalizeForMatching, parseKamisPrice, toRecordedAtUtcMidnight } from "./normalize";
import { parseXlsxFirstSheet } from "./xlsxParser";

// Server-only orchestration for one controlled KAMIS import. Requires
// the service-role client throughout (createAdminClient) because the
// four ingestion-control tables grant `authenticated` no policy at all
// (Stage 4) -- this module is never reachable from anything but the
// secret-gated internal route handler that calls it.
//
// This is Stage 5's manual/test-mode importer specifically: no market
// is ever auto-created (an unmatched market is quarantined, full stop
// -- see the "known county + unknown market -> quarantine" policy),
// and no product is ever auto-mapped (an unmapped commodity is
// quarantined too). Both of those decisions are deliberately conservative
// for this stage and are expected, in practice, to quarantine
// everything a first real test run touches, since both
// agricultural_markets and agricultural_price_source_product_map are
// still empty at the time this was written -- that is the correct,
// safe outcome, not a bug.

const KAMIS_SOURCE_ID = "kamis";

const REQUIRED_HEADERS = [
  "Commodity",
  "Classification",
  "Grade",
  "Sex",
  "Market",
  "Wholesale",
  "Retail",
  "Supply Volume",
  "County",
  "Date",
];

type RawKamisRow = {
  Commodity: string | null;
  Classification: string | null;
  Grade: string | null;
  Sex: string | null;
  Market: string | null;
  Wholesale: string | null;
  Retail: string | null;
  "Supply Volume": string | null;
  County: string | null;
  Date: string | null;
};

export type IngestKamisPricesResult = {
  runId: string | null;
  status: "completed" | "failed" | "partial";
  errorMessage: string | null;
  rowsDownloaded: number;
  rowsAccepted: number;
  rowsDuplicateSkipped: number;
  rowsConflicted: number;
  rowsRejected: number;
  rejectionReasons: Record<string, number>;
  wholesaleInserted: number;
  retailInserted: number;
  productsEncountered: string[];
  marketsEncountered: string[];
  countiesEncountered: string[];
};

function emptyResult(status: "failed", errorMessage: string, runId: string | null): IngestKamisPricesResult {
  return {
    runId,
    status,
    errorMessage,
    rowsDownloaded: 0,
    rowsAccepted: 0,
    rowsDuplicateSkipped: 0,
    rowsConflicted: 0,
    rowsRejected: 0,
    rejectionReasons: {},
    wholesaleInserted: 0,
    retailInserted: 0,
    productsEncountered: [],
    marketsEncountered: [],
    countiesEncountered: [],
  };
}

export async function ingestKamisPrices(params: KamisFetchParams): Promise<IngestKamisPricesResult> {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  // The run row is created FIRST, before anything that could fail --
  // per Stage 4/Part 6, the run must remain auditable even when the
  // import fails immediately afterward.
  const { data: run, error: runInsertError } = await supabase
    .from("agricultural_price_ingestion_runs")
    .insert({
      source_id: KAMIS_SOURCE_ID,
      started_at: startedAt,
      status: "running",
      endpoint: KAMIS_SEARCH_ENDPOINT,
      query_params: params,
    })
    .select("id")
    .single();

  if (runInsertError || !run) {
    // Nothing downstream can be audited if even the run row itself
    // can't be created -- this is the one failure mode with no run id
    // to report against.
    return emptyResult("failed", `Could not create ingestion run row: ${runInsertError?.message}`, null);
  }

  const runId = run.id as string;

  async function finalizeRun(
    status: "completed" | "failed" | "partial",
    fields: Record<string, unknown>,
  ) {
    const { error } = await supabase
      .from("agricultural_price_ingestion_runs")
      .update({ status, completed_at: new Date().toISOString(), ...fields })
      .eq("id", runId);
    if (error) {
      console.error("Failed to finalize agricultural_price_ingestion_runs row", runId, error);
    }
  }

  try {
    // === Download ============================================================
    const downloadResult = await fetchKamisExport(params);
    if (!downloadResult.ok) {
      await finalizeRun("failed", { error_message: downloadResult.error });
      return emptyResult("failed", downloadResult.error, runId);
    }

    if (!hasXlsxMagicBytes(downloadResult.buffer)) {
      const message =
        "Downloaded file does not have valid XLSX/ZIP magic bytes -- KAMIS likely returned an HTML or error page instead of the export. Aborting without parsing.";
      await finalizeRun("failed", { error_message: message });
      return emptyResult("failed", message, runId);
    }

    // === Parse ================================================================
    const parseResult = parseXlsxFirstSheet(downloadResult.buffer);
    if (!parseResult.ok) {
      await finalizeRun("failed", { error_message: parseResult.error });
      return emptyResult("failed", parseResult.error, runId);
    }

    // === Header validation (parse by name, never by position) ================
    const headerIndex: Record<string, number> = {};
    parseResult.header.forEach((name, i) => {
      headerIndex[name.trim()] = i;
    });
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !(h in headerIndex));
    if (missingHeaders.length > 0) {
      const message = `Schema drift detected: missing required column(s) [${missingHeaders.join(", ")}]. Aborting without processing any rows.`;
      await finalizeRun("failed", { error_message: message });
      return emptyResult("failed", message, runId);
    }

    const rowsDownloaded = parseResult.rows.length;

    // === Preload reference data ===============================================
    const [{ data: countiesData }, { data: marketsData }, { data: mappingsData }] = await Promise.all([
      supabase.from("counties").select("id, name"),
      supabase.from("agricultural_markets").select("id, name, county_id"),
      supabase
        .from("agricultural_price_source_product_map")
        .select("source_commodity_id, source_classification, source_grade, source_sex, product_id")
        .eq("source_id", KAMIS_SOURCE_ID),
    ]);

    const countyIdByNormalizedName = new Map<string, string>(
      (countiesData ?? []).map((c) => [normalizeForMatching(c.name), c.id]),
    );
    const marketIdByKey = new Map<string, string>(
      (marketsData ?? []).map((m) => [`${normalizeForMatching(m.name)}::${m.county_id}`, m.id]),
    );
    // Stage 8A: the mapping key grew from 2 parts (commodity,
    // classification) to 4 (+ grade, sex) so KAMIS's own breed/grade/sex
    // variants for livestock can each route to their own product_id --
    // see the Stage 8 design report. source_grade/source_sex default to
    // '-' for every commodity that never populates KAMIS's Grade/Sex
    // columns (every crop onboarded so far), so this is a strict
    // widening of the old key, not a behavior change for them: a row
    // whose gradeRaw/sexRaw are both '-' composes exactly the same key
    // it always did, just with two more '-' segments appended.
    const productIdByMappingKey = new Map<string, string>(
      (mappingsData ?? []).map((m) => [
        `${m.source_commodity_id}::${normalizeForMatching(m.source_classification)}::${normalizeForMatching(m.source_grade)}::${normalizeForMatching(m.source_sex)}`,
        m.product_id,
      ]),
    );
    // The export returns the commodity NAME ("Dry Maize"), not KAMIS's
    // own numeric id -- reconstructed here only from the whitelisted
    // ids actually requested for this run, never from the full
    // whitelist, so a returned commodity we didn't ask for is treated
    // as unmapped rather than silently resolved.
    const kamisProductIdByNormalizedName = new Map<string, string>(
      params.productIds.map((id) => [normalizeForMatching(WHITELISTED_KAMIS_PRODUCTS[id]), id]),
    );

    // === Row processing ========================================================
    let rowsAccepted = 0;
    let rowsDuplicateSkipped = 0;
    let rowsConflicted = 0;
    let rowsRejected = 0;
    let wholesaleInserted = 0;
    let retailInserted = 0;
    const rejectionReasons: Record<string, number> = {};
    const productsEncountered = new Set<string>();
    const marketsEncountered = new Set<string>();
    const countiesEncountered = new Set<string>();
    const quarantineRows: Record<string, unknown>[] = [];
    const conflictRows: Record<string, unknown>[] = [];

    function recordRejection(reason: string) {
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
      rowsRejected += 1;
    }

    for (const cells of parseResult.rows) {
      const col = (name: string) => cells[headerIndex[name]] ?? null;
      const rawRow: RawKamisRow = {
        Commodity: col("Commodity"),
        Classification: col("Classification"),
        Grade: col("Grade"),
        Sex: col("Sex"),
        Market: col("Market"),
        Wholesale: col("Wholesale"),
        Retail: col("Retail"),
        "Supply Volume": col("Supply Volume"),
        County: col("County"),
        Date: col("Date"),
      };

      function quarantine(reason: string, conflictingPriceId?: string) {
        recordRejection(reason);
        quarantineRows.push({
          run_id: runId,
          reason,
          raw_row: rawRow,
          conflicting_price_id: conflictingPriceId ?? null,
          reviewed: false,
        });
      }

      const commodityRaw = (rawRow.Commodity ?? "").trim();
      const classificationRaw = (rawRow.Classification ?? "").trim();
      const gradeRaw = (rawRow.Grade ?? "").trim();
      const sexRaw = (rawRow.Sex ?? "").trim();
      const marketRaw = (rawRow.Market ?? "").trim();
      const countyRaw = (rawRow.County ?? "").trim();
      const dateRaw = (rawRow.Date ?? "").trim();
      const supplyVolumeRaw = (rawRow["Supply Volume"] ?? "").trim();

      // -- Date -----------------------------------------------------------------
      const recordedAt = toRecordedAtUtcMidnight(dateRaw);
      if (!recordedAt) {
        quarantine("invalid_date");
        continue;
      }

      // -- County (existing counties table only; never inferred, never created) -
      if (!countyRaw) {
        quarantine("blank_county");
        continue;
      }
      const countyId = countyIdByNormalizedName.get(normalizeForMatching(countyRaw));
      if (!countyId) {
        // Catches "test" naturally, along with any genuinely unknown value --
        // no special-case string comparison needed.
        quarantine("unknown_county");
        continue;
      }
      countiesEncountered.add(countyRaw);

      // -- Market (must already exist; never auto-created, never fuzzy-matched) -
      if (!marketRaw) {
        quarantine("blank_market");
        continue;
      }
      marketsEncountered.add(marketRaw);
      const marketId = marketIdByKey.get(`${normalizeForMatching(marketRaw)}::${countyId}`);
      if (!marketId) {
        quarantine("unknown_market");
        continue;
      }

      // -- Product mapping (curated table only; never guessed) -------------------
      if (!commodityRaw) {
        quarantine("unmapped_product");
        continue;
      }
      productsEncountered.add(`${commodityRaw} / ${classificationRaw || "(no classification)"}`);
      const kamisProductId = kamisProductIdByNormalizedName.get(normalizeForMatching(commodityRaw));
      if (!kamisProductId) {
        quarantine("unmapped_product");
        continue;
      }
      const productId = productIdByMappingKey.get(
        `${kamisProductId}::${normalizeForMatching(classificationRaw)}::${normalizeForMatching(gradeRaw)}::${normalizeForMatching(sexRaw)}`,
      );
      if (!productId) {
        quarantine("unmapped_product");
        continue;
      }

      // -- Prices: wholesale and/or retail, fully independent --------------------
      const priceEntries: Array<["wholesale" | "retail", string | null]> = [
        ["wholesale", rawRow.Wholesale],
        ["retail", rawRow.Retail],
      ];

      for (const [priceType, rawPrice] of priceEntries) {
        const parsed = parseKamisPrice(rawPrice);
        if (parsed.kind === "none") {
          continue; // No observation for this price_type -- not an error, not zero.
        }
        if (parsed.kind !== "valid") {
          quarantine(parsed.kind);
          continue;
        }

        // Checked directly against the database (not a preloaded snapshot)
        // so that a duplicate/conflict is caught correctly whether it's
        // against a previous run OR an earlier row already inserted
        // earlier in this very run.
        const { data: existing, error: existingError } = await supabase
          .from("agricultural_prices")
          .select("id, price")
          .eq("product_id", productId)
          .eq("market_id", marketId)
          .eq("source_id", KAMIS_SOURCE_ID)
          .eq("price_type", priceType)
          .eq("recorded_at", recordedAt)
          .maybeSingle();

        if (existingError) {
          quarantine("lookup_failed");
          continue;
        }

        if (existing) {
          if (Number(existing.price) === parsed.value) {
            rowsDuplicateSkipped += 1;
          } else {
            rowsConflicted += 1;
            conflictRows.push({
              run_id: runId,
              existing_price_id: existing.id,
              source_id: KAMIS_SOURCE_ID,
              product_id: productId,
              market_id: marketId,
              price_type: priceType,
              recorded_at: recordedAt,
              existing_price: existing.price,
              incoming_price: parsed.value,
              raw_row: rawRow,
              reviewed: false,
            });
          }
          continue;
        }

        const metadata = {
          kamis: {
            commodity_id: kamisProductId,
            commodity_name_raw: commodityRaw,
            classification_raw: classificationRaw,
            grade_raw: gradeRaw,
            sex_raw: sexRaw,
            supply_volume_raw: supplyVolumeRaw || null,
            price_raw: rawPrice,
            county_raw: countyRaw,
            market_raw: marketRaw,
            date_raw: dateRaw,
          },
          ingestion: {
            run_id: runId,
            endpoint: KAMIS_SEARCH_ENDPOINT,
            query_params: params,
            ingested_at: new Date().toISOString(),
          },
        };

        const { error: insertError } = await supabase.from("agricultural_prices").insert({
          product_id: productId,
          market_id: marketId,
          source_id: KAMIS_SOURCE_ID,
          price: parsed.value,
          price_type: priceType,
          recorded_at: recordedAt,
          metadata,
        });

        if (insertError) {
          quarantine("insert_failed");
          continue;
        }

        rowsAccepted += 1;
        if (priceType === "wholesale") wholesaleInserted += 1;
        else retailInserted += 1;
      }
    }

    // === Persist quarantine/conflict rows (bulk, order doesn't matter here) ===
    if (quarantineRows.length > 0) {
      const { error } = await supabase.from("agricultural_price_ingestion_quarantine").insert(quarantineRows);
      if (error) console.error("Failed to insert quarantine rows for run", runId, error);
    }
    if (conflictRows.length > 0) {
      const { error } = await supabase.from("agricultural_price_ingestion_conflicts").insert(conflictRows);
      if (error) console.error("Failed to insert conflict rows for run", runId, error);
    }

    const finalStatus: "completed" | "partial" = rowsRejected > 0 || rowsConflicted > 0 ? "partial" : "completed";

    await finalizeRun(finalStatus, {
      rows_downloaded: rowsDownloaded,
      rows_accepted: rowsAccepted,
      rows_duplicate_skipped: rowsDuplicateSkipped,
      rows_conflicted: rowsConflicted,
      rows_rejected: rowsRejected,
      rejection_reasons: rejectionReasons,
    });

    return {
      runId,
      status: finalStatus,
      errorMessage: null,
      rowsDownloaded,
      rowsAccepted,
      rowsDuplicateSkipped,
      rowsConflicted,
      rowsRejected,
      rejectionReasons,
      wholesaleInserted,
      retailInserted,
      productsEncountered: Array.from(productsEncountered),
      marketsEncountered: Array.from(marketsEncountered),
      countiesEncountered: Array.from(countiesEncountered),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await finalizeRun("failed", { error_message: message });
    return emptyResult("failed", message, runId);
  }
}
