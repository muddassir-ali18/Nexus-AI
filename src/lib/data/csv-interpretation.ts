import "server-only";

import { createNebiusClient, isNebiusConfigured } from "@/lib/ai/nebius";
import type {
  AnalysisEvidence,
  CsvBusinessMetrics,
  CsvInterpretation,
} from "@/lib/data/analysis-types";
import { validateCsvInterpretation } from "@/lib/data/csv-interpretation-validation";
import { NexusProviderError } from "@/lib/utils/errors";

const INTERPRETATION_SYSTEM_PROMPT = `You are the interpretation component of NEXUS, an autonomous business investigation agent.

You receive deterministic metrics and evidence calculated from uploaded sales CSV data.

Your job:
1. Explain what the measured evidence supports.
2. Clearly distinguish measured facts from possible explanations.
3. State what additional information would be needed to establish root cause.
4. Provide actionable next steps grounded in the findings.

Rules:
- Do not invent numbers that are not present in the supplied evidence.
- Do not claim root cause certainty when the evidence only shows outcomes.
- Put only directly supported measurements in measuredFacts.
- Put hypotheses and speculative causes in possibleExplanations.
- Return structured JSON only with this shape:
{
  "summary": "string",
  "measuredFacts": ["string"],
  "possibleExplanations": ["string"],
  "additionalInformationNeeded": ["string"],
  "recommendedNextSteps": ["string"]
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // continue
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1].trim()) as unknown;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }

  throw new Error("Model did not return JSON interpretation.");
}

function parseInterpretation(raw: unknown): CsvInterpretation {
  if (!isRecord(raw)) {
    throw new Error("Interpretation must be a JSON object.");
  }

  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (!summary) {
    throw new Error("Interpretation summary is missing.");
  }

  return {
    summary,
    measuredFacts: parseStringArray(raw.measuredFacts),
    possibleExplanations: parseStringArray(raw.possibleExplanations),
    additionalInformationNeeded: parseStringArray(raw.additionalInformationNeeded),
    recommendedNextSteps: parseStringArray(raw.recommendedNextSteps),
  };
}

function buildInterpretationPayload(
  metrics: CsvBusinessMetrics,
  evidence: AnalysisEvidence[],
  limitations: string[],
  warnings: string[],
): string {
  return JSON.stringify(
    {
      metrics: {
        grossPositiveRevenue: metrics.grossPositiveRevenue,
        negativeAdjustmentsTotal: metrics.negativeAdjustmentsTotal,
        netRevenue: metrics.netRevenue,
        validRecordCount: metrics.validRecordCount,
        revenueByMonth: metrics.revenueByMonth,
        monthOverMonth: metrics.monthOverMonth,
        averageOrderValue: metrics.averageOrderValue,
        averageOrderValueExcludedRowCount:
          metrics.averageOrderValueExcludedRowCount,
        topProducts: metrics.revenueByProduct.slice(0, 5),
        topCategories: metrics.revenueByCategory.slice(0, 5),
        topRegions: metrics.revenueByRegion.slice(0, 5),
      },
      evidence: evidence.map((item) => ({
        claim: item.claim,
        value: item.value,
        methodology: item.methodology,
        period: item.period,
        segment: item.segment,
        column: item.column,
      })),
      limitations,
      warnings,
    },
    null,
    2,
  );
}

export async function interpretCsvAnalysis(input: {
  metrics: CsvBusinessMetrics;
  evidence: AnalysisEvidence[];
  limitations: string[];
  warnings: string[];
}): Promise<{ interpretation: CsvInterpretation | null; error: string | null }> {
  if (!isNebiusConfigured()) {
    return {
      interpretation: null,
      error: "Nemotron interpretation is unavailable because NEBIUS_API_KEY is not configured.",
    };
  }

  try {
    const client = createNebiusClient();
    const response = await client.chat({
      messages: [
        { role: "system", content: INTERPRETATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Interpret the following deterministic CSV analysis results:\n\n${buildInterpretationPayload(
            input.metrics,
            input.evidence,
            input.limitations,
            input.warnings,
          )}`,
        },
      ],
      temperature: 0.2,
    });

    const parsed = parseInterpretation(extractJsonObject(response.content));
    const validationError = validateCsvInterpretation(parsed);
    if (validationError) {
      return {
        interpretation: null,
        error: validationError,
      };
    }

    return { interpretation: parsed, error: null };
  } catch (error) {
    if (error instanceof NexusProviderError) {
      return {
        interpretation: null,
        error: error.message,
      };
    }
    if (error instanceof Error) {
      return {
        interpretation: null,
        error: error.message,
      };
    }
    return {
      interpretation: null,
      error: "Nemotron interpretation failed.",
    };
  }
}
