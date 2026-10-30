import type { AnalysisEvidence } from "@/lib/data/analysis-types";
import type { Evidence } from "@/lib/data/types";

export function analysisEvidenceDedupKey(item: AnalysisEvidence): string {
  return [
    item.source,
    item.claim,
    item.column ?? "",
    item.period ?? "",
    item.segment ?? "",
    item.value === undefined ? "" : String(item.value),
    item.methodology,
  ].join("\u001f");
}

export function dedupeAnalysisEvidence(
  items: AnalysisEvidence[],
): AnalysisEvidence[] {
  const seen = new Set<string>();
  const deduped: AnalysisEvidence[] = [];

  for (const item of items) {
    const key = analysisEvidenceDedupKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export function investigationEvidenceDedupKey(item: Evidence): string {
  return [
    item.toolName,
    item.source,
    item.value === undefined ? "" : String(item.value),
    item.claim,
  ].join("\u001f");
}

export function dedupeInvestigationEvidence(items: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const deduped: Evidence[] = [];

  for (const item of items) {
    const key = investigationEvidenceDedupKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}
