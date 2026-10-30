import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatToolExecutionLabel,
  groupInvestigationEvidence,
  isEvidenceSourceUrl,
  listVisibleToolExecutions,
  shouldOfferInvestigationRetry,
} from "./investigation-ui";

describe("investigation UI helpers", () => {
  it("offers retry when data_analysis is pending and a CSV was attached", () => {
    assert.equal(
      shouldOfferInvestigationRetry({
        pendingTools: [
          {
            stepId: "step-1",
            toolName: "data_analysis",
            description: "Analyze CSV",
            reason: "Planner did not schedule data_analysis.",
          },
        ],
        hasCsvAttachment: true,
        lastQuestion: "What is net revenue?",
      }),
      true,
    );
  });

  it("does not offer retry without an attachment", () => {
    assert.equal(
      shouldOfferInvestigationRetry({
        pendingTools: [
          {
            stepId: "step-1",
            toolName: "data_analysis",
            description: "Analyze CSV",
            reason: "Missing attachment",
          },
        ],
        hasCsvAttachment: false,
        lastQuestion: "What is net revenue?",
      }),
      false,
    );
  });

  it("detects http(s) evidence sources for link rendering", () => {
    assert.equal(isEvidenceSourceUrl("https://example.com/report"), true);
    assert.equal(isEvidenceSourceUrl("sales.csv"), false);
  });

  it("groups deterministic evidence by tool", () => {
    const grouped = groupInvestigationEvidence([
      {
        id: "1",
        source: "sales.csv",
        claim: "Net revenue is 100.",
        toolName: "data_analysis",
      },
      {
        id: "2",
        source: "Calculator",
        claim: "450 * 0.10 = 45",
        toolName: "calculator",
      },
    ]);

    assert.equal(grouped.deterministic.length, 2);
    assert.equal(grouped.other.length, 0);
  });

  it("lists pending, completed, and failed executions", () => {
    const visible = listVisibleToolExecutions([
      {
        id: "1",
        stepId: "s1",
        toolName: "data_analysis",
        status: "pending",
      },
      {
        id: "2",
        stepId: "s2",
        toolName: "calculator",
        status: "completed",
      },
    ]);

    assert.equal(visible.length, 2);
    assert.equal(formatToolExecutionLabel(visible[0]!), "data_analysis (sales CSV)");
    assert.equal(
      formatToolExecutionLabel({
        id: "3",
        stepId: "s3",
        toolName: "data_analysis",
        status: "completed",
        input: { sharedExecutionStepId: "primary-id" },
      }),
      "data_analysis (shared execution)",
    );
  });
});
