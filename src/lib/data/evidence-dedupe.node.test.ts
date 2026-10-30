import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AnalysisEvidence } from "./analysis-types";
import {
  analysisEvidenceDedupKey,
  dedupeAnalysisEvidence,
  dedupeInvestigationEvidence,
} from "./evidence-dedupe";

describe("evidence dedupe", () => {
  it("removes duplicate analysis evidence with the same semantic key", () => {
    const item: AnalysisEvidence = {
      id: "a",
      source: "sales.csv",
      claim: "Net revenue across valid records is 100.",
      value: 100,
      methodology: "Sum of rows.",
      column: "revenue",
      period: "2026-01",
    };
    const duplicate = { ...item, id: "b" };

    const deduped = dedupeAnalysisEvidence([item, duplicate]);
    assert.equal(deduped.length, 1);
    assert.equal(analysisEvidenceDedupKey(item), analysisEvidenceDedupKey(duplicate));
  });

  it("keeps distinct monthly and segment evidence", () => {
    const monthly: AnalysisEvidence = {
      id: "1",
      source: "sales.csv",
      claim: "Net revenue in calendar-month bucket 2026-01 was 100.",
      value: 100,
      methodology: "Monthly bucket sum.",
      period: "2026-01",
      column: "revenue",
    };
    const segment: AnalysisEvidence = {
      id: "2",
      source: "sales.csv",
      claim: 'Product "Desk" generated 50 in gross positive sales.',
      value: 50,
      methodology: "Product grouping.",
      segment: "Desk",
      column: "product",
    };

    const deduped = dedupeAnalysisEvidence([monthly, segment]);
    assert.equal(deduped.length, 2);
  });

  it("dedupes investigation evidence claims", () => {
    const deduped = dedupeInvestigationEvidence([
      {
        id: "1",
        source: "sales.csv",
        claim: "Same claim",
        toolName: "data_analysis",
        value: 10,
      },
      {
        id: "2",
        source: "sales.csv",
        claim: "Same claim",
        toolName: "data_analysis",
        value: 10,
      },
    ]);

    assert.equal(deduped.length, 1);
  });
});
