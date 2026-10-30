import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { executeInvestigationTools } from "@/lib/agents/execute-investigation-tools";
import type { InvestigationPlan } from "@/lib/agents/types";
import { parseInvestigateRequest } from "@/lib/api/investigate-request";
import { SAMPLE_SYNTHETIC_DEMO_EVIDENCE_COUNT } from "@/lib/data/csv-sample-fixtures";

const sampleCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/samples/nexus-synthetic-sales-demo.csv",
);

const revenueQuestionPlan: InvestigationPlan = {
  objective: "Measure uploaded sales performance",
  steps: [
    {
      id: "step-1",
      description: "Analyze uploaded sales CSV metrics",
      reason: "Net revenue must be measured from the attached sales data.",
      toolName: "data_analysis",
    },
  ],
};

describe("investigate CSV attachment flow (deterministic)", () => {
  it("runs data_analysis after multipart parsing when the plan selects the tool", async () => {
    const formData = new FormData();
    formData.append("question", "What is net revenue in the uploaded sales data?");
    formData.append(
      "file",
      new Blob([readFileSync(sampleCsvPath) as BlobPart], { type: "text/csv" }),
      "nexus-synthetic-sales-demo.csv",
    );

    const request = new Request("http://localhost/api/investigate", {
      method: "POST",
      body: formData,
    });

    const parsed = await parseInvestigateRequest(request);
    const result = await executeInvestigationTools(
      revenueQuestionPlan,
      "question-1",
      parsed.attachments,
    );

    assert.equal(result.pendingTools.length, 0);
    assert.equal(result.toolExecutions[0]?.status, "completed");
    assert.equal(result.toolExecutions[0]?.toolName, "data_analysis");
    assert.ok(result.evidence.length > 0);
    assert.equal(result.evidence.length, SAMPLE_SYNTHETIC_DEMO_EVIDENCE_COUNT);
    assert.ok(
      result.evidence.some((item) =>
        item.claim.includes("Net revenue across valid records"),
      ),
    );
  });

  it("returns pending data_analysis without evidence when no attachment was parsed", async () => {
    const result = await executeInvestigationTools(
      revenueQuestionPlan,
      "question-2",
    );

    assert.equal(result.pendingTools.length, 1);
    assert.equal(result.toolExecutions[0]?.status, "pending");
    assert.equal(result.evidence.length, 0);
  });
});
