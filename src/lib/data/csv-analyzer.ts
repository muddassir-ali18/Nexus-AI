import type {
  CsvBusinessMetrics,
  CsvValidationSummary,
} from "@/lib/data/analysis-types";
import { analyzeSalesRecords } from "@/lib/data/csv-analyzer-core";
import type { ParsedSalesRecord } from "@/lib/data/csv-parse";

export function analyzeSalesCsv(input: {
  fileLabel: string;
  mapping: import("@/lib/data/analysis-types").ColumnMapping;
  records: ParsedSalesRecord[];
  validation: CsvValidationSummary;
}): { metrics: CsvBusinessMetrics; limitations: string[]; warnings: string[] } {
  return analyzeSalesRecords(input);
}
