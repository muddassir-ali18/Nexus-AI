import { runDeterministicSalesCsvAnalysis } from "@/lib/data/csv-analysis-pipeline";
import { dedupeAnalysisEvidence } from "@/lib/data/evidence-dedupe";
import { mapAnalysisEvidenceToInvestigationEvidence } from "@/lib/data/evidence-mapper";
import { CsvAttachmentError, getCsvAttachment } from "@/lib/tools/csv-attachment";
import type {
  DataAnalysisToolOutput,
  ToolContext,
  ToolInput,
  ToolOutput,
} from "@/lib/tools/types";

export class DataAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataAnalysisError";
  }
}

export async function executeDataAnalysis(
  _input: ToolInput,
  context: ToolContext,
): Promise<ToolOutput> {
  void _input;

  let attachment;
  try {
    attachment = getCsvAttachment(context);
  } catch (error) {
    if (error instanceof CsvAttachmentError) {
      throw new DataAnalysisError(error.message);
    }
    throw error;
  }

  const result = runDeterministicSalesCsvAnalysis(
    attachment.fileName,
    attachment.buffer,
  );

  const investigationEvidence = mapAnalysisEvidenceToInvestigationEvidence(
    dedupeAnalysisEvidence(result.evidence),
  );

  const output: DataAnalysisToolOutput = {
    fileName: result.fileName,
    netRevenue: result.metrics.netRevenue,
    grossPositiveRevenue: result.metrics.grossPositiveRevenue,
    negativeAdjustmentsTotal: result.metrics.negativeAdjustmentsTotal,
    validRecordCount: result.metrics.validRecordCount,
    evidenceCount: result.evidence.length,
    limitations: result.limitations,
    warnings: [...result.validation.warnings, ...result.warnings],
    investigationEvidence,
  };

  return output;
}
