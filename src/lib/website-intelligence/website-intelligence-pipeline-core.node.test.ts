import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CompetitorCandidate } from "@/lib/research/seo-competitor-verification";
import type { ExtractedPage, PageRetrievalRecord } from "@/lib/website-intelligence/types";
import { buildWebsiteIntelligenceProfile } from "@/lib/website-intelligence/profile/website-profile-core";
import {
  assessCandidateEligibility,
  planBoundedCrawlUrls,
  runWebsiteIntelligencePipeline,
  type WebsiteIntelligencePipelineDeps,
} from "./website-intelligence-pipeline-core";

function candidate(
  partial: Partial<CompetitorCandidate> & Pick<CompetitorCandidate, "name">,
): CompetitorCandidate {
  const officialWebsiteUrl =
    partial.officialWebsiteUrl ?? "https://agency.example/";
  return {
    websiteUrl: partial.websiteUrl ?? officialWebsiteUrl,
    verificationStatus: partial.verificationStatus ?? "partially_verified",
    officialWebsiteIdentified: partial.officialWebsiteIdentified ?? true,
    officialWebsiteUrl,
    chennaiPresenceSupported: partial.chennaiPresenceSupported ?? false,
    servicesPubliclyDocumented: partial.servicesPubliclyDocumented ?? false,
    fullyVerified: partial.fullyVerified ?? false,
    geographicEvidence: partial.geographicEvidence ?? [],
    evidenceLimitations: partial.evidenceLimitations ?? ["Search snippets only."],
    conflictingGeography: partial.conflictingGeography ?? false,
    chennaiPresenceEvidence: partial.chennaiPresenceEvidence ?? [],
    statedServices: partial.statedServices ?? [],
    positioningNotes: partial.positioningNotes ?? [],
    contentThemes: partial.contentThemes ?? [],
    sourceUrls: partial.sourceUrls ?? [officialWebsiteUrl],
    sourceClassifications: partial.sourceClassifications ?? ["official_agency_website"],
    missingInformation: partial.missingInformation ?? [],
    ...partial,
  };
}

function retrievalRecord(input: {
  requestedUrl: string;
  status: PageRetrievalRecord["status"];
  html?: string;
}): PageRetrievalRecord {
  return {
    requestedUrl: input.requestedUrl,
    finalUrl: input.status === "success" ? input.requestedUrl : null,
    canonicalUrl: null,
    status: input.status,
    httpStatus: input.status === "success" ? 200 : null,
    contentType: input.status === "success" ? "text/html" : null,
    byteLength: input.html ? Buffer.byteLength(input.html) : null,
    redirectChain: input.status === "success" ? [input.requestedUrl] : [],
    robotsChecked: true,
    robotsAllowed: input.status !== "blocked_robots",
    retrievedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: input.status === "success" ? null : "Retrieval failed.",
    body: input.html ? Buffer.from(input.html) : null,
  };
}

function mockExtract(record: PageRetrievalRecord): ExtractedPage {
  const id = `evidence-${record.requestedUrl}`;
  return {
    requestedUrl: record.requestedUrl,
    finalPageUrl: record.finalUrl ?? record.requestedUrl,
    canonicalUrl: null,
    canonicalUrlStatus: "missing",
    canonicalUrlNote: null,
    retrievalStatus: record.status,
    evidence:
      record.status === "success"
        ? [
            {
              id,
              requestedPageUrl: record.requestedUrl,
              finalPageUrl: record.finalUrl ?? record.requestedUrl,
              canonicalUrl: null,
              canonicalUrlStatus: null,
              evidenceType: "page_title",
              extractionMethod: "html_parser",
              value: "Fixture Title",
              context: "document title",
              retrievalStatus: "success",
            },
          ]
        : [],
    limitations: ["fixture"],
    boilerplateNotes: [],
    rawVisibleText: "",
    mainVisibleText: "",
  };
}

function mockDeps(
  handler: (url: string) => PageRetrievalRecord,
): WebsiteIntelligencePipelineDeps {
  return {
    retrievePage: async (options) => handler(options.url),
    extractPage: ({ retrieval }) => mockExtract(retrieval),
    buildProfile: buildWebsiteIntelligenceProfile,
  };
}

describe("website intelligence pipeline core", () => {
  it("assesses directory-only and missing official website candidates as excluded", () => {
    const noOfficial = assessCandidateEligibility(
      candidate({
        name: "No Site",
        officialWebsiteIdentified: false,
        officialWebsiteUrl: null,
      }),
    );
    assert.equal(noOfficial.eligibility, "excluded");

    const directoryOnly = assessCandidateEligibility(
      candidate({
        name: "Directory Only",
        officialWebsiteUrl: "https://www.clutch.co/profile/acme",
        sourceClassifications: ["business_directory"],
        sourceUrls: ["https://www.clutch.co/profile/acme"],
      }),
    );
    assert.equal(directoryOnly.eligibility, "excluded");
    assert.match(directoryOnly.exclusionReason ?? "", /directory/i);
  });

  it("plans bounded crawl URLs on the official origin only", () => {
    const urls = planBoundedCrawlUrls("https://agency.example/home", 3);
    assert.equal(urls.length, 3);
    assert.ok(urls.every((url) => url.startsWith("https://agency.example/")));
  });

  it("runs retrieval and extraction for multiple eligible candidates", async () => {
    const html = "<html><body><h1>Agency</h1><p>We offer local SEO services.</p></body></html>";
    const calls: string[] = [];
    const deps = mockDeps((url) => {
      calls.push(url);
      return retrievalRecord({ requestedUrl: url, status: "success", html });
    });

    const report = await runWebsiteIntelligencePipeline(
      {
        candidates: [
          candidate({ name: "Alpha", officialWebsiteUrl: "https://alpha.example/" }),
          candidate({ name: "Beta", officialWebsiteUrl: "https://beta.example/" }),
        ],
        maxPagesPerDomain: 2,
      },
      deps,
    );

    assert.ok(calls.length >= 4);
    assert.equal(report.totalSuccessfulExtractions >= 2, true);
    assert.ok(report.comparisonReport);
    assert.equal(report.enrichedCandidates.length, 2);
    assert.equal(report.enrichedCandidates[0]?.sourceUrls.length > 0, true);
  });

  it("preserves Phase 10.1 verification fields on enriched candidates", async () => {
    const deps = mockDeps((url) =>
      retrievalRecord({
        requestedUrl: url,
        status: "success",
        html: "<html><body>content</body></html>",
      }),
    );
    const original = candidate({
      name: "Partial Co",
      verificationStatus: "partially_verified",
      fullyVerified: false,
      chennaiPresenceSupported: false,
      officialWebsiteUrl: "https://partial.example/",
      sourceUrls: ["https://partial.example/"],
    });

    const report = await runWebsiteIntelligencePipeline({ candidates: [original] }, deps);
    const enriched = report.enrichedCandidates[0];
    assert.equal(enriched?.verificationStatus, "partially_verified");
    assert.equal(enriched?.fullyVerified, false);
    assert.deepEqual(enriched?.sourceUrls, original.sourceUrls);
    assert.equal(enriched?.chennaiPresenceSupported, false);
  });

  it("does not build a profile when no pages were retrieved successfully", async () => {
    const deps = mockDeps((url) =>
      retrievalRecord({ requestedUrl: url, status: "blocked_robots" }),
    );
    const report = await runWebsiteIntelligencePipeline(
      { candidates: [candidate({ name: "Blocked", officialWebsiteUrl: "https://blocked.example/" })] },
      deps,
    );
    const record = report.candidateRecords[0];
    assert.equal(record?.profile, null);
    assert.equal(report.status, "insufficient_profiles");
    assert.match(report.comparisonLimitation ?? "", /comparison was not run/i);
  });

  it("records robots-blocked and unsupported content type retrievals without fabrication", async () => {
    const deps = mockDeps((url) => {
      if (url.includes("/services")) {
        return retrievalRecord({ requestedUrl: url, status: "unsupported_content_type" });
      }
      return retrievalRecord({ requestedUrl: url, status: "blocked_robots" });
    });
    const report = await runWebsiteIntelligencePipeline(
      { candidates: [candidate({ name: "Mixed", officialWebsiteUrl: "https://mixed.example/" })] },
      deps,
    );
    const statuses = report.candidateRecords[0]?.retrievalRecords.map((item) => item.status) ?? [];
    assert.ok(statuses.includes("blocked_robots"));
    assert.ok(statuses.includes("unsupported_content_type"));
    assert.equal(report.candidateRecords[0]?.extractedPages.every((p) => p.evidence.length === 0 || p.retrievalStatus !== "success"), true);
  });

  it("returns no_eligible_candidates when every candidate is excluded", async () => {
    const report = await runWebsiteIntelligencePipeline(
      {
        candidates: [
          candidate({
            name: "A",
            officialWebsiteIdentified: false,
            officialWebsiteUrl: null,
          }),
        ],
      },
      mockDeps((url) => retrievalRecord({ requestedUrl: url, status: "success", html: "<html/>" })),
    );
    assert.equal(report.status, "no_eligible_candidates");
    assert.equal(report.excludedCandidates.length, 1);
  });

  it("sanitizes pipeline errors and marks status failed", async () => {
    const deps: WebsiteIntelligencePipelineDeps = {
      retrievePage: async () => {
        throw new Error("connect ECONNREFUSED 192.168.1.50:443");
      },
      extractPage: ({ retrieval }) => mockExtract(retrieval),
      buildProfile: buildWebsiteIntelligenceProfile,
    };
    const report = await runWebsiteIntelligencePipeline(
      { candidates: [candidate({ name: "Err", officialWebsiteUrl: "https://err.example/" })] },
      deps,
    );
    assert.equal(report.status, "failed");
    assert.match(report.sanitizedError ?? "", /\[ip\]/);
    assert.doesNotMatch(report.sanitizedError ?? "", /192\.168\.1\.50/);
  });

  it("produces deterministic output with identical inputs and mock dependencies", async () => {
    const html = "<html><body><p>Services page</p></body></html>";
    const deps = mockDeps((url) =>
      retrievalRecord({ requestedUrl: url, status: "success", html }),
    );
    const input = {
      candidates: [
        candidate({ name: "One", officialWebsiteUrl: "https://one.example/" }),
        candidate({ name: "Two", officialWebsiteUrl: "https://two.example/" }),
      ],
      maxPagesPerDomain: 2,
    };
    const first = await runWebsiteIntelligencePipeline(input, deps);
    const second = await runWebsiteIntelligencePipeline(input, deps);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });

  it("collects provenance evidence IDs and source URLs from extracted pages", async () => {
    const deps = mockDeps((url) =>
      retrievalRecord({
        requestedUrl: url,
        status: "success",
        html: "<html><body>ok</body></html>",
      }),
    );
    const report = await runWebsiteIntelligencePipeline(
      {
        candidates: [
          candidate({ name: "P1", officialWebsiteUrl: "https://p1.example/" }),
          candidate({ name: "P2", officialWebsiteUrl: "https://p2.example/" }),
        ],
        maxPagesPerDomain: 1,
      },
      deps,
    );
    assert.ok(report.provenanceEvidenceIds.length > 0);
    assert.ok(report.provenanceSourceUrls.some((url) => url.includes("p1.example")));
  });
});
