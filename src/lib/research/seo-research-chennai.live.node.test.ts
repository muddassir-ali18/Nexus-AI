import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readWebResearchApiKey } from "./web-research-core";
import { runBoundedSeoResearch } from "./seo-research-core";

const CHENNAI_QUESTION =
  "Research 5 SEO agency competitors in Chennai. Compare services, positioning, and public content themes.";

const liveTavily = Boolean(readWebResearchApiKey());

describe("Chennai SEO competitor research (live Tavily smoke)", () => {
  it(
    "returns evidence-grounded candidates without claiming five verified competitors",
    { skip: !liveTavily },
    async () => {
      const result = await runBoundedSeoResearch(CHENNAI_QUESTION);
      const report = result.seoResearchReport;

      assert.ok(report);
      assert.match(report.executiveSummary, /competitor candidate/i);
      assert.doesNotMatch(report.executiveSummary, /\btop\s*5\s*verified/i);
      assert.doesNotMatch(
        report.executiveSummary,
        /all (five|5) (competitors|agencies) (have been )?verified/i,
      );
      assert.ok(result.queriesExecuted.length >= 1);
      assert.ok(
        result.findings.every((item) => item.url.startsWith("http")),
        "source URLs must be preserved",
      );

      if (report.competitors.length > 0) {
        assert.ok(report.verifiedCount + report.partiallyVerifiedCount <= report.competitors.length);
        for (const competitor of report.competitors) {
          assert.ok(competitor.sourceUrls.length >= 1);
        }
      }
    },
  );
});
