import { parseSalesCsv, validateCsvUpload } from "@/lib/data/csv-parse";
import type { CsvAttachment } from "@/lib/tools/types";

/**
 * Validates upload constraints and CSV readability using the same rules as analyze-csv.
 * Does not persist data; returns request-scoped attachment bytes.
 */
export function buildValidatedCsvAttachment(
  fileName: string,
  buffer: ArrayBuffer,
): CsvAttachment {
  validateCsvUpload(fileName, buffer);
  parseSalesCsv(fileName, buffer);
  return {
    fileName: fileName.trim() || "upload.csv",
    buffer,
  };
}
