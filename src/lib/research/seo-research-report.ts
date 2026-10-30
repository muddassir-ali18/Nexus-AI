import type { CompetitorCandidate } from "@/lib/research/seo-competitor-verification";
import { buildCompetitorCandidateLabel } from "@/lib/research/seo-competitor-verification";
import type { SeoResearchIntent } from "@/lib/research/seo-research-intent";
import type { ScoredSeoFinding, SourceClassification } from "@/lib/research/seo-relevance-engine";

export type SeoResearchReport = {
  executiveSummary: string;
  methodology: string[];
  competitorCandidateLabel: string;
  verifiedCount: number;
  partiallyVerifiedCount: number;
  unverifiedCount: number;
  filteredIrrelevantCount: number;
  classificationCounts: Partial<Record<SourceClassification, number>>;
  competitors: CompetitorCandidate[];
  verifiedFindings: string[];
  reasonableInferences: string[];
  potentialOpportunities: string[];
  unverifiedClaims: string[];
  additionalDataRequired: string[];
  technicalAuditRequirements: string[];
  evidenceGaps: string[];
  failedQueries: string[];
  emptyQueries: string[];
  sourceReferences: Array<{ title: string; url: string; classification: SourceClassification }>;
};

const TECHNICAL_AUDIT_REQUIREMENTS = [
  "Website crawling and rendered HTML review",
  "HTTP status, redirect chains, and canonical behavior",
  "robots.txt and indexability checks",
  "XML sitemap discovery and coverage",
  "Metadata, heading structure, and internal linking review",
  "Structured data validation",
  "Core Web Vitals and performance measurement",
  "Backlink profile analysis",
  "Google Search Console and Analytics access",
  "Keyword ranking and search volume data (requires dedicated SEO tools)",
];

export function buildSeoResearchReport(input: {
  intent: SeoResearchIntent;
  queriesExecuted: string[];
  failedQueries: string[];
  emptyQueries: string[];
  scoredFindings: ScoredSeoFinding[];
  competitors: CompetitorCandidate[];
}): SeoResearchReport {
  const classificationCounts: Partial<Record<SourceClassification, number>> = {};
  for (const finding of input.scoredFindings) {
    classificationCounts[finding.classification] =
      (classificationCounts[finding.classification] ?? 0) + 1;
  }

  const filteredIrrelevantCount = input.scoredFindings.filter(
    (item) => item.excludedFromCompetitorEvidence,
  ).length;

  const verifiedCount = input.competitors.filter(
    (item) => item.verificationStatus === "verified",
  ).length;
  const partiallyVerifiedCount = input.competitors.filter(
    (item) => item.verificationStatus === "partially_verified",
  ).length;
  const unverifiedCount = input.competitors.filter(
    (item) => item.verificationStatus === "unverified",
  ).length;

  const competitorCandidateLabel = buildCompetitorCandidateLabel({
    intent: input.intent,
    candidates: input.competitors,
  });

  const executiveSummary = [
    competitorCandidateLabel,
    "Evidence is limited to Tavily web search snippets and indexed public pages; NEXUS did not crawl websites or access Search Console, analytics, rankings, or backlink databases.",
    input.failedQueries.length > 0
      ? `${input.failedQueries.length} research query(ies) failed and are listed below.`
      : "All planned Tavily queries completed without transport/API failure.",
  ].join(" ");

  const methodology = [
    "Parsed the user request for industry, geography, competitor count, and comparison dimensions.",
    "Generated focused Tavily queries to reduce generic international SEO article noise.",
    "Scored each result for service, geography, identity, and source-type relevance.",
    "Classified sources (official site, directory, article, educational, irrelevant).",
    "Grouped domains, deduplicated results, and applied strict verification (official site vs directory, explicit geography vs snippet-only, search-result evidence only).",
    "Excluded generic SEO educational articles from competitor evidence.",
  ];

  const verifiedFindings: string[] = [];
  for (const competitor of input.competitors.filter(
    (item) => item.verificationStatus === "verified",
  )) {
    verifiedFindings.push(
      `${competitor.name}: fully verified candidate — official website identified (${competitor.officialWebsiteUrl ?? "n/a"}), ${input.intent.geography ?? "target market"} presence supported from explicit search-indexed signals (not a live site audit). Sources: ${competitor.sourceUrls.join(", ")}.`,
    );
  }

  const reasonableInferences: string[] = [];
  for (const competitor of input.competitors.filter(
    (item) => item.verificationStatus === "partially_verified",
  )) {
    const gaps = [
      !competitor.officialWebsiteIdentified ? "official site not identified" : null,
      input.intent.geography && !competitor.chennaiPresenceSupported
        ? `${input.intent.geography} presence not explicitly supported`
        : null,
      !competitor.servicesPubliclyDocumented ? "services not documented on official snippets" : null,
    ]
      .filter(Boolean)
      .join("; ");
    reasonableInferences.push(
      `${competitor.name} is a partial candidate (${gaps || "limited snippet evidence"}). Confirm on official pages beyond search results before strategic decisions.`,
    );
  }

  const potentialOpportunities: string[] = [];
  if (input.intent.comparisonDimensions.includes("content themes")) {
    potentialOpportunities.push(
      "Hypothesis: compare competitor blog/case-study themes against your planned content calendar once official site pages are manually reviewed (not inferred from snippets alone).",
    );
  }
  if (input.intent.comparisonDimensions.includes("services")) {
    potentialOpportunities.push(
      "Hypothesis: service-gap opportunities may exist where verified competitors do not publicly emphasize technical SEO, local SEO, or industry-specific landing pages.",
    );
  }

  const unverifiedClaims: string[] = input.competitors
    .filter((item) => item.verificationStatus === "unverified")
    .map(
      (item) =>
        `${item.name} remains unverified as a local competitor from current public search evidence.`,
    );

  const additionalDataRequired = [
    ...TECHNICAL_AUDIT_REQUIREMENTS.slice(0, 6),
    "Manual review of each candidate official website (beyond search snippets)",
  ];

  if (verifiedCount === 0 && input.intent.isCompetitorResearch) {
    additionalDataRequired.push(
      "Additional focused Tavily queries or manual local directory research to verify competitor identities",
    );
  }

  const evidenceGaps: string[] = [];
  if (filteredIrrelevantCount > 0) {
    evidenceGaps.push(
      `${filteredIrrelevantCount} source(s) were filtered as irrelevant or generic SEO education for this request.`,
    );
  }
  if (input.emptyQueries.length > 0) {
    evidenceGaps.push(
      `${input.emptyQueries.length} query(ies) returned no usable Tavily results.`,
    );
  }
  if (input.intent.requestedCompetitorCount && input.competitors.length < input.intent.requestedCompetitorCount) {
    evidenceGaps.push(
      `Only ${input.competitors.length} candidate(s) met relevance thresholds; NEXUS did not fill remaining slots with unrelated businesses.`,
    );
  }

  const sourceReferences = input.scoredFindings
    .filter((item) => !item.excludedFromCompetitorEvidence)
    .slice(0, 20)
    .map((item) => ({
      title: item.title,
      url: item.url,
      classification: item.classification,
    }));

  return {
    executiveSummary,
    methodology,
    competitorCandidateLabel,
    verifiedCount,
    partiallyVerifiedCount,
    unverifiedCount,
    filteredIrrelevantCount,
    classificationCounts,
    competitors: input.competitors,
    verifiedFindings,
    reasonableInferences,
    potentialOpportunities,
    unverifiedClaims,
    additionalDataRequired,
    technicalAuditRequirements: TECHNICAL_AUDIT_REQUIREMENTS,
    evidenceGaps,
    failedQueries: input.failedQueries,
    emptyQueries: input.emptyQueries,
    sourceReferences,
  };
}
