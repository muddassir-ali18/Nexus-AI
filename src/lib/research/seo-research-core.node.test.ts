import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseSeoResearchIntent } from "./seo-research-intent";
import {
  buildSeoSearchQueries,
  dedupeFindingsByUrl,
  looksLikeSeoResearchQuery,
  runBoundedSeoResearch,
} from "./seo-research-core";

describe("seo research core", () => {
  it("detects SEO-oriented research questions", () => {
    assert.equal(
      looksLikeSeoResearchQuery("Research SEO best practices for a bakery"),
      true,
    );
    assert.equal(
      looksLikeSeoResearchQuery("Calculate 10 + 5"),
      false,
    );
  });

  it("builds bounded multi-query plans", () => {
    const queries = buildSeoSearchQueries(
      "Research competitors and SEO for example.com",
    );
    assert.ok(queries.length >= 1);
    assert.ok(queries.length <= 3);
    assert.ok(queries.some((query) => query.includes("example.com")));
  });

  it("dedupes findings by URL", () => {
    const deduped = dedupeFindingsByUrl([
      {
        title: "A",
        url: "https://Example.com/page",
        snippet: "one",
      },
      {
        title: "B",
        url: "https://example.com/page",
        snippet: "two",
      },
    ]);
    assert.equal(deduped.length, 1);
  });

  it("aggregates Tavily results without fabricating metrics", async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async (_input, init) => {
      callCount += 1;
      const body = JSON.parse(String(init?.body)) as { query: string };
      return new Response(
        JSON.stringify({
          results: [
            {
              title: `Result for ${body.query}`,
              url: `https://example.com/${callCount}`,
              content: "Snippet text.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const result = await runBoundedSeoResearch(
      "SEO content brief for SaaS onboarding",
      { apiKey: "tvly-test", fetchImpl: mockFetch },
    );

    assert.ok(result.findings.length >= 1);
    assert.ok(result.queriesExecuted.length >= 1);
    assert.ok(
      result.limitations.some((note) => /not a full website crawl/i.test(note)),
    );
    assert.ok(
      result.limitations.some((note) => /rankings/i.test(note)),
    );
    assert.ok(callCount >= 1);
    assert.ok(result.seoResearchReport);
    assert.ok(Array.isArray(result.scoredFindings));
  });

  it("builds Chennai-focused competitor queries when geography is present", () => {
    const queries = buildSeoSearchQueries(
      "Research 5 SEO competitors in Chennai",
    );
    assert.ok(
      queries.some((query) => /Chennai SEO companies and services/i.test(query)),
    );
    assert.ok(queries.length <= 5);
  });

  it("parses competitor count when adjectives appear between number and competitors", () => {
    const intent = parseSeoResearchIntent(
      "Research 5 SEO agency competitors in Chennai",
    );
    assert.equal(intent.requestedCompetitorCount, 5);
    assert.equal(intent.isCompetitorResearch, true);
    assert.equal(intent.geography, "Chennai");
  });
});
