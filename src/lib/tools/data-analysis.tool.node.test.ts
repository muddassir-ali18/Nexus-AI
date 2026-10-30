import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { executeTool } from "./executor-core";
import type { DataAnalysisToolOutput } from "./types";

const sampleCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/samples/nexus-synthetic-sales-demo.csv",
);

describe("data_analysis tool", () => {
  it("returns compact metrics and investigation evidence with a valid attachment", async () => {
    const file = readFileSync(sampleCsvPath);
    const buffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    );

    const execution = await executeTool(
      "data_analysis",
      {},
      {
        stepId: "step-1",
        questionId: "q-1",
        attachments: {
          csv: {
            fileName: "nexus-synthetic-sales-demo.csv",
            buffer,
          },
        },
      },
    );

    assert.equal(execution.status, "completed");
    const output = execution.output as DataAnalysisToolOutput;
    assert.equal(output.fileName, "nexus-synthetic-sales-demo.csv");
    assert.equal(output.netRevenue, 3143.5);
    assert.ok(output.evidenceCount > 0);
    assert.ok(output.investigationEvidence.length === output.evidenceCount);
    assert.ok(
      !JSON.stringify(output).includes("SYN-1001"),
      "output must not include raw CSV row values",
    );
  });

  it("fails safely when the CSV attachment is missing", async () => {
    const execution = await executeTool(
      "data_analysis",
      {},
      { stepId: "step-1", questionId: "q-1" },
    );

    assert.equal(execution.status, "failed");
    assert.match(execution.error ?? "", /Sales CSV attachment is required/);
  });
});
