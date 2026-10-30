import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runBoundedSeoResearch } from "./seo-research-core";

const CHENNAI_QUESTION =
  "Research 5 SEO agency competitors in Chennai. Compare services, positioning, and public content themes.";

describe("Chennai SEO competitor research pipeline (mocked Tavily)", () => {
  it("filters irrelevant international and educational results and reports honest verification counts", async () => {
    const responses: Record<string, unknown> = {
      [CHENNAI_QUESTION]: {
        results: [
          {
            title: "How to Do SEO",
            url: "https://moz.com/learn/seo/what-is-seo",
            content: "Educational SEO guide.",
          },
        ],
      },
      "SEO agency in Chennai official website": {
        results: [
          {
            title: "Chennai SEO Pro",
            url: "https://chennaiseopro.in/",
            content: "Chennai SEO agency providing local SEO and technical SEO.",
          },
          {
            title: "US SEO Leaders NYC",
            url: "https://us-seo-leaders.example.com/",
            content: "New York SEO agency serving global clients.",
          },
        ],
      },
      "Chennai SEO companies and services": {
        results: [
          {
            title: "RankGrow Chennai SEO",
            url: "https://rankgrowchennai.example.in/services",
            content: "SEO services for Chennai businesses.",
          },
        ],
      },
      "Chennai digital marketing agencies offering SEO": {
        results: [
          {
            title: "Top SEO Agencies in Chennai | Clutch",
            url: "https://clutch.co/in/agencies/seo/chennai",
            content: "Directory of Chennai SEO firms.",
          },
        ],
      },
      "Chennai SEO agency case studies blog content strategy": {
        results: [],
      },
    };

    const mockFetch: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { query: string };
      const payload = responses[body.query] ?? { results: [] };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await runBoundedSeoResearch(CHENNAI_QUESTION, {
      apiKey: "tvly-test",
      fetchImpl: mockFetch,
    });

    assert.ok(result.seoResearchReport);
    assert.match(result.seoResearchReport.executiveSummary, /competitor candidate/i);
    assert.doesNotMatch(result.seoResearchReport.executiveSummary, /5 verified/i);
    assert.ok(result.seoResearchReport.filteredIrrelevantCount >= 1);
    assert.ok(result.seoResearchReport.competitors.length >= 1);
    assert.ok(result.seoResearchReport.competitors.length <= 5);
    assert.ok(
      result.scoredFindings.some(
        (item) => item.url.includes("moz.com") && item.excludedFromCompetitorEvidence,
      ),
    );
    assert.ok(result.emptyQueries.includes("Chennai SEO agency case studies blog content strategy"));
    assert.ok(
      result.findings.every((item) => item.url.startsWith("http")),
    );
  });

  it("records failed Tavily queries without fabricating results", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ error: "Rate limit" }), { status: 429 });

    const result = await runBoundedSeoResearch(CHENNAI_QUESTION, {
      apiKey: "tvly-test",
      fetchImpl: mockFetch,
    });

    assert.equal(result.findings.length, 0);
    assert.ok(result.failedQueries.length > 0);
    assert.match(result.seoResearchReport.executiveSummary, /failed/i);
  });
});
