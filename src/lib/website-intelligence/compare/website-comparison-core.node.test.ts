import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WebsiteIntelligenceProfile } from "@/lib/website-intelligence/profile/website-profile-core";
import {
  assertComparisonEvidenceGrounding,
  compareWebsiteIntelligenceProfiles,
} from "./website-comparison-core";

function emptyCrawl(partial: Partial<WebsiteIntelligenceProfile["crawlCoverage"]> = {}) {
  return {
    pagesAttempted: partial.pagesAttempted ?? 2,
    pagesRetrievedSuccessfully: partial.pagesRetrievedSuccessfully ?? 2,
    pagesBlockedByRobots: partial.pagesBlockedByRobots ?? 0,
    failedPagesByStatus: partial.failedPagesByStatus ?? {},
    maxPageLimit: partial.maxPageLimit ?? 3,
    missingPageTypes: partial.missingPageTypes ?? [],
    extractionLimitations: partial.extractionLimitations ?? ["fixture limitation"],
    coverageDisclaimer: partial.coverageDisclaimer ?? "Partial crawl only (2/2 pages retrieved successfully; limit 3 per domain). Not a complete website audit.",
  };
}

function profile(partial: Partial<WebsiteIntelligenceProfile> & Pick<WebsiteIntelligenceProfile, "domain">): WebsiteIntelligenceProfile {
  return {
    domain: partial.domain,
    officialWebsiteUrl: partial.officialWebsiteUrl ?? `https://${partial.domain}/`,
    businessIdentity: partial.businessIdentity ?? { candidates: [], conflictingNames: [] },
    documentedServices: partial.documentedServices ?? [],
    geographicSignals: partial.geographicSignals ?? [],
    valuePropositions: partial.valuePropositions ?? [],
    targetCustomerIndicators: partial.targetCustomerIndicators ?? [],
    pageStructure: partial.pageStructure ?? [],
    blogCategories: partial.blogCategories ?? [],
    contentThemes: partial.contentThemes ?? [],
    internalLinkHubs: partial.internalLinkHubs ?? [],
    evidenceSources: partial.evidenceSources ?? [],
    crawlCoverage: partial.crawlCoverage ?? emptyCrawl(),
    phase101Verification: partial.phase101Verification ?? null,
    profileLimitations: partial.profileLimitations ?? ["fixture profile limitation"],
  };
}

describe("website comparison core", () => {
  it("compares two profiles with observed services and preserves source URLs", () => {
    const a = profile({
      domain: "alpha.example",
      businessIdentity: {
        candidates: [{ name: "Alpha SEO", source: "homepage_title", evidenceIds: ["a-name"], confidence: "high" }],
        conflictingNames: [],
      },
      documentedServices: [
        {
          normalizedLabel: "Local SEO",
          originalWordings: ["local seo"],
          evidenceIds: ["a-s1"],
          sourcePageUrls: ["https://alpha.example/services"],
          confidence: "high",
        },
      ],
      pageStructure: [
        {
          requestedUrl: "https://alpha.example/",
          finalPageUrl: "https://alpha.example/",
          retrievalStatus: "success",
          title: "Alpha SEO",
          titleEvidenceId: "a-title",
          headings: [],
        },
        {
          requestedUrl: "https://alpha.example/services",
          finalPageUrl: "https://alpha.example/services",
          retrievalStatus: "success",
          title: "Services",
          titleEvidenceId: "a-stitle",
          headings: [],
        },
      ],
      crawlCoverage: emptyCrawl({ missingPageTypes: [] }),
    });
    const c = profile({
      domain: "gamma.example",
      documentedServices: [
        {
          normalizedLabel: "Local SEO",
          originalWordings: ["local seo"],
          evidenceIds: ["g-s1"],
          sourcePageUrls: ["https://gamma.example/services"],
          confidence: "high",
        },
        {
          normalizedLabel: "Technical SEO",
          originalWordings: ["technical seo"],
          evidenceIds: ["g-s2"],
          sourcePageUrls: ["https://gamma.example/services"],
          confidence: "high",
        },
      ],
      pageStructure: [
        {
          requestedUrl: "https://gamma.example/services",
          finalPageUrl: "https://gamma.example/services",
          retrievalStatus: "success",
          title: "Services",
          titleEvidenceId: "g-stitle",
          headings: [],
        },
        {
          requestedUrl: "https://gamma.example/",
          finalPageUrl: "https://gamma.example/",
          retrievalStatus: "success",
          title: "Gamma",
          titleEvidenceId: "g-home",
          headings: [],
        },
      ],
      crawlCoverage: emptyCrawl({ missingPageTypes: [] }),
    });
    const b = profile({
      domain: "beta.example",
      businessIdentity: {
        candidates: [{ name: "Beta Agency", source: "homepage_title", evidenceIds: ["b-name"], confidence: "high" }],
        conflictingNames: [],
      },
      documentedServices: [
        {
          normalizedLabel: "Local SEO",
          originalWordings: ["Local SEO"],
          evidenceIds: ["b-s1"],
          sourcePageUrls: ["https://beta.example/services"],
          confidence: "high",
        },
        {
          normalizedLabel: "Technical SEO",
          originalWordings: ["technical seo"],
          evidenceIds: ["b-s2"],
          sourcePageUrls: ["https://beta.example/services"],
          confidence: "high",
        },
      ],
      pageStructure: [
        {
          requestedUrl: "https://beta.example/services",
          finalPageUrl: "https://beta.example/services",
          retrievalStatus: "success",
          title: "Services",
          titleEvidenceId: "b-stitle",
          headings: [],
        },
        {
          requestedUrl: "https://beta.example/about",
          finalPageUrl: "https://beta.example/about",
          retrievalStatus: "success",
          title: "About",
          titleEvidenceId: "b-about",
          headings: [],
        },
      ],
      crawlCoverage: emptyCrawl({ missingPageTypes: [] }),
    });

    const report = compareWebsiteIntelligenceProfiles([a, b, c]);
    const alphaServices = report.observations.find(
      (o) => o.domain === "alpha.example" && o.dimension === "documented_services",
    );
    assert.equal(alphaServices?.state, "observed");
    assert.ok(alphaServices?.sourcePageUrls.includes("https://alpha.example/services"));

    const serviceHypothesis = report.opportunities.find(
      (o) => o.dimension === "documented_services" && o.relatedDomains.includes("alpha.example"),
    );
    assert.ok(serviceHypothesis);
    assert.equal(serviceHypothesis?.isHypothesis, true);
    assert.match(serviceHypothesis?.hypothesis ?? "", /Technical SEO/i);
    assert.match(serviceHypothesis?.hypothesisDisclaimer ?? "", /not a verified market gap/i);
  });

  it("uses insufficient_evidence instead of treating missing service pages as absent services", () => {
    const sparse = profile({
      domain: "sparse.example",
      pageStructure: [
        {
          requestedUrl: "https://sparse.example/",
          finalPageUrl: "https://sparse.example/",
          retrievalStatus: "success",
          title: "Home",
          titleEvidenceId: "s1",
          headings: [],
        },
      ],
      crawlCoverage: emptyCrawl({
        pagesRetrievedSuccessfully: 1,
        pagesAttempted: 1,
        missingPageTypes: ["services", "blog", "contact_or_about"],
      }),
    });
    const rich = profile({
      domain: "rich.example",
      documentedServices: [
        {
          normalizedLabel: "Local SEO",
          originalWordings: ["local seo"],
          evidenceIds: ["r1"],
          sourcePageUrls: ["https://rich.example/services"],
          confidence: "high",
        },
      ],
      pageStructure: [
        {
          requestedUrl: "https://rich.example/services",
          finalPageUrl: "https://rich.example/services",
          retrievalStatus: "success",
          title: "Services",
          titleEvidenceId: "r-title",
          headings: [],
        },
        {
          requestedUrl: "https://rich.example/",
          finalPageUrl: "https://rich.example/",
          retrievalStatus: "success",
          title: "Rich",
          titleEvidenceId: "r-home",
          headings: [],
        },
      ],
    });

    const report = compareWebsiteIntelligenceProfiles([sparse, rich]);
    const sparseServices = report.observations.find(
      (o) => o.domain === "sparse.example" && o.dimension === "documented_services",
    );
    assert.equal(sparseServices?.state, "insufficient_evidence");
    assert.ok(
      !report.opportunities.some(
        (o) =>
          o.dimension === "documented_services" &&
          o.hypothesis.includes("sparse.example") &&
          o.hypothesis.toLowerCase().includes("does not offer"),
      ),
    );
  });

  it("marks crawl_unavailable when no pages were retrieved", () => {
    const failed = profile({
      domain: "down.example",
      crawlCoverage: emptyCrawl({
        pagesRetrievedSuccessfully: 0,
        pagesAttempted: 2,
        pagesBlockedByRobots: 1,
      }),
    });
    const ok = profile({
      domain: "up.example",
      documentedServices: [
        {
          normalizedLabel: "SEO Audit",
          originalWordings: ["seo audit"],
          evidenceIds: ["u1"],
          sourcePageUrls: ["https://up.example/services"],
          confidence: "high",
        },
      ],
      pageStructure: [
        {
          requestedUrl: "https://up.example/services",
          finalPageUrl: "https://up.example/services",
          retrievalStatus: "success",
          title: "Services",
          titleEvidenceId: "u-title",
          headings: [],
        },
        {
          requestedUrl: "https://up.example/",
          finalPageUrl: "https://up.example/",
          retrievalStatus: "success",
          title: "Up",
          titleEvidenceId: "u-home",
          headings: [],
        },
      ],
    });

    const report = compareWebsiteIntelligenceProfiles([failed, ok]);
    const down = report.observations.find((o) => o.domain === "down.example");
    assert.equal(down?.state, "crawl_unavailable");
  });

  it("does not emit service-gap hypotheses when services are identical", () => {
    const baseService = {
      normalizedLabel: "Local SEO",
      originalWordings: ["local seo"],
      evidenceIds: ["x1"],
      sourcePageUrls: ["https://x.example/services"],
      confidence: "high" as const,
    };
    const structure = [
      {
        requestedUrl: "https://x.example/services",
        finalPageUrl: "https://x.example/services",
        retrievalStatus: "success" as const,
        title: "Services",
        titleEvidenceId: "t",
        headings: [],
      },
      {
        requestedUrl: "https://x.example/",
        finalPageUrl: "https://x.example/",
        retrievalStatus: "success" as const,
        title: "Home",
        titleEvidenceId: "h",
        headings: [],
      },
    ];
    const report = compareWebsiteIntelligenceProfiles([
      profile({ domain: "one.example", documentedServices: [baseService], pageStructure: structure }),
      profile({
        domain: "two.example",
        documentedServices: [{ ...baseService, evidenceIds: ["x2"], sourcePageUrls: ["https://two.example/services"] }],
        pageStructure: structure.map((p) => ({
          ...p,
          finalPageUrl: p.finalPageUrl.replace("x.example", "two.example"),
          requestedUrl: p.requestedUrl.replace("x.example", "two.example"),
        })),
      }),
    ]);
    assert.equal(
      report.opportunities.filter((o) => o.dimension === "documented_services").length,
      0,
    );
  });

  it("surfaces positioning differences and conflicting identity evidence", () => {
    const report = compareWebsiteIntelligenceProfiles([
      profile({
        domain: "a.example",
        valuePropositions: [
          {
            value: "We help SaaS companies scale SEO",
            evidenceIds: ["vp-a"],
            sourcePageUrls: ["https://a.example/"],
            confidence: "medium",
            notes: [],
          },
        ],
        pageStructure: [
          {
            requestedUrl: "https://a.example/",
            finalPageUrl: "https://a.example/",
            retrievalStatus: "success",
            title: "A",
            titleEvidenceId: "ta",
            headings: [],
          },
          {
            requestedUrl: "https://a.example/about",
            finalPageUrl: "https://a.example/about",
            retrievalStatus: "success",
            title: "About",
            titleEvidenceId: "ab",
            headings: [],
          },
        ],
      }),
      profile({
        domain: "b.example",
        businessIdentity: {
          candidates: [
            { name: "Brand One", source: "page_title", evidenceIds: ["b1"], confidence: "medium" },
            { name: "Brand Two", source: "og_site_name", evidenceIds: ["b2"], confidence: "high" },
          ],
          conflictingNames: ["Brand One", "Brand Two"],
        },
        valuePropositions: [
          {
            value: "Leading provider of local SEO",
            evidenceIds: ["vp-b"],
            sourcePageUrls: ["https://b.example/"],
            confidence: "medium",
            notes: [],
          },
        ],
        pageStructure: [
          {
            requestedUrl: "https://b.example/",
            finalPageUrl: "https://b.example/",
            retrievalStatus: "success",
            title: "B",
            titleEvidenceId: "tb",
            headings: [],
          },
          {
            requestedUrl: "https://b.example/pricing",
            finalPageUrl: "https://b.example/pricing",
            retrievalStatus: "success",
            title: "Pricing",
            titleEvidenceId: "tp",
            headings: [],
          },
        ],
      }),
    ]);

    const positioning = report.observations.filter(
      (o) => o.dimension === "business_positioning" && o.state === "observed",
    );
    assert.equal(positioning.length, 2);
    assert.ok(
      positioning.some((o) => o.observedValues.some((v) => v.startsWith("conflicting_identity:"))),
    );
  });

  it("uses insufficient_evidence for blog dimension when blog pages were not crawled", () => {
    const report = compareWebsiteIntelligenceProfiles([
      profile({
        domain: "blogful.example",
        blogCategories: [
          {
            value: "SEO Guides",
            evidenceIds: ["cat1"],
            sourcePageUrls: ["https://blogful.example/blog/post"],
            confidence: "medium",
            notes: [],
          },
        ],
        pageStructure: [
          {
            requestedUrl: "https://blogful.example/blog/post",
            finalPageUrl: "https://blogful.example/blog/post",
            retrievalStatus: "success",
            title: "Post",
            titleEvidenceId: "p1",
            headings: [],
          },
          {
            requestedUrl: "https://blogful.example/",
            finalPageUrl: "https://blogful.example/",
            retrievalStatus: "success",
            title: "Home",
            titleEvidenceId: "h1",
            headings: [],
          },
        ],
        crawlCoverage: emptyCrawl({ missingPageTypes: [] }),
      }),
      profile({
        domain: "noblogcrawl.example",
        pageStructure: [
          {
            requestedUrl: "https://noblogcrawl.example/",
            finalPageUrl: "https://noblogcrawl.example/",
            retrievalStatus: "success",
            title: "Home",
            titleEvidenceId: "h2",
            headings: [],
          },
          {
            requestedUrl: "https://noblogcrawl.example/services",
            finalPageUrl: "https://noblogcrawl.example/services",
            retrievalStatus: "success",
            title: "Services",
            titleEvidenceId: "s2",
            headings: [],
          },
        ],
        crawlCoverage: emptyCrawl({ missingPageTypes: ["blog"] }),
      }),
    ]);

    const blogObs = report.observations.find(
      (o) => o.domain === "noblogcrawl.example" && o.dimension === "blog_educational_content",
    );
    assert.equal(blogObs?.state, "insufficient_evidence");
    const blogOpp = report.opportunities.find((o) => o.dimension === "blog_educational_content");
    assert.ok(blogOpp);
    assert.match(blogOpp?.evidenceGap ?? "", /not retrieved|Additional blog/i);
  });

  it("throws when observed comparison rows lack evidence IDs", () => {
    assert.throws(() =>
      assertComparisonEvidenceGrounding({
        comparedDomains: ["a.example", "b.example"],
        comparisonLimitations: [],
        observations: [
          {
            domain: "a.example",
            displayName: "A",
            dimension: "documented_services",
            state: "observed",
            observedValues: ["Local SEO"],
            evidenceIds: [],
            sourcePageUrls: ["https://a.example/"],
            crawlCoverageSummary: "1/1",
            confidence: "high",
            limitations: [],
          },
        ],
        opportunities: [
          {
            opportunityId: "test",
            dimension: "documented_services",
            hypothesis: "Hypothesis: test",
            isHypothesis: true,
            hypothesisDisclaimer: HYPOTHESIS,
            supportingObservationRefs: [],
            evidenceIds: ["e1"],
            sourcePageUrls: ["https://a.example/"],
            rationale: "r",
            evidenceGap: "g",
            confidence: "low",
            relatedDomains: ["a.example"],
          },
        ],
        summary: "test",
      }),
    );
  });

  it("produces deterministic output and avoids winner or ranking labels", () => {
    const profiles = [
      profile({
        domain: "m.example",
        documentedServices: [
          {
            normalizedLabel: "PPC",
            originalWordings: ["ppc"],
            evidenceIds: ["m1"],
            sourcePageUrls: ["https://m.example/services"],
            confidence: "high",
          },
        ],
        pageStructure: [
          {
            requestedUrl: "https://m.example/services",
            finalPageUrl: "https://m.example/services",
            retrievalStatus: "success",
            title: "Services",
            titleEvidenceId: "ms",
            headings: [],
          },
          {
            requestedUrl: "https://m.example/",
            finalPageUrl: "https://m.example/",
            retrievalStatus: "success",
            title: "M",
            titleEvidenceId: "mh",
            headings: [],
          },
        ],
      }),
      profile({
        domain: "n.example",
        documentedServices: [
          {
            normalizedLabel: "PPC",
            originalWordings: ["ppc"],
            evidenceIds: ["n1"],
            sourcePageUrls: ["https://n.example/services"],
            confidence: "high",
          },
        ],
        pageStructure: [
          {
            requestedUrl: "https://n.example/services",
            finalPageUrl: "https://n.example/services",
            retrievalStatus: "success",
            title: "Services",
            titleEvidenceId: "ns",
            headings: [],
          },
          {
            requestedUrl: "https://n.example/",
            finalPageUrl: "https://n.example/",
            retrievalStatus: "success",
            title: "N",
            titleEvidenceId: "nh",
            headings: [],
          },
        ],
      }),
    ];
    const first = compareWebsiteIntelligenceProfiles(profiles);
    const second = compareWebsiteIntelligenceProfiles(profiles);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.match(first.summary, /No winner or ranking/i);
    assert.doesNotMatch(JSON.stringify(first), /#1|winner:|best competitor/i);
  });

  it("compares three or more competitor profiles", () => {
    const mk = (domain: string, label: string, id: string) =>
      profile({
        domain,
        documentedServices: [
          {
            normalizedLabel: label,
            originalWordings: [label],
            evidenceIds: [id],
            sourcePageUrls: [`https://${domain}/services`],
            confidence: "high",
          },
        ],
        pageStructure: [
          {
            requestedUrl: `https://${domain}/services`,
            finalPageUrl: `https://${domain}/services`,
            retrievalStatus: "success",
            title: "Services",
            titleEvidenceId: `${id}-s`,
            headings: [],
          },
          {
            requestedUrl: `https://${domain}/`,
            finalPageUrl: `https://${domain}/`,
            retrievalStatus: "success",
            title: "Home",
            titleEvidenceId: `${id}-h`,
            headings: [],
          },
        ],
      });

    const report = compareWebsiteIntelligenceProfiles([
      mk("c1.example", "Local SEO", "c1"),
      mk("c2.example", "Local SEO", "c2"),
      mk("c3.example", "Technical SEO", "c3"),
    ]);
    assert.equal(report.comparedDomains.length, 3);
    assert.ok(report.observations.length >= 3 * 9);
  });
});

const HYPOTHESIS =
  "This is a hypothesis based on bounded page crawls, not a verified market gap, ranking, or traffic conclusion.";
