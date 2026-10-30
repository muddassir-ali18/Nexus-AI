import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCompetitorCandidates,
  type CompetitorCandidate,
} from "@/lib/research/seo-competitor-verification";
import { parseSeoResearchIntent } from "@/lib/research/seo-research-intent";
import { scoreAndFilterSeoFindings } from "@/lib/research/seo-relevance-engine";
import { enrichCompetitorCandidatesWithProfiles } from "./competitor-enrichment-core";
import { buildWebsiteIntelligenceProfile } from "./website-profile-core";
import type { ExtractedPage, PageEvidenceRecord } from "@/lib/website-intelligence/types";

function evidence(partial: Partial<PageEvidenceRecord> & Pick<PageEvidenceRecord, "id" | "evidenceType" | "value">): PageEvidenceRecord {
  return {
    requestedPageUrl: "https://chennaiseopro.in/",
    finalPageUrl: "https://chennaiseopro.in/",
    canonicalUrl: null,
    canonicalUrlStatus: null,
    extractionMethod: "html_parser",
    context: null,
    retrievalStatus: "success",
    ...partial,
  };
}

describe("competitor enrichment core", () => {
  const intent = parseSeoResearchIntent("Find 5 SEO competitors in Chennai");

  it("preserves Phase 10.1 verification and source URLs while attaching profile references", () => {
    const findings = scoreAndFilterSeoFindings(
      [
        {
          title: "Chennai SEO Pro",
          url: "https://chennaiseopro.in/",
          snippet: "Chennai SEO agency offering local SEO services.",
        },
      ],
      intent,
    );
    const candidates = buildCompetitorCandidates(findings, intent);
    assert.equal(candidates.length, 1);
    const before = candidates[0] as CompetitorCandidate;

    const extractedPages: ExtractedPage[] = [
      {
        requestedUrl: "https://chennaiseopro.in/",
        finalPageUrl: "https://chennaiseopro.in/",
        canonicalUrl: null,
        canonicalUrlStatus: "missing",
        canonicalUrlNote: null,
        retrievalStatus: "success",
        evidence: [
          evidence({ id: "t1", evidenceType: "page_title", value: "Chennai SEO Pro" }),
          evidence({ id: "s1", evidenceType: "service_mention", value: "local seo" }),
          evidence({ id: "s2", evidenceType: "service_mention", value: "local seo", finalPageUrl: "https://chennaiseopro.in/services" }),
        ],
        limitations: [],
        boilerplateNotes: [],
        rawVisibleText: "",
        mainVisibleText: "",
      },
    ];

    const profile = buildWebsiteIntelligenceProfile({
      domain: "chennaiseopro.in",
      officialWebsiteUrl: "https://chennaiseopro.in/",
      extractedPages,
      retrievalRecords: [
        {
          requestedUrl: "https://chennaiseopro.in/",
          finalUrl: "https://chennaiseopro.in/",
          canonicalUrl: null,
          status: "success",
          httpStatus: 200,
          contentType: "text/html",
          byteLength: 100,
          redirectChain: [],
          robotsChecked: true,
          robotsAllowed: true,
          retrievedAt: "2026-01-01T00:00:00.000Z",
          errorMessage: null,
          body: null,
        },
      ],
      phase101Verification: {
        verificationStatus: before.verificationStatus,
        fullyVerified: before.fullyVerified,
        officialWebsiteUrl: before.officialWebsiteUrl,
        evidenceLimitations: before.evidenceLimitations,
        searchGeographicEvidenceCount: before.geographicEvidence.length,
      },
    });

    const enriched = enrichCompetitorCandidatesWithProfiles({
      candidates,
      profilesByDomain: new Map([["chennaiseopro.in", profile]]),
    });

    assert.equal(enriched[0]?.verificationStatus, before.verificationStatus);
    assert.equal(enriched[0]?.fullyVerified, before.fullyVerified);
    assert.deepEqual(enriched[0]?.sourceUrls, before.sourceUrls);
    assert.deepEqual(enriched[0]?.geographicEvidence, before.geographicEvidence);
    assert.ok(enriched[0]?.websiteProfile);
    assert.match(enriched[0]?.pageLevelEvidenceNotes.join(" "), /separate provenance/i);
    assert.ok(
      enriched[0]?.missingInformation.some((note) =>
        /missing page types|Website intelligence profile not available|Crawl did not retrieve/i.test(note),
      ) || enriched[0]?.missingInformation.length >= before.missingInformation.length,
    );
  });

  it("keeps search and page evidence separate when profile crawl is empty", () => {
    const candidate: CompetitorCandidate = {
      name: "Example Co",
      websiteUrl: "https://example.co/",
      verificationStatus: "unverified",
      officialWebsiteIdentified: true,
      officialWebsiteUrl: "https://example.co/",
      chennaiPresenceSupported: false,
      servicesPubliclyDocumented: false,
      fullyVerified: false,
      geographicEvidence: [],
      evidenceLimitations: ["Search only."],
      conflictingGeography: false,
      chennaiPresenceEvidence: [],
      statedServices: [],
      positioningNotes: [],
      contentThemes: [],
      sourceUrls: ["https://example.co/"],
      sourceClassifications: ["official_agency_website"],
      missingInformation: ["Needs more evidence."],
    };

    const profile = buildWebsiteIntelligenceProfile({
      domain: "example.co",
      extractedPages: [],
      retrievalRecords: [
        {
          requestedUrl: "https://example.co/",
          finalUrl: null,
          canonicalUrl: null,
          status: "blocked_robots",
          httpStatus: null,
          contentType: null,
          byteLength: null,
          redirectChain: [],
          robotsChecked: true,
          robotsAllowed: false,
          retrievedAt: "2026-01-01T00:00:00.000Z",
          errorMessage: "blocked",
          body: null,
        },
      ],
    });

    const enriched = enrichCompetitorCandidatesWithProfiles({
      candidates: [candidate],
      profilesByDomain: new Map([["example.co", profile]]),
    });

    assert.equal(enriched[0]?.verificationStatus, "unverified");
    assert.match(enriched[0]?.pageLevelEvidenceNotes.join(" "), /no successful HTML/i);
  });
});
