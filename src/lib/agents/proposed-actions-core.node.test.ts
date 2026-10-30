import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProposedActionsFromRecommendations,
  enforceApprovalBoundary,
} from "./proposed-actions-core";

describe("proposed actions approval boundary", () => {
  it("marks external consequential actions as awaiting approval", () => {
    const actions = buildProposedActionsFromRecommendations(
      [
        {
          title: "Update live pricing",
          description: "Change promotion prices on the storefront.",
          priority: "high",
          basis: "Evidence suggests discount pressure.",
        },
      ],
      [],
    );

    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.requiresExternalExecution, true);
    assert.equal(actions[0]?.status, "awaiting_approval");
    assert.equal(actions[0]?.impactLevel, "high");
  });

  it("keeps informational actions proposed without auto-execution", () => {
    const actions = buildProposedActionsFromRecommendations(
      [
        {
          title: "Review evidence with finance",
          description: "Walk through the CSV metrics internally.",
          priority: "medium",
          basis: "Internal review only.",
        },
      ],
      [],
    );

    assert.equal(actions[0]?.requiresExternalExecution, false);
    assert.equal(actions[0]?.status, "proposed");
  });

  it("never allows model-side approved or completed statuses", () => {
    const sanitized = enforceApprovalBoundary([
      {
        id: "a-1",
        title: "Send email",
        description: "Email customers",
        rationale: "basis",
        evidenceIds: [],
        impactLevel: "high",
        requiresExternalExecution: true,
        status: "approved",
      },
    ]);

    assert.equal(sanitized[0]?.status, "awaiting_approval");
  });
});
