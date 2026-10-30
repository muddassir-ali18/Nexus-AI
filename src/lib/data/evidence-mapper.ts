import type { AnalysisEvidence } from "@/lib/data/analysis-types";
import type { Evidence } from "@/lib/data/types";
import type { RegisteredToolName } from "@/lib/tools/types";

function buildInvestigationClaim(item: AnalysisEvidence): string {
  const segments: string[] = [item.claim];

  if (item.period) {
    segments.push(`Period: ${item.period}.`);
  }

  if (item.segment) {
    segments.push(`Segment: ${item.segment}.`);
  }

  if (item.column) {
    segments.push(`Column: ${item.column}.`);
  }

  segments.push(`Method: ${item.methodology}`);

  return segments.join(" ");
}

/**
 * Maps deterministic CSV analysis evidence into investigation evidence items.
 */
export function mapAnalysisEvidenceToInvestigationEvidence(
  items: AnalysisEvidence[],
  toolName: RegisteredToolName = "data_analysis",
): Evidence[] {
  return items.map((item) => ({
    id: item.id,
    source: item.source,
    claim: buildInvestigationClaim(item),
    value: item.value,
    toolName,
  }));
}
