import { inflateRawSync } from "node:zlib";

// Minimal, dependency-free .xlsx reader -- deliberately not a new npm
// dependency (this codebase currently has five runtime dependencies
// total; adding a package just to read one small government export
// felt like the wrong tradeoff). An .xlsx file is a plain ZIP archive
// containing SpreadsheetML XML parts, and Node's built-in `zlib`
// already implements the one compression method (DEFLATE) that
// matters here -- the only genuinely missing piece is the ZIP
// container format itself, which this file implements just enough of:
// find the two parts ingestion actually needs (shared strings + the
// first sheet), nothing more general.
//
// This intentionally does not handle multi-disk archives, ZIP64,
// encryption, or any compression method other than "stored" (0) and
// "deflate" (8) -- KAMIS's own export uses plain single-part DEFLATE,
// confirmed directly during Stage 2B, and this parser is not meant to
// be a general-purpose ZIP/XLSX library.

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

type ZipEntry = {
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The EOCD record is at the end of the file, but a ZIP comment (up to
  // 65535 bytes) can follow it -- scan backward from the end rather
  // than assuming it's the very last 22 bytes.
  const maxCommentSize = 65535;
  const searchStart = Math.max(0, buffer.length - 22 - maxCommentSize);
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      return i;
    }
  }
  throw new Error("Not a valid ZIP/XLSX file: End Of Central Directory record not found");
}

function readCentralDirectory(buffer: Buffer): Map<string, ZipEntry> {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  const entries = new Map<string, ZipEntry>();
  let offset = centralDirOffset;

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error(`Not a valid ZIP/XLSX file: bad central directory entry at index ${i}`);
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf-8");

    entries.set(fileName, { compressionMethod, compressedSize, localHeaderOffset });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function extractEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  if (buffer.readUInt32LE(entry.localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
    throw new Error("Not a valid ZIP/XLSX file: bad local file header");
  }
  // The local header repeats the filename/extra fields, but their
  // lengths can legitimately differ from the central directory's
  // copies -- always read them from the local header itself to find
  // where the actual entry data starts.
  const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return raw;
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(raw);
  }
  throw new Error(`Unsupported ZIP compression method: ${entry.compressionMethod}`);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;

  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const siContent = siMatch[1];
    let combined = "";
    let tMatch: RegExpExecArray | null;
    tRegex.lastIndex = 0;
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      combined += tMatch[1];
    }
    strings.push(decodeXmlEntities(combined));
  }
  return strings;
}

// "A1" -> 0, "B1" -> 1, "AA1" -> 26, etc. Only the column-letter prefix
// of a cell reference is used; the row number isn't needed since rows
// are already grouped by <row> elements.
function columnLetterToIndex(cellRef: string): number {
  const letters = cellRef.match(/^[A-Z]+/)?.[0] ?? "";
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseSheetRows(xml: string, sharedStrings: string[]): (string | null)[][] {
  const rows: (string | null)[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  // Captures the cell's attribute string and its inner content
  // (self-closing empty cells have no inner content at all).
  const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  const valueRegex = /<v>([\s\S]*?)<\/v>/;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1];
    const row: (string | null)[] = [];

    let cellMatch: RegExpExecArray | null;
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attributes = cellMatch[1];
      const innerContent = cellMatch[2] ?? "";

      const refMatch = attributes.match(/\br="([A-Z]+\d+)"/);
      const typeMatch = attributes.match(/\bt="(\w+)"/);
      const columnIndex = refMatch ? columnLetterToIndex(refMatch[1]) : row.length;

      const valueMatch = innerContent.match(valueRegex);
      let value: string | null = valueMatch ? decodeXmlEntities(valueMatch[1]) : null;

      if (value !== null && typeMatch?.[1] === "s") {
        const sharedIndex = Number(value);
        value = sharedStrings[sharedIndex] ?? null;
      }

      while (row.length < columnIndex) {
        row.push(null);
      }
      row[columnIndex] = value;
    }

    rows.push(row);
  }

  return rows;
}

export type XlsxParseResult =
  | { ok: true; header: string[]; rows: (string | null)[][] }
  | { ok: false; error: string };

// Reads the workbook's first sheet only -- KAMIS's export is always a
// single-sheet file, and this parser has no reason to support more.
export function parseXlsxFirstSheet(buffer: Buffer): XlsxParseResult {
  try {
    if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
      return { ok: false, error: "File does not start with a ZIP local file header (not a real .xlsx)" };
    }

    const entries = readCentralDirectory(buffer);
    const sharedStringsEntry = entries.get("xl/sharedStrings.xml");
    const sheetEntry = entries.get("xl/worksheets/sheet1.xml");

    if (!sheetEntry) {
      return { ok: false, error: "xl/worksheets/sheet1.xml not found inside the workbook" };
    }

    const sharedStrings = sharedStringsEntry
      ? parseSharedStrings(extractEntry(buffer, sharedStringsEntry).toString("utf-8"))
      : [];

    const sheetXml = extractEntry(buffer, sheetEntry).toString("utf-8");
    const allRows = parseSheetRows(sheetXml, sharedStrings);

    if (allRows.length === 0) {
      return { ok: false, error: "Worksheet contains no rows at all (not even a header row)" };
    }

    const [headerRow, ...dataRows] = allRows;
    const header = headerRow.map((cell) => (cell ?? "").trim());

    return { ok: true, header, rows: dataRows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `Failed to parse .xlsx file: ${message}` };
  }
}
