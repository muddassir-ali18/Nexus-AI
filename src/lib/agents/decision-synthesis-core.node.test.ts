import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSynthesisModelPayload,
  createInsufficientEvidenceDecision,
  hasUsableInvestigationEvidence,
  parseDecisionSynthesisResult,
  validateDecisionSynthesis,
} from "./decision-synthesis-core";

const validPayload = {
  decision: {
    summary: "Net revenue is supported by collected CSV evidence.",
    reasoning: [
      "Evidence id ev-1 reports net revenue from the uploaded sales CSV.",
    ],
    confidence: "medium",
    limitations: ["Pending calculator step was not executed."],
  },
  recommendedActions: [
    {
      title: "Validate refund handling",
      description: "Review negative revenue rows in the source export.",
      priority: "medium",
      basis: "Hypothesis: adjustments may explain part of the net revenue mix.",
    },
  ],
};

describe("decision synthesis core", () => {
  it("parses valid synthesis JSON", () => {
    const parsed = parseDecisionSynthesisResult(validPayload);
    assert.ok(parsed);
    assert.equal(parsed.decision.confidence, "medium");
    assert.equal(parsed.recommendedActions.length, 1);
  });

  it("rejects malformed synthesis JSON", () => {
    assert.equal(parseDecisionSynthesisResult({ decision: { summary: "" } }), null);
    assert.equal(parseDecisionSynthesisResult("not-json"), null);
  });

  it("returns insufficient-evidence decision without invented metrics", () => {
    const result = createInsufficientEvidenceDecision(
      "What is net revenue?",
      [
        {
          stepId: "s1",
          toolName: "data_analysis",
          description: "Analyze CSV",
          reason: "Missing attachment",
        },
      ],
    );

    assert.match(result.decision.summary, /cannot provide a reliable business decision/i);
    assert.equal(result.recommendedActions.length, 0);
    assert.doesNotMatch(result.decision.summary, /\$\d/);
  });

  it("builds synthesis payload with tool and evidence summaries only", () => {
    const payload = JSON.parse(
      buildSynthesisModelPayload({
        question: "What is net revenue?",
        toolExecutions: [
          {
            id: "1",
            stepId: "s1",
            toolName: "data_analysis",
            status: "completed",
          },
        ],
        evidence: [
          {
            id: "ev-1",
            source: "sales.csv",
            claim: "Net revenue across valid records is 100.",
            value: 100,
            toolName: "data_analysis",
          },
        ],
        pendingTools: [],
      }),
    ) as { evidence: Array<{ id: string }> };

    assert.equal(payload.evidence.length, 1);
    assert.equal(payload.evidence[0]?.id, "ev-1");
  });

  it("includes seoResearchReports from completed web_research tools", () => {
    const payload = JSON.parse(
      buildSynthesisModelPayload({
        question: "Chennai SEO competitors",
        toolExecutions: [
          {
            id: "web-1",
            stepId: "s-web",
            toolName: "web_research",
            status: "completed",
            output: {
              seoResearchReport: {
                executiveSummary: "1 relevant competitor candidate(s) identified.",
                verifiedCount: 0,
              },
            },
          },
        ],
        evidence: [],
        pendingTools: [],
      }),
    ) as { seoResearchReports: Array<{ verifiedCount: number }> };

    assert.equal(payload.seoResearchReports.length, 1);
    assert.equal(payload.seoResearchReports[0]?.verifiedCount, 0);
  });

  it("validates unsupported certainty language", () => {
    const parsed = parseDecisionSynthesisResult({
      ...validPayload,
      decision: {
        ...validPayload.decision,
        summary: "This is the proven root cause of the revenue increase.",
      },
    });
    assert.ok(parsed);
    const error = validateDecisionSynthesis(parsed, [
      {
        id: "ev-1",
        source: "sales.csv",
        claim: "Net revenue is 100.",
        toolName: "data_analysis",
      },
    ]);
    assert.match(error ?? "", /unsupported certainty language/i);
  });

  it("detects empty evidence as not usable", () => {
    assert.equal(hasUsableInvestigationEvidence([]), false);
    assert.equal(
      hasUsableInvestigationEvidence([
        {
          id: "ev-1",
          source: "Calculator",
          claim: "1 + 1 = 2",
          toolName: "calculator",
        },
      ]),
      true,
    );
  });
});
