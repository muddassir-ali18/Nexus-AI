import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AnalysisEvidence } from "./analysis-types";
import { mapAnalysisEvidenceToInvestigationEvidence } from "./evidence-mapper";

describe("mapAnalysisEvidenceToInvestigationEvidence", () => {
  it("preserves source, value, and methodology context in claims", () => {
    const item: AnalysisEvidence = {
      id: "ev-1",
      source: "sales.csv",
      column: "revenue",
      claim: "Net revenue across valid records is 100.",
      value: 100,
      methodology: "Gross positive sales plus negative adjustments.",
      period: "2026-01",
      segment: "Office",
    };

    const mapped = mapAnalysisEvidenceToInvestigationEvidence([item]);

    assert.equal(mapped.length, 1);
    assert.equal(mapped[0]?.toolName, "data_analysis");
    assert.equal(mapped[0]?.source, "sales.csv");
    assert.equal(mapped[0]?.value, 100);
    assert.match(mapped[0]?.claim ?? "", /Net revenue across valid records is 100/);
    assert.match(mapped[0]?.claim ?? "", /Period: 2026-01/);
    assert.match(mapped[0]?.claim ?? "", /Segment: Office/);
    assert.match(mapped[0]?.claim ?? "", /Column: revenue/);
    assert.match(
      mapped[0]?.claim ?? "",
      /Method: Gross positive sales plus negative adjustments/,
    );
  });
});
