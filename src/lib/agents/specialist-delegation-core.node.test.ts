import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { executeInvestigationTools } from "./execute-investigation-tools";
import { coordinateInvestigationPass } from "./specialist-delegation-core";
import { MAX_ORCHESTRATION_ITERATIONS } from "./specialists-core";
import type { InvestigationPlan } from "./types";

const sampleCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/samples/nexus-synthetic-sales-demo.csv",
);

describe("specialist delegation coordination", () => {
  it("assigns data finance specialist and propagates evidence on success", async () => {
    const file = readFileSync(sampleCsvPath);
    const buffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    );
    const plan: InvestigationPlan = {
      objective: "Revenue review",
      steps: [
        {
          id: "step-data",
          description: "Analyze uploaded sales CSV",
          reason: "Measure net revenue.",
          toolName: "data_analysis",
        },
      ],
    };

    const toolResults = await executeInvestigationTools(plan, "q-1", {
      csv: { fileName: "demo.csv", buffer },
    });

    const orchestration = coordinateInvestigationPass({
      plan,
      toolExecutions: toolResults.toolExecutions,
      evidence: toolResults.evidence,
      pendingTools: toolResults.pendingTools,
      context: { csvAttached: true, webResearchConfigured: false },
      startedAtMs: Date.now() - 50,
      budgetMs: 120_000,
    });

    assert.equal(orchestration.maxIterations, MAX_ORCHESTRATION_ITERATIONS);
    assert.equal(orchestration.replanningEnabled, false);
    assert.equal(orchestration.specialistRuns.length, 1);
    assert.equal(orchestration.specialistRuns[0]?.specialistId, "data_finance");
    assert.equal(orchestration.specialistRuns[0]?.status, "completed");
    assert.equal(orchestration.evidenceCount, toolResults.evidence.length);
  });

  it("preserves completed evidence when another specialist fails", async () => {
    const file = readFileSync(sampleCsvPath);
    const buffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    );
    const plan: InvestigationPlan = {
      objective: "Mixed specialists",
      steps: [
        {
          id: "step-data",
          description: "CSV metrics",
          reason: "Need revenue.",
          toolName: "data_analysis",
        },
        {
          id: "step-customer",
          description: "Customer segments",
          reason: "Need repeat customers.",
          toolName: "customer_analysis",
        },
      ],
    };

    const toolResults = await executeInvestigationTools(plan, "q-2", {
      csv: { fileName: "demo.csv", buffer },
    });

    const orchestration = coordinateInvestigationPass({
      plan,
      toolExecutions: toolResults.toolExecutions,
      evidence: toolResults.evidence,
      pendingTools: toolResults.pendingTools,
      context: { csvAttached: true, webResearchConfigured: false },
      startedAtMs: Date.now() - 100,
      budgetMs: 120_000,
    });

    assert.equal(
      toolResults.toolExecutions.find((item) => item.toolName === "data_analysis")
        ?.status,
      "completed",
    );
    assert.equal(
      toolResults.toolExecutions.find(
        (item) => item.toolName === "customer_analysis",
      )?.status,
      "failed",
    );
    assert.ok(toolResults.evidence.length > 0);
    assert.equal(
      orchestration.specialistRuns.find((run) => run.specialistId === "data_finance")
        ?.status,
      "completed",
    );
    assert.equal(
      orchestration.specialistRuns.find((run) => run.specialistId === "customer")
        ?.status,
      "failed",
    );
  });

  it("marks budget exhaustion without inventing results", () => {
    const plan: InvestigationPlan = {
      objective: "Budget test",
      steps: [
        {
          id: "step-calc",
          description: "Calculate",
          reason: "Explicit math.",
          toolName: "calculator",
          toolInput: { expression: "2+2" },
        },
      ],
    };

    const orchestration = coordinateInvestigationPass({
      plan,
      toolExecutions: [],
      evidence: [],
      pendingTools: [],
      context: { csvAttached: false, webResearchConfigured: false },
      startedAtMs: Date.now() - 200_000,
      budgetMs: 120_000,
    });

    assert.equal(orchestration.stopReason, "budget_exhausted");
    assert.equal(orchestration.specialistRuns[0]?.status, "skipped");
  });
});
