import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  ExtractedPage,
  PageEvidenceRecord,
  PageRetrievalRecord,
} from "@/lib/website-intelligence/types";
import {
  assertProfileEvidenceGrounding,
  buildWebsiteIntelligenceProfile,
} from "./website-profile-core";

function evidence(partial: Partial<PageEvidenceRecord> & Pick<PageEvidenceRecord, "id" | "evidenceType" | "value">): PageEvidenceRecord {
  return {
    requestedPageUrl: partial.requestedPageUrl ?? "https://agency.example/",
    finalPageUrl: partial.finalPageUrl ?? "https://agency.example/",
    canonicalUrl: partial.canonicalUrl ?? null,
    canonicalUrlStatus: partial.canonicalUrlStatus ?? null,
    extractionMethod: partial.extractionMethod ?? "html_parser",
    context: partial.context ?? null,
    retrievalStatus: partial.retrievalStatus ?? "success",
    ...partial,
  };
}

function page(
  finalUrl: string,
  pageEvidence: PageEvidenceRecord[],
  status: ExtractedPage["retrievalStatus"] = "success",
): ExtractedPage {
  return {
    requestedUrl: finalUrl,
    finalPageUrl: finalUrl,
    canonicalUrl: null,
    canonicalUrlStatus: "missing",
    canonicalUrlNote: null,
    retrievalStatus: status,
    evidence: pageEvidence,
    limitations: ["fixture limitation"],
    boilerplateNotes: [],
    rawVisibleText: "",
    mainVisibleText: "",
  };
}

function retrieval(url: string, status: PageRetrievalRecord["status"]): PageRetrievalRecord {
  return {
    requestedUrl: url,
    finalUrl: status === "success" ? url : null,
    canonicalUrl: null,
    status,
    httpStatus: status === "success" ? 200 : null,
    contentType: status === "success" ? "text/html" : null,
    byteLength: null,
    redirectChain: [],
    robotsChecked: true,
    robotsAllowed: status !== "blocked_robots",
    retrievedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: status === "success" ? null : "error",
    body: null,
  };
}

describe("website profile core", () => {
  it("aggregates multiple pages from one domain with deduplicated services", () => {
    const home = page("https://agency.example/", [
      evidence({ id: "t1", evidenceType: "page_title", value: "Agency Example Home" }),
      evidence({
        id: "s1",
        evidenceType: "service_mention",
        value: "local seo",
        finalPageUrl: "https://agency.example/",
      }),
      evidence({
        id: "m1",
        evidenceType: "visible_text",
        extractionMethod: "heuristic_main_content",
        value: "We offer local SEO for Chennai businesses.",
      }),
    ]);
    const services = page("https://agency.example/services", [
      evidence({ id: "t2", evidenceType: "page_title", value: "Services" }),
      evidence({ id: "h1", evidenceType: "heading", value: "Our Services", context: "h2" }),
      evidence({
        id: "s2",
        evidenceType: "service_mention",
        value: "Local SEO",
        finalPageUrl: "https://agency.example/services",
      }),
    ]);

    const profile = buildWebsiteIntelligenceProfile({
      domain: "agency.example",
      extractedPages: [home, services],
      retrievalRecords: [
        retrieval("https://agency.example/", "success"),
        retrieval("https://agency.example/services", "success"),
      ],
    });

    assert.equal(profile.documentedServices.length, 1);
    assert.equal(profile.documentedServices[0]?.normalizedLabel, "Local SEO");
    assert.deepEqual(profile.documentedServices[0]?.evidenceIds.sort(), ["s1", "s2"]);
    assert.equal(profile.documentedServices[0]?.sourcePageUrls.length, 2);
    assert.match(profile.crawlCoverage.coverageDisclaimer, /Partial crawl/i);
  });

  it("preserves conflicting business names instead of picking one", () => {
    const profile = buildWebsiteIntelligenceProfile({
      domain: "agency.example",
      extractedPages: [
        page("https://agency.example/", [
          evidence({ id: "a", evidenceType: "page_title", value: "Alpha SEO" }),
        ]),
        page("https://agency.example/about", [
          evidence({ id: "b", evidenceType: "og_site_name", value: "Beta Marketing", extractionMethod: "meta_tag" }),
        ]),
      ],
      retrievalRecords: [
        retrieval("https://agency.example/", "success"),
        retrieval("https://agency.example/about", "success"),
      ],
    });

    assert.ok(profile.businessIdentity.conflictingNames.includes("Alpha SEO"));
    assert.ok(profile.businessIdentity.conflictingNames.includes("Beta Marketing"));
  });

  it("distinguishes explicit location statements from incidental city mentions", () => {
    const explicit = page("https://agency.example/contact", [
      evidence({
        id: "loc1",
        evidenceType: "location_mention",
        value: "Chennai",
        finalPageUrl: "https://agency.example/contact",
      }),
      evidence({
        id: "txt1",
        evidenceType: "visible_text",
        extractionMethod: "heuristic_main_content",
        value: "Our office in Chennai serves Tamil Nadu clients.",
      }),
    ]);
    const incidental = page("https://agency.example/blog/post", [
      evidence({
        id: "loc2",
        evidenceType: "location_mention",
        value: "Chennai",
        finalPageUrl: "https://agency.example/blog/post",
      }),
      evidence({
        id: "txt2",
        evidenceType: "visible_text",
        extractionMethod: "heuristic_main_content",
        value: "Many startups in Chennai read our blog.",
      }),
    ]);

    const profile = buildWebsiteIntelligenceProfile({
      domain: "agency.example",
      extractedPages: [explicit, incidental],
      retrievalRecords: [
        retrieval("https://agency.example/contact", "success"),
        retrieval("https://agency.example/blog/post", "success"),
      ],
    });

    const explicitSignal = profile.geographicSignals.find((g) => g.label === "Chennai" && g.kind === "explicit_office_or_address");
    const incidentalSignal = profile.geographicSignals.find(
      (g) => g.label === "Chennai" && g.kind === "city_or_region_mention",
    );
    assert.ok(explicitSignal);
    assert.ok(incidentalSignal);
    assert.notEqual(explicitSignal?.kind, incidentalSignal?.kind);
  });

  it("drops unsupported single-keyword service claims without service context", () => {
    const profile = buildWebsiteIntelligenceProfile({
      domain: "agency.example",
      extractedPages: [
        page("https://agency.example/", [
          evidence({
            id: "solo",
            evidenceType: "service_mention",
            value: "ppc",
          }),
        ]),
      ],
      retrievalRecords: [retrieval("https://agency.example/", "success")],
    });
    assert.equal(profile.documentedServices.length, 0);
  });

  it("throws when profile claims lack evidence IDs", () => {
    assert.throws(() =>
      assertProfileEvidenceGrounding({
        businessIdentity: [{ name: "X", source: "page_title", evidenceIds: [], confidence: "low" }],
        documentedServices: [],
        geographicSignals: [],
        valuePropositions: [],
        targetCustomerIndicators: [],
        blogCategories: [],
        contentThemes: [],
        internalLinkHubs: [],
        pageStructure: [],
      }),
    );
  });

  it("reports partial crawl coverage, robots blocks, and failed pages", () => {
    const profile = buildWebsiteIntelligenceProfile({
      domain: "agency.example",
      maxPageLimit: 3,
      extractedPages: [
        page("https://agency.example/", [], "blocked_robots"),
        page("https://agency.example/services", [], "http_error"),
      ],
      retrievalRecords: [
        retrieval("https://agency.example/", "blocked_robots"),
        retrieval("https://agency.example/services", "http_error"),
        retrieval("https://agency.example/contact", "domain_page_limit"),
      ],
    });

    assert.equal(profile.crawlCoverage.pagesAttempted, 3);
    assert.equal(profile.crawlCoverage.pagesRetrievedSuccessfully, 0);
    assert.equal(profile.crawlCoverage.pagesBlockedByRobots, 1);
    assert.ok(profile.crawlCoverage.failedPagesByStatus.http_error === 1);
    assert.match(profile.crawlCoverage.coverageDisclaimer, /Not a complete website audit/i);
    assert.ok(profile.crawlCoverage.missingPageTypes.includes("homepage"));
  });

  it("preserves Phase 10.1 verification without upgrading it", () => {
    const profile = buildWebsiteIntelligenceProfile({
      domain: "agency.example",
      extractedPages: [
        page("https://agency.example/", [
          evidence({ id: "t", evidenceType: "page_title", value: "Agency" }),
          evidence({
            id: "loc",
            evidenceType: "location_mention",
            value: "Chennai",
          }),
          evidence({
            id: "vis",
            evidenceType: "visible_text",
            extractionMethod: "heuristic_main_content",
            value: "Chennai trends in search.",
          }),
        ]),
      ],
      retrievalRecords: [retrieval("https://agency.example/", "success")],
      phase101Verification: {
        verificationStatus: "partially_verified",
        fullyVerified: false,
        officialWebsiteUrl: "https://agency.example/",
        evidenceLimitations: ["Search snippets only."],
        searchGeographicEvidenceCount: 1,
      },
    });

    assert.equal(profile.phase101Verification?.verificationStatus, "partially_verified");
    assert.equal(profile.phase101Verification?.fullyVerified, false);
    assert.match(profile.phase101Verification?.preservationNote ?? "", /does not upgrade/i);
  });

  it("produces deterministic profile output for identical input", () => {
    const input = {
      domain: "agency.example",
      extractedPages: [
        page("https://agency.example/", [
          evidence({ id: "z", evidenceType: "page_title", value: "Zed Agency" }),
          evidence({ id: "l1", evidenceType: "internal_link", value: "https://agency.example/services", context: "anchor: Services" }),
          evidence({ id: "l2", evidenceType: "internal_link", value: "https://agency.example/services", context: "anchor: SEO Services" }),
        ]),
      ],
      retrievalRecords: [retrieval("https://agency.example/", "success")],
    };
    const a = buildWebsiteIntelligenceProfile(input);
    const b = buildWebsiteIntelligenceProfile(input);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.equal(a.internalLinkHubs[0]?.inboundLinkCount, 2);
  });
});
