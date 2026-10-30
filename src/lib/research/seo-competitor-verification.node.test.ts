import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessCompetitorEvidence,
  buildCompetitorCandidateLabel,
  buildCompetitorCandidates,
} from "./seo-competitor-verification";
import { parseSeoResearchIntent } from "./seo-research-intent";
import { scoreAndFilterSeoFindings, type ScoredSeoFinding } from "./seo-relevance-engine";

function scored(
  partial: {
    title: string;
    url: string;
    snippet: string;
    classification?: ScoredSeoFinding["classification"];
  },
  intent = parseSeoResearchIntent("Find 5 SEO competitors in Chennai"),
): ScoredSeoFinding {
  const [finding] = scoreAndFilterSeoFindings(
    [
      {
        title: partial.title,
        url: partial.url,
        snippet: partial.snippet,
      },
    ],
    intent,
  );
  assert.ok(finding);
  if (partial.classification) {
    return { ...finding, classification: partial.classification };
  }
  return finding;
}

describe("seo competitor verification", () => {
  const intent = parseSeoResearchIntent(
    "Find 5 SEO competitors in Chennai with services comparison",
  );

  it("does not claim top-five verified competitors when evidence is insufficient", () => {
    const findings = scoreAndFilterSeoFindings(
      [
        {
          title: "Chennai SEO Pro",
          url: "https://chennaiseopro.in/",
          snippet: "Chennai SEO agency services.",
        },
      ],
      intent,
    );
    const candidates = buildCompetitorCandidates(findings, intent);
    const label = buildCompetitorCandidateLabel({ intent, candidates });
    assert.match(label, /relevant competitor candidate/i);
    assert.doesNotMatch(label, /top 5 verified/i);
    assert.equal(candidates[0]?.fullyVerified, false);
    assert.equal(candidates[0]?.verificationStatus, "partially_verified");
    assert.match(label, /Fewer than the requested 5|1 relevant competitor candidate/);
    assert.match(label, /0 fully verified/);
  });

  it("deduplicates duplicate domains before candidate construction", () => {
    const findings = scoreAndFilterSeoFindings(
      [
        {
          title: "BrandStory Agency Chennai",
          url: "https://brandstory.example.in/services",
          snippet: "Chennai digital marketing and local SEO services.",
        },
        {
          title: "BrandStory Chennai SEO",
          url: "https://brandstory.example.in/about",
          snippet: "About our Chennai SEO team and operations in Chennai.",
        },
      ],
      intent,
    );
    const candidates = buildCompetitorCandidates(findings, intent);
    assert.equal(candidates.length, 1);
    assert.ok(candidates[0]?.sourceUrls.length >= 2);
    assert.equal(candidates[0]?.officialWebsiteIdentified, true);
    assert.equal(candidates[0]?.chennaiPresenceSupported, true);
    assert.equal(candidates[0]?.fullyVerified, true);
  });

  it("official domain without Chennai evidence is not fully verified", () => {
    const findings = [
      scored({
        title: "National SEO Partners",
        url: "https://nationalseo.example.in/",
        snippet: "Full-service SEO agency for enterprise clients.",
        classification: "official_agency_website",
      }),
    ];
    const assessment = assessCompetitorEvidence(findings, intent);
    assert.equal(assessment.officialWebsiteIdentified, true);
    assert.equal(assessment.chennaiPresenceSupported, false);
    assert.equal(assessment.competitorFullyVerified, false);
    assert.equal(assessment.verificationStatus, "partially_verified");
  });

  it("Chennai in directory only does not verify official site or local presence", () => {
    const findings = [
      scored({
        title: "Agency X | Clutch",
        url: "https://clutch.co/in/agencies/seo/chennai/agency-x",
        snippet: "Agency X is a Chennai SEO firm listed in Clutch directory.",
        classification: "business_directory",
      }),
    ];
    const assessment = assessCompetitorEvidence(findings, intent);
    assert.equal(assessment.officialWebsiteIdentified, false);
    assert.equal(assessment.chennaiPresenceSupported, false);
    assert.equal(assessment.competitorFullyVerified, false);
    assert.ok(
      assessment.evidenceLimitations.some((item) => /directory\/listing/i.test(item)),
    );
  });

  it("explicit Chennai evidence on official contact page supports full verification", () => {
    const findings = [
      scored({
        title: "Contact — PixelRank SEO",
        url: "https://pixelrank.example.in/contact",
        snippet: "Visit our Chennai office at Anna Nagar. Local SEO and technical SEO services.",
        classification: "official_agency_website",
      }),
    ];
    const assessment = assessCompetitorEvidence(findings, intent);
    assert.equal(assessment.officialWebsiteIdentified, true);
    assert.equal(assessment.chennaiPresenceSupported, true);
    assert.equal(assessment.servicesPubliclyDocumented, true);
    assert.equal(assessment.competitorFullyVerified, true);
    assert.ok(assessment.geographicEvidence.some((e) => e.evidenceKind === "official_page_signal"));
  });

  it("flags conflicting geographic information", () => {
    const findings = [
      scored({
        title: "Dual Market SEO",
        url: "https://dualmarket.example.in/about",
        snippet: "Based in Chennai with a New York office serving global clients.",
        classification: "official_agency_website",
      }),
    ];
    const assessment = assessCompetitorEvidence(findings, intent);
    assert.equal(assessment.conflictingGeography, true);
    assert.equal(assessment.competitorFullyVerified, false);
    assert.equal(assessment.verificationStatus, "partially_verified");
  });

  it("requires source URLs on built candidates", () => {
    const findings = scoreAndFilterSeoFindings(
      [
        {
          title: "Chennai SEO Pro",
          url: "https://chennaiseopro.in/",
          snippet: "Chennai SEO agency services.",
        },
      ],
      intent,
    );
    const candidates = buildCompetitorCandidates(findings, intent);
    assert.ok(candidates[0]?.sourceUrls.includes("https://chennaiseopro.in/"));
    assert.ok(candidates[0]?.geographicEvidence.length >= 0);
  });
});
