import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAssistantSummaryMarkdown } from "./format-assistant-summary";
import type { InvestigateApiSuccess } from "@/lib/agents/types";

function minimalPayload(
  overrides: Partial<InvestigateApiSuccess> = {},
): InvestigateApiSuccess {
  return {
    success: true,
    question: "Research SEO for example.com",
    plan: { objective: "Research", steps: [] },
    toolExecutions: [],
    evidence: [],
    pendingTools: [],
    orchestration: {
      iteration: 1,
      maxIterations: 1,
      stopReason: "ready_for_synthesis",
      durationMs: 1,
      assignments: [],
      specialistRuns: [],
      evidenceCount: 0,
      replanningEnabled: false,
    },
    proposedActions: [],
    decision: null,
    recommendedActions: [],
    decisionError: null,
    ...overrides,
  };
}

describe("format assistant summary", () => {
  it("includes SEO sections and source links from completed web research", () => {
    const markdown = buildAssistantSummaryMarkdown(
      minimalPayload({
        toolExecutions: [
          {
            id: "exec-1",
            stepId: "step-1",
            toolName: "web_research",
            status: "completed",
            output: {
              query: "SEO for example.com",
              findingCount: 1,
              findings: [
                {
                  title: "SEO guide",
                  url: "https://example.com/guide",
                  snippet: "Overview",
                },
              ],
              investigationEvidence: [],
              evidenceCount: 0,
              seoResearch: true,
              queriesExecuted: ["SEO for example.com"],
              limitations: ["No ranking data."],
              seoResearchReport: {
                executiveSummary: "0 relevant competitor candidates identified.",
                methodology: ["Focused Tavily queries"],
                competitorCandidateLabel: "0 relevant competitor candidate(s) identified.",
                verifiedCount: 0,
                partiallyVerifiedCount: 0,
                unverifiedCount: 0,
                filteredIrrelevantCount: 0,
                classificationCounts: {},
                competitors: [],
                verifiedFindings: [],
                reasonableInferences: [],
                potentialOpportunities: [],
                unverifiedClaims: [],
                additionalDataRequired: [],
                technicalAuditRequirements: ["Website crawling"],
                evidenceGaps: [],
                failedQueries: [],
                emptyQueries: [],
                sourceReferences: [
                  {
                    title: "SEO guide",
                    url: "https://example.com/guide",
                    classification: "official_agency_website",
                  },
                ],
              },
            },
          },
        ],
      }),
    );

    assert.match(markdown, /SEO competitor research report \(Phase 10\)/);
    assert.match(markdown, /https:\/\/example.com\/guide/);
  });

  it("surfaces failed web research honestly", () => {
    const markdown = buildAssistantSummaryMarkdown(
      minimalPayload({
        toolExecutions: [
          {
            id: "exec-fail",
            stepId: "step-fail",
            toolName: "web_research",
            status: "failed",
            error: "Tavily search timed out before results were returned.",
          },
        ],
      }),
    );

    assert.match(markdown, /Research did not complete/);
    assert.match(markdown, /timed out/i);
  });
});
