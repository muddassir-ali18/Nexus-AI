import Papa from "papaparse";

import {
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  type ColumnMapping,
  type CsvValidationSummary,
  type ExcludedRow,
} from "@/lib/data/analysis-types";
import {
  formatMissingColumnsMessage,
  resolveSalesSchema,
} from "@/lib/data/csv-schema";
import { NexusValidationError } from "@/lib/utils/errors";

export type ParsedSalesRecord = {
  rowNumber: number;
  date: Date;
  revenue: number;
  orderId?: string;
  customerId?: string;
  product?: string;
  category?: string;
  region?: string;
  discount?: number;
  promotion?: string;
};

export type CsvParseResult = {
  fileLabel: string;
  mapping: ColumnMapping;
  records: ParsedSalesRecord[];
  validation: CsvValidationSummary;
};

function parseNumericRevenue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/,/g, "").replace(/^\$/, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDateValue(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const isoDate = trimmed.slice(0, 10);
    const parts = isoDate.split("-").map(Number);
    if (parts.length === 3) {
      const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed);
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function validateCsvUpload(
  fileName: string,
  buffer: ArrayBuffer,
): void {
  if (!fileName.toLowerCase().endsWith(".csv")) {
    throw new NexusValidationError("Only .csv files are supported.");
  }

  if (buffer.byteLength === 0) {
    throw new NexusValidationError("The uploaded CSV file is empty.");
  }

  if (buffer.byteLength > CSV_MAX_BYTES) {
    throw new NexusValidationError(
      "CSV file exceeds the 5 MB upload limit.",
    );
  }
}

export function parseSalesCsv(
  fileName: string,
  buffer: ArrayBuffer,
): CsvParseResult {
  validateCsvUpload(fileName, buffer);

  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer).trim();
  if (!text) {
    throw new NexusValidationError("The uploaded CSV file is empty.");
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0];
    throw new NexusValidationError(
      `Malformed CSV near row ${firstError.row ?? "unknown"}: ${firstError.message}`,
    );
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    throw new NexusValidationError("The CSV contains no data rows.");
  }

  if (rows.length > CSV_MAX_ROWS) {
    throw new NexusValidationError(
      `CSV exceeds the maximum of ${CSV_MAX_ROWS.toLocaleString()} data rows.`,
    );
  }

  const headers = parsed.meta.fields ?? Object.keys(rows[0] ?? {});
  if (headers.length === 0) {
    throw new NexusValidationError("The CSV is missing a header row.");
  }

  const schema = resolveSalesSchema(headers);
  if (!schema.ok) {
    throw new NexusValidationError(formatMissingColumnsMessage(schema.missing));
  }

  const mapping = schema.mapping;
  const records: ParsedSalesRecord[] = [];
  const excluded: ExcludedRow[] = [];
  const warnings: string[] = [];
  const seenKeys = new Set<string>();
  let duplicateRowsExcluded = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const dateRaw = row[mapping.date];
    const revenueRaw = row[mapping.revenue];

    if (dateRaw === undefined || revenueRaw === undefined) {
      excluded.push({
        rowNumber,
        reason: "Missing date or revenue value.",
      });
      return;
    }

    const date = parseDateValue(String(dateRaw));
    if (!date) {
      excluded.push({ rowNumber, reason: "Invalid date value." });
      return;
    }

    const revenue = parseNumericRevenue(String(revenueRaw));
    if (revenue === null) {
      excluded.push({ rowNumber, reason: "Invalid numeric revenue value." });
      return;
    }

    const orderId = mapping.orderId
      ? String(row[mapping.orderId] ?? "").trim() || undefined
      : undefined;
    const customerId = mapping.customerId
      ? String(row[mapping.customerId] ?? "").trim() || undefined
      : undefined;
    const discount =
      mapping.discount !== undefined
        ? parseNumericRevenue(String(row[mapping.discount] ?? "")) ?? undefined
        : undefined;
    const promotion = mapping.promotion
      ? String(row[mapping.promotion] ?? "").trim() || undefined
      : undefined;
    const product = mapping.product
      ? String(row[mapping.product] ?? "").trim() || undefined
      : undefined;
    const category = mapping.category
      ? String(row[mapping.category] ?? "").trim() || undefined
      : undefined;
    const region = mapping.region
      ? String(row[mapping.region] ?? "").trim() || undefined
      : undefined;

    const dedupeKey = [
      orderId ?? "no-order",
      monthKey(date),
      revenue.toFixed(4),
      product ?? "",
      category ?? "",
      region ?? "",
    ].join("|");

    if (seenKeys.has(dedupeKey)) {
      duplicateRowsExcluded += 1;
      excluded.push({
        rowNumber,
        reason: "Duplicate record detected and excluded.",
      });
      return;
    }
    seenKeys.add(dedupeKey);

    records.push({
      rowNumber,
      date,
      revenue,
      orderId,
      customerId,
      product,
      category,
      region,
      discount,
      promotion,
    });
  });

  if (duplicateRowsExcluded > 0) {
    warnings.push(
      `${duplicateRowsExcluded} duplicate row(s) were excluded from analysis.`,
    );
  }

  if (records.length === 0) {
    throw new NexusValidationError(
      "No valid sales records remained after validation.",
    );
  }

  const validation: CsvValidationSummary = {
    totalRowsRead: rows.length,
    includedRows: records.length,
    excludedRows: excluded.length,
    duplicateRowsExcluded,
    excludedSample: excluded.slice(0, 50),
    detectedColumns: mapping,
    warnings,
  };

  return {
    fileLabel: fileName,
    mapping,
    records,
    validation,
  };
}
