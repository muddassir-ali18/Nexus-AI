import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseSeoResearchIntent } from "./seo-research-intent";
import {
  classifySeoSource,
  scoreAndFilterSeoFindings,
} from "./seo-relevance-engine";

describe("seo relevance engine", () => {
  const chennaiIntent = parseSeoResearchIntent(
    "Identify 5 SEO agency competitors in Chennai and compare services and content",
  );

  it("classifies generic SEO educational articles separately from agencies", () => {
    const finding = {
      title: "How to Improve SEO Rankings: A Complete Guide",
      url: "https://moz.com/beginner-guide-to-seo",
      snippet: "Learn SEO fundamentals and best practices.",
    };
    assert.equal(
      classifySeoSource(finding, chennaiIntent),
      "seo_educational",
    );
  });

  it("filters irrelevant international agencies for Chennai local research", () => {
    const finding = {
      title: "Global SEO Firm New York",
      url: "https://example-global-seo.com/services",
      snippet: "Enterprise SEO agency serving New York and London clients.",
    };
    const scored = scoreAndFilterSeoFindings([finding], chennaiIntent)[0];
    assert.equal(scored?.classification, "irrelevant");
    assert.equal(scored?.excludedFromCompetitorEvidence, true);
  });

  it("keeps Chennai agency official websites and marks geographic relevance", () => {
    const finding = {
      title: "Chennai SEO Pro Agency",
      url: "https://chennaiseopro.in/services",
      snippet: "Chennai-based SEO agency offering local SEO and technical SEO services.",
    };
    const scored = scoreAndFilterSeoFindings([finding], chennaiIntent)[0];
    assert.equal(scored?.classification, "official_agency_website");
    assert.equal(scored?.excludedFromCompetitorEvidence, false);
    assert.ok((scored?.geographicRelevance ?? 0) >= 0.2);
  });

  it("treats directories as discovery sources with limited claim strength", () => {
    const finding = {
      title: "Top SEO Agencies in Chennai - Clutch",
      url: "https://clutch.co/in/agencies/seo/chennai",
      snippet: "Compare Chennai SEO companies.",
    };
    const scored = scoreAndFilterSeoFindings([finding], chennaiIntent)[0];
    assert.equal(scored?.classification, "business_directory");
    assert.equal(scored?.excludedFromCompetitorEvidence, false);
  });
});
