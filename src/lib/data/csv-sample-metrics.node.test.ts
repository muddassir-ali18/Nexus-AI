import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { runDeterministicSalesCsvAnalysis } from "./csv-analysis-pipeline";
import {
  SAMPLE_SYNTHETIC_DEMO_EVIDENCE_COUNT,
  SAMPLE_SYNTHETIC_DEMO_GROSS_POSITIVE,
  SAMPLE_SYNTHETIC_DEMO_NEGATIVE_ADJUSTMENTS,
  SAMPLE_SYNTHETIC_DEMO_NET_REVENUE,
} from "./csv-sample-fixtures";
import { mapAnalysisEvidenceToInvestigationEvidence } from "./evidence-mapper";

const sampleCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/samples/nexus-synthetic-sales-demo.csv",
);

describe("nexus-synthetic-sales-demo.csv metrics", () => {
  it("computes gross, negative adjustments, and net revenue consistently", () => {
    const file = readFileSync(sampleCsvPath);
    const buffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    );

    const result = runDeterministicSalesCsvAnalysis(
      "nexus-synthetic-sales-demo.csv",
      buffer,
    );

    assert.equal(result.metrics.grossPositiveRevenue, SAMPLE_SYNTHETIC_DEMO_GROSS_POSITIVE);
    assert.equal(
      result.metrics.negativeAdjustmentsTotal,
      SAMPLE_SYNTHETIC_DEMO_NEGATIVE_ADJUSTMENTS,
    );
    assert.equal(result.metrics.netRevenue, SAMPLE_SYNTHETIC_DEMO_NET_REVENUE);
    assert.equal(
      result.metrics.grossPositiveRevenue +
        result.metrics.negativeAdjustmentsTotal,
      result.metrics.netRevenue,
    );
    assert.equal(result.metrics.adjustmentRowCount, 1);
    assert.ok(result.metrics.monthOverMonth);
    assert.equal(result.evidence.length, SAMPLE_SYNTHETIC_DEMO_EVIDENCE_COUNT);

    const investigationEvidence = mapAnalysisEvidenceToInvestigationEvidence(
      result.evidence,
    );
    assert.equal(
      investigationEvidence.length,
      SAMPLE_SYNTHETIC_DEMO_EVIDENCE_COUNT,
    );
  });
});
