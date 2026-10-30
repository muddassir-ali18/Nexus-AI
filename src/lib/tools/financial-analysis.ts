import { analyzeFinancialCsv } from "@/lib/data/csv-financial-analysis";
import { dedupeAnalysisEvidence } from "@/lib/data/evidence-dedupe";
import { mapAnalysisEvidenceToInvestigationEvidence } from "@/lib/data/evidence-mapper";
import { CsvAttachmentError, getCsvAttachment } from "@/lib/tools/csv-attachment";

export class FinancialAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialAnalysisError";
  }
}
import type {
  FinancialAnalysisToolOutput,
  ToolContext,
  ToolInput,
  ToolOutput,
} from "@/lib/tools/types";

export async function executeFinancialAnalysis(
  _input: ToolInput,
  context: ToolContext,
): Promise<ToolOutput> {
  void _input;

  let attachment;
  try {
    attachment = getCsvAttachment(context);
  } catch (error) {
    if (error instanceof CsvAttachmentError) {
      throw new FinancialAnalysisError(error.message);
    }
    throw error;
  }
  const result = analyzeFinancialCsv(attachment.fileName, attachment.buffer);

  const investigationEvidence = mapAnalysisEvidenceToInvestigationEvidence(
    dedupeAnalysisEvidence(result.evidence),
    "financial_analysis",
  );

  const output: FinancialAnalysisToolOutput = {
    fileName: result.fileName,
    netRevenue: result.netRevenue,
    grossPositiveRevenue: result.grossPositiveRevenue,
    negativeAdjustmentsTotal: result.negativeAdjustmentsTotal,
    averageOrderValue: result.averageOrderValue,
    discountColumnPresent: result.discountColumnPresent,
    promotionColumnPresent: result.promotionColumnPresent,
    totalRecordedDiscounts: result.totalRecordedDiscounts,
    promotionSummaryCount: result.promotionSummaries.length,
    limitations: result.limitations,
    evidenceCount: result.evidence.length,
    investigationEvidence,
  };

  return output;
}
