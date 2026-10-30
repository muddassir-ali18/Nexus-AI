import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { executeInvestigationTools } from "./execute-investigation-tools";
import type { InvestigationPlan } from "./types";
import { SAMPLE_SYNTHETIC_DEMO_EVIDENCE_COUNT } from "@/lib/data/csv-sample-fixtures";

const sampleCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/samples/nexus-synthetic-sales-demo.csv",
);

const dataAnalysisPlan: InvestigationPlan = {
  objective: "Analyze uploaded sales data",
  steps: [
    {
      id: "step-1",
      description: "Run deterministic CSV analysis",
      reason: "Measure revenue trends from uploaded sales data.",
      toolName: "data_analysis",
    },
  ],
};

describe("executeInvestigationTools data_analysis", () => {
  it("executes data_analysis when a CSV attachment is provided", async () => {
    const file = readFileSync(sampleCsvPath);
    const buffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    );

    const result = await executeInvestigationTools(
      dataAnalysisPlan,
      "question-1",
      {
        csv: {
          fileName: "nexus-synthetic-sales-demo.csv",
          buffer,
        },
      },
    );

    assert.equal(result.pendingTools.length, 0);
    assert.equal(result.toolExecutions.length, 1);
    assert.equal(result.toolExecutions[0]?.status, "completed");
    assert.equal(result.toolExecutions[0]?.toolName, "data_analysis");
    assert.ok(result.evidence.length > 0);
    assert.ok(
      result.evidence.every((item) => item.toolName === "data_analysis"),
    );
  });

  it("marks data_analysis pending when no CSV attachment is available", async () => {
    const result = await executeInvestigationTools(
      dataAnalysisPlan,
      "question-1",
    );

    assert.equal(result.toolExecutions.length, 1);
    assert.equal(result.toolExecutions[0]?.status, "pending");
    assert.equal(result.pendingTools.length, 1);
    assert.equal(result.pendingTools[0]?.toolName, "data_analysis");
    assert.match(
      result.pendingTools[0]?.reason ?? "",
      /Attach a sales CSV/,
    );
    assert.equal(result.evidence.length, 0);
  });

  it("preserves calculator execution alongside data_analysis", async () => {
    const file = readFileSync(sampleCsvPath);
    const buffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    );
    const plan: InvestigationPlan = {
      objective: "Mixed tools",
      steps: [
        {
          id: "step-calc",
          description: "Calculate margin",
          reason: "Explicit calculation requested.",
          toolName: "calculator",
          toolInput: { expression: "450 * 0.10" },
        },
        {
          id: "step-data",
          description: "Analyze CSV",
          reason: "Uploaded sales data.",
          toolName: "data_analysis",
        },
      ],
    };

    const result = await executeInvestigationTools(plan, "question-2", {
      csv: { fileName: "nexus-synthetic-sales-demo.csv", buffer },
    });

    assert.equal(result.toolExecutions.length, 2);
    assert.equal(result.toolExecutions[0]?.toolName, "calculator");
    assert.equal(result.toolExecutions[0]?.status, "completed");
    assert.equal(result.toolExecutions[1]?.toolName, "data_analysis");
    assert.equal(result.toolExecutions[1]?.status, "completed");
    assert.ok(result.evidence.some((item) => item.toolName === "calculator"));
    assert.ok(result.evidence.some((item) => item.toolName === "data_analysis"));
  });

  it("runs one CSV analysis for multiple data_analysis plan steps and dedupes evidence", async () => {
    const file = readFileSync(sampleCsvPath);
    const buffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    );
    const plan: InvestigationPlan = {
      objective: "Analyze revenue from CSV",
      steps: [
        {
          id: "step-net",
          description: "Measure net revenue",
          reason: "Need net revenue from uploaded sales CSV.",
          toolName: "data_analysis",
        },
        {
          id: "step-mom",
          description: "Measure month-over-month change",
          reason: "Need MoM change from the same CSV.",
          toolName: "data_analysis",
        },
      ],
    };

    const result = await executeInvestigationTools(plan, "question-3", {
      csv: { fileName: "nexus-synthetic-sales-demo.csv", buffer },
    });

    assert.equal(result.toolExecutions.length, 2);
    assert.equal(result.toolExecutions[0]?.status, "completed");
    assert.equal(result.toolExecutions[1]?.status, "completed");
    assert.equal(
      result.toolExecutions[1]?.input?.sharedExecutionStepId,
      result.toolExecutions[0]?.id,
    );
    assert.equal(result.evidence.length, SAMPLE_SYNTHETIC_DEMO_EVIDENCE_COUNT);
  });
});
