import type {
  AnalysisEvidence,
  CsvBusinessMetrics,
  CsvValidationSummary,
} from "@/lib/data/analysis-types";
import { analyzeSalesCsv } from "@/lib/data/csv-analyzer";
import { buildCsvAnalysisEvidence } from "@/lib/data/csv-evidence";
import { parseSalesCsv } from "@/lib/data/csv-parse";

export type DeterministicCsvAnalysisResult = {
  fileName: string;
  validation: CsvValidationSummary;
  metrics: CsvBusinessMetrics;
  evidence: AnalysisEvidence[];
  limitations: string[];
  warnings: string[];
};

/**
 * Deterministic sales CSV analysis: parse, metrics, and evidence only.
 * Does not call Nemotron or persist uploads.
 */
export function runDeterministicSalesCsvAnalysis(
  fileName: string,
  buffer: ArrayBuffer,
): DeterministicCsvAnalysisResult {
  const parsed = parseSalesCsv(fileName, buffer);
  const analyzed = analyzeSalesCsv(parsed);
  const evidence = buildCsvAnalysisEvidence(analyzed.metrics);

  return {
    fileName,
    validation: parsed.validation,
    metrics: analyzed.metrics,
    evidence,
    limitations: analyzed.limitations,
    warnings: analyzed.warnings,
  };
}
