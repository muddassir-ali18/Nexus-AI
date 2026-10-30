import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeWebResearchCore } from "./web-research-core";
import type { WebResearchToolOutput } from "./types";

describe("web research tool", () => {
  it("runs SEO research mode with multiple queries and retains source URLs", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          results: [
            {
              title: "Example.com SEO Services",
              url: "https://example.com/seo-services",
              content: "Public SEO services information for example.com.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const output = (await executeWebResearchCore(
      {
        query: "Research technical SEO recommendations for example.com",
        seoResearch: true,
      },
      {
        stepId: "step-seo",
        questionId: "q-seo",
        webResearch: { apiKey: "tvly-secret-key", fetchImpl: mockFetch },
      },
    )) as WebResearchToolOutput;

    assert.equal(output.seoResearch, true);
    assert.ok((output.queriesExecuted?.length ?? 0) >= 1);
    assert.ok((output.findingCount ?? 0) >= 1);
    assert.ok(output.findings?.every((item) => item.url.startsWith("http")));
    assert.ok(
      output.investigationEvidence?.every((item) =>
        item.source.startsWith("http"),
      ),
    );

    const serialized = JSON.stringify(output);
    assert.doesNotMatch(serialized, /tvly-secret-key/);
  });

  it("does not mark failed research as successful output", async () => {
    await assert.rejects(
      () =>
        executeWebResearchCore(
          { query: "market trends" },
          { stepId: "s", questionId: "q", webResearch: { apiKey: null } },
        ),
      /not configured/i,
    );
  });
});
