import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { runDeterministicSalesCsvAnalysis } from "./csv-analysis-pipeline";
import {
  SAMPLE_SYNTHETIC_DEMO_EVIDENCE_COUNT,
  SAMPLE_SYNTHETIC_DEMO_NET_REVENUE,
} from "./csv-sample-fixtures";

const sampleCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/samples/nexus-synthetic-sales-demo.csv",
);

describe("runDeterministicSalesCsvAnalysis", () => {
  it("analyzes the sample sales CSV with expected net revenue and evidence", () => {
    const file = readFileSync(sampleCsvPath);
    const buffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    );
    const result = runDeterministicSalesCsvAnalysis(
      "nexus-synthetic-sales-demo.csv",
      buffer,
    );

    assert.equal(result.fileName, "nexus-synthetic-sales-demo.csv");
    assert.equal(result.metrics.netRevenue, SAMPLE_SYNTHETIC_DEMO_NET_REVENUE);
    assert.equal(result.evidence.length, SAMPLE_SYNTHETIC_DEMO_EVIDENCE_COUNT);
    assert.equal(result.metrics.validRecordCount, 12);
    assert.ok(result.evidence.length > 0);
    assert.ok(
      result.evidence.some((item) =>
        item.claim.includes("Net revenue across valid records"),
      ),
    );
    assert.ok(result.validation.includedRows > 0);
  });
});
