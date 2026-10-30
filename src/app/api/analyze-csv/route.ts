import { runDeterministicSalesCsvAnalysis } from "@/lib/data/csv-analysis-pipeline";
import { interpretCsvAnalysis } from "@/lib/data/csv-interpretation";
import type { CsvAnalyzeResponse } from "@/lib/data/analysis-types";
import {
  getErrorStatusCode,
  getSafeErrorMessage,
  NexusValidationError,
} from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      const response: CsvAnalyzeResponse = {
        success: false,
        error: "Upload must include a CSV file in the 'file' field.",
      };
      return Response.json(response, { status: 400 });
    }

    const fileName = fileEntry.name || "upload.csv";
    const buffer = await fileEntry.arrayBuffer();

    const analysis = runDeterministicSalesCsvAnalysis(fileName, buffer);
    const interpretationResult = await interpretCsvAnalysis({
      metrics: analysis.metrics,
      evidence: analysis.evidence,
      limitations: analysis.limitations,
      warnings: analysis.warnings,
    });

    const response: CsvAnalyzeResponse = {
      success: true,
      fileName,
      validation: analysis.validation,
      metrics: analysis.metrics,
      evidence: analysis.evidence,
      interpretation: interpretationResult.interpretation,
      interpretationError: interpretationResult.error,
      limitations: analysis.limitations,
      warnings: analysis.warnings,
    };

    return Response.json(response);
  } catch (error) {
    const message =
      error instanceof NexusValidationError
        ? error.message
        : getSafeErrorMessage(error);

    const response: CsvAnalyzeResponse = {
      success: false,
      error: message,
    };

    return Response.json(response, { status: getErrorStatusCode(error) });
  }
}
