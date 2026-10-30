import type {
  ComparisonObservationState,
  WebsiteComparisonDimension,
  WebsiteComparisonObservation,
  WebsiteComparisonOpportunity,
  WebsiteIntelligenceComparisonReport,
} from "@/lib/website-intelligence/types";
import type {
  ProfileConfidence,
  WebsiteIntelligenceProfile,
} from "@/lib/website-intelligence/profile/website-profile-core";

const ALL_DIMENSIONS: WebsiteComparisonDimension[] = [
  "documented_services",
  "business_positioning",
  "value_propositions",
  "target_customer_indicators",
  "landing_page_themes",
  "blog_educational_content",
  "geographic_targeting",
  "page_structure",
  "internal_link_hubs",
];

const HYPOTHESIS_DISCLAIMER =
  "This is a hypothesis based on bounded page crawls, not a verified market gap, ranking, or traffic conclusion.";

function sortStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function uniqueSorted(values: string[]): string[] {
  return sortStrings([...new Set(values)]);
}

function observationRef(domain: string, dimension: WebsiteComparisonDimension): string {
  return `${domain}::${dimension}`;
}

function displayNameForProfile(profile: WebsiteIntelligenceProfile): string {
  const preferred = profile.businessIdentity.candidates.find(
    (c) => c.source === "homepage_title" || c.source === "og_site_name",
  );
  return preferred?.name ?? profile.businessIdentity.candidates[0]?.name ?? profile.domain;
}

function crawlSummary(profile: WebsiteIntelligenceProfile): string {
  const c = profile.crawlCoverage;
  return `${c.pagesRetrievedSuccessfully}/${c.pagesAttempted} pages retrieved; limit ${c.maxPageLimit}. ${c.coverageDisclaimer}`;
}

function pathFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function hasServicesPageCoverage(profile: WebsiteIntelligenceProfile): boolean {
  return profile.pageStructure.some(
    (page) =>
      page.retrievalStatus === "success" &&
      /\/services?(\/|$)/i.test(pathFromUrl(page.finalPageUrl)),
  );
}

function hasBlogPageCoverage(profile: WebsiteIntelligenceProfile): boolean {
  return profile.pageStructure.some(
    (page) =>
      page.retrievalStatus === "success" &&
      /\/blog(\/|$)/i.test(pathFromUrl(page.finalPageUrl)),
  );
}

function dimensionMissingPageType(
  dimension: WebsiteComparisonDimension,
  profile: WebsiteIntelligenceProfile,
): boolean {
  const missing = profile.crawlCoverage.missingPageTypes;
  switch (dimension) {
    case "documented_services":
      return missing.includes("services");
    case "blog_educational_content":
      return missing.includes("blog");
    case "geographic_targeting":
      return missing.includes("contact_or_about");
    default:
      return false;
  }
}

function resolveObservationState(input: {
  profile: WebsiteIntelligenceProfile;
  dimension: WebsiteComparisonDimension;
  observedValues: string[];
}): ComparisonObservationState {
  const { profile, dimension, observedValues } = input;
  if (profile.crawlCoverage.pagesRetrievedSuccessfully === 0) {
    return "crawl_unavailable";
  }
  if (observedValues.length > 0) {
    return "observed";
  }

  if (dimension === "blog_educational_content") {
    if (
      dimensionMissingPageType(dimension, profile) ||
      !hasBlogPageCoverage(profile)
    ) {
      return "insufficient_evidence";
    }
  }

  if (dimension === "documented_services") {
    if (dimensionMissingPageType(dimension, profile) || !hasServicesPageCoverage(profile)) {
      return "insufficient_evidence";
    }
  }

  if (dimension === "geographic_targeting" && dimensionMissingPageType(dimension, profile)) {
    return "insufficient_evidence";
  }

  if (profile.crawlCoverage.pagesRetrievedSuccessfully <= 1) {
    return "insufficient_evidence";
  }

  return "not_observed_in_crawled_pages";
}

function confidenceForObservation(
  state: ComparisonObservationState,
  profileConfidence: ProfileConfidence | undefined,
): ProfileConfidence {
  if (state === "crawl_unavailable" || state === "insufficient_evidence") {
    return "low";
  }
  return profileConfidence ?? "medium";
}

function collectServicesObservation(profile: WebsiteIntelligenceProfile): {
  values: string[];
  evidenceIds: string[];
  sourcePageUrls: string[];
  confidence: ProfileConfidence;
} {
  const values = sortStrings(profile.documentedServices.map((s) => s.normalizedLabel));
  const evidenceIds = uniqueSorted(profile.documentedServices.flatMap((s) => s.evidenceIds));
  const sourcePageUrls = uniqueSorted(
    profile.documentedServices.flatMap((s) => s.sourcePageUrls),
  );
  const confidence =
    profile.documentedServices.some((s) => s.confidence === "high")
      ? "high"
      : profile.documentedServices.some((s) => s.confidence === "medium")
        ? "medium"
        : "low";
  return { values, evidenceIds, sourcePageUrls, confidence };
}

function collectClaimObservation(
  claims: WebsiteIntelligenceProfile["valuePropositions"],
): {
  values: string[];
  evidenceIds: string[];
  sourcePageUrls: string[];
  confidence: ProfileConfidence;
} {
  const values = sortStrings(claims.map((c) => c.value));
  const evidenceIds = uniqueSorted(claims.flatMap((c) => c.evidenceIds));
  const sourcePageUrls = uniqueSorted(claims.flatMap((c) => c.sourcePageUrls));
  const confidence = claims.some((c) => c.confidence === "high")
    ? "high"
    : claims.some((c) => c.confidence === "medium")
      ? "medium"
      : "low";
  return { values, evidenceIds, sourcePageUrls, confidence };
}

function collectGeographicObservation(profile: WebsiteIntelligenceProfile): {
  values: string[];
  evidenceIds: string[];
  sourcePageUrls: string[];
  confidence: ProfileConfidence;
} {
  const values = sortStrings(
    profile.geographicSignals.map((g) => `${g.kind}:${g.label}`),
  );
  const evidenceIds = uniqueSorted(profile.geographicSignals.flatMap((g) => g.evidenceIds));
  const sourcePageUrls = uniqueSorted(
    profile.geographicSignals.flatMap((g) => g.sourcePageUrls),
  );
  const confidence = profile.geographicSignals.some(
    (g) => g.kind === "explicit_office_or_address" || g.kind === "explicit_service_area",
  )
    ? "high"
    : profile.geographicSignals.length > 0
      ? "medium"
      : "low";
  return { values, evidenceIds, sourcePageUrls, confidence };
}

function collectPageStructureObservation(profile: WebsiteIntelligenceProfile): {
  values: string[];
  evidenceIds: string[];
  sourcePageUrls: string[];
  confidence: ProfileConfidence;
} {
  const values = sortStrings(
    profile.pageStructure
      .filter((p) => p.retrievalStatus === "success")
      .map((p) => p.title ?? p.finalPageUrl),
  );
  const evidenceIds = uniqueSorted(
    profile.pageStructure.flatMap((p) => [
      ...(p.titleEvidenceId ? [p.titleEvidenceId] : []),
      ...p.headings.map((h) => h.evidenceId),
    ]),
  );
  const sourcePageUrls = uniqueSorted(
    profile.pageStructure
      .filter((p) => p.retrievalStatus === "success")
      .map((p) => p.finalPageUrl),
  );
  return {
    values,
    evidenceIds,
    sourcePageUrls,
    confidence: values.length >= 2 ? "medium" : "low",
  };
}

function collectInternalLinkHubObservation(profile: WebsiteIntelligenceProfile): {
  values: string[];
  evidenceIds: string[];
  sourcePageUrls: string[];
  confidence: ProfileConfidence;
} {
  const values = sortStrings(
    profile.internalLinkHubs.map(
      (hub) => `${hub.destinationUrl} (${hub.inboundLinkCount} inlinks)`,
    ),
  );
  const evidenceIds = uniqueSorted(profile.internalLinkHubs.flatMap((h) => h.evidenceIds));
  const sourcePageUrls = uniqueSorted(
    profile.internalLinkHubs.map((h) => h.destinationUrl),
  );
  return {
    values,
    evidenceIds,
    sourcePageUrls,
    confidence: profile.internalLinkHubs.length > 0 ? "medium" : "low",
  };
}

function collectPositioningObservation(profile: WebsiteIntelligenceProfile): {
  values: string[];
  evidenceIds: string[];
  sourcePageUrls: string[];
  confidence: ProfileConfidence;
} {
  const positioningValues = [
    ...profile.valuePropositions.map((v) => v.value),
    ...profile.businessIdentity.conflictingNames.map(
      (name) => `conflicting_identity:${name}`,
    ),
  ];
  const claims = [...profile.valuePropositions];
  const evidenceIds = uniqueSorted([
    ...claims.flatMap((c) => c.evidenceIds),
    ...profile.businessIdentity.candidates.flatMap((c) => c.evidenceIds),
  ]);
  const sourcePageUrls = uniqueSorted(claims.flatMap((c) => c.sourcePageUrls));
  return {
    values: sortStrings(positioningValues),
    evidenceIds,
    sourcePageUrls,
    confidence: profile.businessIdentity.conflictingNames.length > 0 ? "low" : "medium",
  };
}

function buildDimensionObservation(
  profile: WebsiteIntelligenceProfile,
  dimension: WebsiteComparisonDimension,
): WebsiteComparisonObservation {
  let collected: {
    values: string[];
    evidenceIds: string[];
    sourcePageUrls: string[];
    confidence: ProfileConfidence;
  };

  switch (dimension) {
    case "documented_services":
      collected = collectServicesObservation(profile);
      break;
    case "business_positioning":
      collected = collectPositioningObservation(profile);
      break;
    case "value_propositions":
      collected = collectClaimObservation(profile.valuePropositions);
      break;
    case "target_customer_indicators":
      collected = collectClaimObservation(profile.targetCustomerIndicators);
      break;
    case "landing_page_themes":
      collected = collectClaimObservation(profile.contentThemes);
      break;
    case "blog_educational_content":
      collected = collectClaimObservation([
        ...profile.blogCategories,
        ...profile.contentThemes.filter((theme) =>
          theme.sourcePageUrls.some((url) => /\/blog(\/|$)/i.test(pathFromUrl(url))),
        ),
      ]);
      break;
    case "geographic_targeting":
      collected = collectGeographicObservation(profile);
      break;
    case "page_structure":
      collected = collectPageStructureObservation(profile);
      break;
    case "internal_link_hubs":
      collected = collectInternalLinkHubObservation(profile);
      break;
    default:
      collected = { values: [], evidenceIds: [], sourcePageUrls: [], confidence: "low" };
  }

  const state = resolveObservationState({
    profile,
    dimension,
    observedValues: collected.values,
  });

  const limitations = uniqueSorted([
    ...profile.profileLimitations,
    ...profile.crawlCoverage.extractionLimitations,
    state === "insufficient_evidence"
      ? "Crawled pages did not provide enough coverage to treat absence as a confirmed gap."
      : "",
    state === "not_observed_in_crawled_pages"
      ? "Not observed in retrieved pages only; capability may exist on uncrawled pages."
      : "",
  ]).filter(Boolean);

  return {
    domain: profile.domain,
    displayName: displayNameForProfile(profile),
    dimension,
    state,
    observedValues: collected.values,
    evidenceIds: collected.evidenceIds,
    sourcePageUrls: collected.sourcePageUrls,
    crawlCoverageSummary: crawlSummary(profile),
    confidence: confidenceForObservation(state, collected.confidence),
    limitations,
  };
}

function stableOpportunityId(parts: string[]): string {
  return parts.join("|").slice(0, 120);
}

function generateServiceOpportunities(input: {
  profiles: WebsiteIntelligenceProfile[];
  observations: WebsiteComparisonObservation[];
}): WebsiteComparisonOpportunity[] {
  const opportunities: WebsiteComparisonOpportunity[] = [];
  const serviceObs = input.observations.filter((o) => o.dimension === "documented_services");

  const serviceCounts = new Map<string, { domains: string[]; evidenceIds: string[]; urls: string[] }>();
  for (const obs of serviceObs) {
    if (obs.state !== "observed") {
      continue;
    }
    for (const value of obs.observedValues) {
      const bucket = serviceCounts.get(value) ?? { domains: [], evidenceIds: [], urls: [] };
      bucket.domains.push(obs.domain);
      bucket.evidenceIds.push(...obs.evidenceIds);
      bucket.urls.push(...obs.sourcePageUrls);
      serviceCounts.set(value, bucket);
    }
  }

  const widelyObserved = [...serviceCounts.entries()].filter(
    ([, bucket]) => uniqueSorted(bucket.domains).length >= 2,
  );

  for (const profile of input.profiles) {
    const targetObs = serviceObs.find((o) => o.domain === profile.domain);
    if (!targetObs) {
      continue;
    }
    if (
      targetObs.state === "crawl_unavailable" ||
      targetObs.state === "insufficient_evidence"
    ) {
      continue;
    }

    for (const [service, bucket] of widelyObserved) {
      if (targetObs.observedValues.includes(service)) {
        continue;
      }

      const peerDomains = uniqueSorted(
        bucket.domains.filter((domain) => domain !== profile.domain),
      );
      opportunities.push({
        opportunityId: stableOpportunityId([
          "service_gap",
          profile.domain,
          service,
          ...peerDomains,
        ]),
        dimension: "documented_services",
        hypothesis: `Hypothesis: ${displayNameForProfile(profile)} did not show "${service}" on crawled pages while peers ${peerDomains.join(", ")} documented it on retrieved pages.`,
        isHypothesis: true,
        hypothesisDisclaimer: HYPOTHESIS_DISCLAIMER,
        supportingObservationRefs: [
          observationRef(profile.domain, "documented_services"),
          ...peerDomains.map((d) => observationRef(d, "documented_services")),
        ],
        evidenceIds: uniqueSorted(bucket.evidenceIds),
        sourcePageUrls: uniqueSorted(bucket.urls),
        rationale:
          "Service label appears on multiple competitors' retrieved pages but was not observed on this competitor's crawled pages with adequate service-page coverage.",
        evidenceGap:
          "Does not prove the competitor lacks the service offline or on uncrawled URLs; expand crawl or manual review.",
        confidence: "medium",
        relatedDomains: uniqueSorted([profile.domain, ...peerDomains]),
      });
    }
  }

  return opportunities;
}

function generateBlogOpportunities(input: {
  profiles: WebsiteIntelligenceProfile[];
  observations: WebsiteComparisonObservation[];
}): WebsiteComparisonOpportunity[] {
  const opportunities: WebsiteComparisonOpportunity[] = [];
  const blogObs = input.observations.filter(
    (o) => o.dimension === "blog_educational_content",
  );

  const withBlogContent = blogObs.filter(
    (o) => o.state === "observed" && o.observedValues.length > 0,
  );
  if (withBlogContent.length === 0) {
    return opportunities;
  }

  for (const obs of blogObs) {
    if (obs.state === "observed") {
      continue;
    }
    if (obs.state === "crawl_unavailable") {
      continue;
    }

    const peers = withBlogContent.map((o) => o.domain);
    opportunities.push({
      opportunityId: stableOpportunityId(["blog_education", obs.domain, ...peers]),
      dimension: "blog_educational_content",
      hypothesis: `Hypothesis: ${obs.displayName} shows limited or no educational/blog themes in crawled pages while other compared sites surface blog/category themes in retrieved pages.`,
      isHypothesis: true,
      hypothesisDisclaimer: HYPOTHESIS_DISCLAIMER,
      supportingObservationRefs: [
        observationRef(obs.domain, "blog_educational_content"),
        ...withBlogContent.map((o) => observationRef(o.domain, "blog_educational_content")),
      ],
      evidenceIds: uniqueSorted(withBlogContent.flatMap((o) => o.evidenceIds)),
      sourcePageUrls: uniqueSorted(withBlogContent.flatMap((o) => o.sourcePageUrls)),
      rationale:
        "Educational/blog signals differ across crawled page sets; this is not proof that a competitor lacks a blog.",
      evidenceGap:
        obs.state === "insufficient_evidence"
          ? "Blog pages were not retrieved; cannot infer absence of blog strategy."
          : "Additional blog URL discovery and crawl depth required.",
      confidence: obs.state === "insufficient_evidence" ? "low" : "medium",
      relatedDomains: uniqueSorted([obs.domain, ...peers]),
    });
  }

  return opportunities;
}

function generateGeographicOpportunities(
  observations: WebsiteComparisonObservation[],
): WebsiteComparisonOpportunity[] {
  const geoObs = observations.filter(
    (o) => o.dimension === "geographic_targeting" && o.state === "observed",
  );
  if (geoObs.length < 2) {
    return [];
  }

  const signature = (obs: WebsiteComparisonObservation) => obs.observedValues.join(";");
  const groups = new Map<string, WebsiteComparisonObservation[]>();
  for (const obs of geoObs) {
    const key = signature(obs);
    const list = groups.get(key) ?? [];
    list.push(obs);
    groups.set(key, list);
  }
  if (groups.size <= 1) {
    return [];
  }

  const allDomains = sortStrings(geoObs.map((o) => o.domain));
  const evidenceIds = uniqueSorted(geoObs.flatMap((o) => o.evidenceIds));
  const urls = uniqueSorted(geoObs.flatMap((o) => o.sourcePageUrls));

  return [
    {
      opportunityId: stableOpportunityId(["geo_diff", ...allDomains]),
      dimension: "geographic_targeting",
      hypothesis:
        "Hypothesis: compared competitors show different geographic targeting signals on crawled pages (explicit locations vs incidental mentions).",
      isHypothesis: true,
      hypothesisDisclaimer: HYPOTHESIS_DISCLAIMER,
      supportingObservationRefs: allDomains.map((d) =>
        observationRef(d, "geographic_targeting"),
      ),
      evidenceIds,
      sourcePageUrls: urls,
      rationale:
        "Geographic signal sets differ; this is descriptive only and not a ranking of local market strength.",
      evidenceGap:
        "City mentions alone are not office proof; contact/location pages may be missing from crawl.",
      confidence: "medium",
      relatedDomains: allDomains,
    },
  ];
}

function generateInternalLinkOpportunities(
  observations: WebsiteComparisonObservation[],
): WebsiteComparisonOpportunity[] {
  const hubObs = observations.filter(
    (o) => o.dimension === "internal_link_hubs" && o.state === "observed",
  );
  if (hubObs.length < 2) {
    return [];
  }

  const topHubsByDomain = new Map(
    hubObs.map((o) => [o.domain, o.observedValues[0] ?? ""]),
  );
  const uniqueTop = new Set([...topHubsByDomain.values()].filter(Boolean));
  if (uniqueTop.size <= 1) {
    return [];
  }

  const domains = sortStrings(hubObs.map((o) => o.domain));
  return [
    {
      opportunityId: stableOpportunityId(["internal_hubs", ...domains]),
      dimension: "internal_link_hubs",
      hypothesis:
        "Hypothesis: internal-link hub patterns differ across competitors' crawled pages, suggesting different content organization emphasis.",
      isHypothesis: true,
      hypothesisDisclaimer: HYPOTHESIS_DISCLAIMER,
      supportingObservationRefs: domains.map((d) => observationRef(d, "internal_link_hubs")),
      evidenceIds: uniqueSorted(hubObs.flatMap((o) => o.evidenceIds)),
      sourcePageUrls: uniqueSorted(hubObs.flatMap((o) => o.sourcePageUrls)),
      rationale:
        "Compared top inbound internal destinations differ; not a judgment of site quality or traffic.",
      evidenceGap: "Hub detection limited to links on retrieved pages only.",
      confidence: "low",
      relatedDomains: domains,
    },
  ];
}

export function assertComparisonEvidenceGrounding(
  report: WebsiteIntelligenceComparisonReport,
): void {
  for (const observation of report.observations) {
    if (observation.state !== "observed") {
      continue;
    }
    if (observation.observedValues.length === 0) {
      continue;
    }
    if (observation.evidenceIds.length === 0) {
      throw new Error(
        `Observation ${observation.domain}/${observation.dimension} is observed but has no evidence IDs.`,
      );
    }
    for (const id of observation.evidenceIds) {
      if (!id.trim()) {
        throw new Error("Empty evidence ID in comparison observation.");
      }
    }
  }

  for (const opportunity of report.opportunities) {
    if (opportunity.evidenceIds.length === 0) {
      throw new Error(`Opportunity ${opportunity.opportunityId} lacks evidence IDs.`);
    }
    if (!opportunity.isHypothesis) {
      throw new Error("Opportunities must be flagged as hypotheses.");
    }
  }
}

export function compareWebsiteIntelligenceProfiles(
  profiles: WebsiteIntelligenceProfile[],
): WebsiteIntelligenceComparisonReport {
  const sortedProfiles = [...profiles].sort((a, b) => a.domain.localeCompare(b.domain));
  if (sortedProfiles.length < 2) {
    throw new Error("At least two WebsiteIntelligenceProfile objects are required.");
  }

  const observations: WebsiteComparisonObservation[] = [];
  for (const profile of sortedProfiles) {
    for (const dimension of ALL_DIMENSIONS) {
      observations.push(buildDimensionObservation(profile, dimension));
    }
  }
  observations.sort(
    (a, b) =>
      a.domain.localeCompare(b.domain) || a.dimension.localeCompare(b.dimension),
  );

  const opportunities = [
    ...generateServiceOpportunities({ profiles: sortedProfiles, observations }),
    ...generateBlogOpportunities({ profiles: sortedProfiles, observations }),
    ...generateGeographicOpportunities(observations),
    ...generateInternalLinkOpportunities(observations),
  ].sort((a, b) => a.opportunityId.localeCompare(b.opportunityId));

  const comparisonLimitations = uniqueSorted([
    "Comparisons use bounded HTML crawls per domain; missing pages are not proof of missing capabilities.",
    "No keyword ranking, traffic, conversion, or backlink superiority claims are made.",
    "Observations are deterministic and separate from any future Nebius narrative layer.",
    ...sortedProfiles.flatMap((p) => p.crawlCoverage.extractionLimitations.slice(0, 1)),
  ]);

  const report: WebsiteIntelligenceComparisonReport = {
    comparedDomains: sortedProfiles.map((p) => p.domain),
    comparisonLimitations,
    observations,
    opportunities,
    summary: `Compared ${sortedProfiles.length} website intelligence profiles across ${ALL_DIMENSIONS.length} dimensions with ${opportunities.length} hypothesis-level opportunity signal(s). No winner or ranking labels applied.`,
  };

  assertComparisonEvidenceGrounding(report);
  return report;
}
