import { analyzeCustomerCsv } from "@/lib/data/csv-customer-analysis";
import { dedupeAnalysisEvidence } from "@/lib/data/evidence-dedupe";
import { mapAnalysisEvidenceToInvestigationEvidence } from "@/lib/data/evidence-mapper";
import { parseSalesCsv } from "@/lib/data/csv-parse";
import { CsvAttachmentError, getCsvAttachment } from "@/lib/tools/csv-attachment";
import type {
  CustomerAnalysisToolOutput,
  ToolContext,
  ToolInput,
  ToolOutput,
} from "@/lib/tools/types";

export class CustomerAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerAnalysisError";
  }
}

export async function executeCustomerAnalysis(
  _input: ToolInput,
  context: ToolContext,
): Promise<ToolOutput> {
  void _input;

  let attachment;
  try {
    attachment = getCsvAttachment(context);
  } catch (error) {
    if (error instanceof CsvAttachmentError) {
      throw new CustomerAnalysisError(error.message);
    }
    throw error;
  }
  const parsed = parseSalesCsv(attachment.fileName, attachment.buffer);
  const result = analyzeCustomerCsv(parsed);

  if (!result.ok) {
    throw new CustomerAnalysisError(result.reason);
  }

  const investigationEvidence = mapAnalysisEvidenceToInvestigationEvidence(
    dedupeAnalysisEvidence(result.evidence),
    "customer_analysis",
  );

  const output: CustomerAnalysisToolOutput = {
    fileName: result.fileName,
    distinctCustomers: result.distinctCustomers,
    distinctOrders: result.distinctOrders,
    segmentCounts: result.segmentCounts,
    segmentationRule: result.segmentationRule,
    limitations: result.limitations,
    evidenceCount: result.evidence.length,
    investigationEvidence,
  };

  return output;
}
