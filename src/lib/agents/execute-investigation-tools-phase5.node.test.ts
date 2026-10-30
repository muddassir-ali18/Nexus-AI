import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { executeInvestigationTools } from "./execute-investigation-tools";
import type { InvestigationPlan } from "./types";
import { isRegisteredToolName, listRegisteredTools } from "@/lib/tools/registry-core";
import { executeTool } from "@/lib/tools/executor-core";

const sampleCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/samples/nexus-synthetic-sales-demo.csv",
);

function sampleBuffer(): ArrayBuffer {
  const file = readFileSync(sampleCsvPath);
  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
}

describe("Phase 5 investigation tools", () => {
  it("registers customer_analysis, financial_analysis, and web_research", () => {
    const names = listRegisteredTools().map((tool) => tool.name);
    assert.ok(names.includes("customer_analysis"));
    assert.ok(names.includes("financial_analysis"));
    assert.ok(names.includes("web_research"));
    assert.equal(isRegisteredToolName("customer_analysis"), true);
  });

  it("runs financial_analysis on attached CSV", async () => {
    const plan: InvestigationPlan = {
      objective: "Financial view",
      steps: [
        {
          id: "step-fin",
          description: "Financial metrics",
          reason: "Discount and revenue view.",
          toolName: "financial_analysis",
        },
      ],
    };

    const result = await executeInvestigationTools(plan, "q-fin", {
      csv: {
        fileName: "nexus-synthetic-sales-demo.csv",
        buffer: sampleBuffer(),
      },
    });

    assert.equal(result.toolExecutions[0]?.status, "completed");
    assert.ok(result.evidence.some((e) => e.toolName === "financial_analysis"));
  });

  it("fails customer_analysis when customer_id column is missing", async () => {
    const plan: InvestigationPlan = {
      objective: "Customer segments",
      steps: [
        {
          id: "step-cust",
          description: "Segment customers",
          reason: "Need repeat vs one-time customers.",
          toolName: "customer_analysis",
        },
      ],
    };

    const result = await executeInvestigationTools(plan, "q-cust", {
      csv: {
        fileName: "nexus-synthetic-sales-demo.csv",
        buffer: sampleBuffer(),
      },
    });

    assert.equal(result.toolExecutions[0]?.status, "failed");
    assert.match(
      result.toolExecutions[0]?.error ?? "",
      /customer_id/i,
    );
    assert.equal(result.evidence.length, 0);
  });

  it("dedupes repeated customer_analysis executions", async () => {
    const plan: InvestigationPlan = {
      objective: "Customer segments",
      steps: [
        {
          id: "step-a",
          description: "Segment",
          reason: "Segments",
          toolName: "customer_analysis",
        },
        {
          id: "step-b",
          description: "Segment again",
          reason: "Duplicate step",
          toolName: "customer_analysis",
        },
      ],
    };

    const csv = `order_id,order_date,customer_id,revenue
O1,2026-01-01,C1,100
O2,2026-01-02,C1,50
O3,2026-01-03,C2,200
`;
    const buffer = new TextEncoder().encode(csv).buffer;

    const result = await executeInvestigationTools(plan, "q-dedupe", {
      csv: { fileName: "cust.csv", buffer },
    });

    assert.equal(result.toolExecutions.length, 2);
    assert.equal(result.toolExecutions[0]?.status, "completed");
    assert.equal(result.toolExecutions[1]?.status, "completed");
    assert.equal(
      result.toolExecutions[1]?.input?.sharedExecutionStepId,
      result.toolExecutions[0]?.id,
    );
  });

  it("fails web_research when provider is not configured", async () => {
    const plan: InvestigationPlan = {
      objective: "External context",
      steps: [
        {
          id: "step-web",
          description: "Research market",
          reason: "Need external sources.",
          toolName: "web_research",
          toolInput: { query: "retail discount trends 2026" },
        },
      ],
    };

    const priorKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;

    try {
      const result = await executeInvestigationTools(plan, "q-web");
      assert.equal(result.toolExecutions[0]?.status, "failed");
      assert.match(result.toolExecutions[0]?.error ?? "", /not configured/i);
      assert.equal(result.evidence.length, 0);
    } finally {
      if (priorKey !== undefined) {
        process.env.TAVILY_API_KEY = priorKey;
      }
    }
  });

  it("completes web_research with mock provider", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Industry Brief",
              url: "https://example.com/brief",
              content: "Summary text.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const execution = await executeTool(
      "web_research",
      { query: "market trends" },
      {
        stepId: "step-web",
        questionId: "q-web-mock",
        webResearch: {
          apiKey: "tvly-test",
          fetchImpl: mockFetch,
        },
      },
    );

    assert.equal(execution.status, "completed");
    const output = execution.output as { findingCount?: number };
    assert.equal(output.findingCount, 1);
  });

  it("keeps calculator behavior unchanged", async () => {
    const execution = await executeTool(
      "calculator",
      { expression: "100 + 25" },
      { stepId: "step-calc", questionId: "q-calc" },
    );
    assert.equal(execution.status, "completed");
    assert.equal((execution.output as { value: number }).value, 125);
  });
});
