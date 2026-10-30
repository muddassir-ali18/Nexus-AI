import type { WebResearchFinding } from "@/lib/research/web-research-core";
import type { SeoResearchIntent } from "@/lib/research/seo-research-intent";

export type SourceClassification =
  | "official_agency_website"
  | "business_directory"
  | "independent_article"
  | "industry_research"
  | "seo_educational"
  | "irrelevant";

export type ScoredSeoFinding = WebResearchFinding & {
  domain: string;
  classification: SourceClassification;
  relevanceScore: number;
  serviceRelevance: number;
  geographicRelevance: number;
  identityRelevance: number;
  evidenceQuality: number;
  excludedFromCompetitorEvidence: boolean;
  exclusionReason: string | null;
};

const DIRECTORY_DOMAINS = [
  "clutch.co",
  "sortlist.com",
  "goodfirms.co",
  "designrush.com",
  "g2.com",
  "trustpilot.com",
  "justdial.com",
  "indiamart.com",
  "leadiq.com",
  "rocketreach.co",
  "crunchbase.com",
  "linkedin.com",
];

const EDUCATIONAL_DOMAINS = [
  "moz.com",
  "searchengineland.com",
  "searchenginejournal.com",
  "ahrefs.com",
  "semrush.com",
  "backlinko.com",
  "hubspot.com",
  "google.com",
  "developers.google.com",
  "wikipedia.org",
];

const INTERNATIONAL_AGENCY_SIGNALS =
  /\b(new york|london|san francisco|los angeles|chicago|toronto|sydney|global seo firm|worldwide)\b/i;

const EDUCATIONAL_TITLE =
  /\b(how to|guide|tutorial|what is|best practices|tips|checklist|beginner|101)\b/i;

export function extractDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

function scoreGeographicRelevance(
  text: string,
  intent: SeoResearchIntent,
): number {
  if (!intent.isLocalMarketResearch) {
    return 0.5;
  }
  const geo = intent.geography?.toLowerCase();
  const country = intent.country?.toLowerCase();
  let score = 0;
  if (geo && text.includes(geo)) {
    score += 0.7;
  }
  if (country && text.includes(country)) {
    score += 0.2;
  }
  if (/\b(near me|local)\b/i.test(text) && geo) {
    score += 0.1;
  }
  return Math.min(1, score);
}

function scoreServiceRelevance(text: string, intent: SeoResearchIntent): number {
  let score = 0;
  if (/\b(seo|search engine optimization|digital marketing)\b/i.test(text)) {
    score += 0.6;
  }
  if (/\b(agency|company|firm|services|consulting)\b/i.test(text)) {
    score += 0.3;
  }
  if (intent.industry && text.toLowerCase().includes(intent.industry.toLowerCase())) {
    score += 0.1;
  }
  return Math.min(1, score);
}

export function classifySeoSource(
  finding: WebResearchFinding,
  intent: SeoResearchIntent,
): SourceClassification {
  const domain = extractDomainFromUrl(finding.url);
  const text = `${finding.title} ${finding.snippet} ${finding.url}`.toLowerCase();

  if (DIRECTORY_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`))) {
    return "business_directory";
  }

  if (
    EDUCATIONAL_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`))
  ) {
    return "seo_educational";
  }

  if (EDUCATIONAL_TITLE.test(finding.title) && !/\bagency\b/i.test(finding.title)) {
    return "seo_educational";
  }

  if (/\b(report|study|market research|forecast)\b/i.test(finding.title)) {
    return "industry_research";
  }

  const geoScore = scoreGeographicRelevance(text, intent);
  const serviceScore = scoreServiceRelevance(text, intent);

  if (
    intent.isLocalMarketResearch &&
    intent.isCompetitorResearch &&
    geoScore < 0.2 &&
    INTERNATIONAL_AGENCY_SIGNALS.test(text)
  ) {
    return "irrelevant";
  }

  if (
    intent.isLocalMarketResearch &&
    intent.isCompetitorResearch &&
    geoScore < 0.15 &&
    serviceScore > 0.4 &&
    !DIRECTORY_DOMAINS.some((item) => domain.includes(item))
  ) {
    return "irrelevant";
  }

  if (serviceScore >= 0.5 && (geoScore >= 0.2 || !intent.isLocalMarketResearch)) {
    if (/\b(home|about|services|contact)\b/i.test(text) || domain.split(".").length <= 2) {
      return "official_agency_website";
    }
    return "official_agency_website";
  }

  if (
    /\b(review|vs\.|comparison|top \d+|\bbest\b.*\bagenc)/i.test(finding.title)
  ) {
    return "independent_article";
  }

  if (serviceScore >= 0.3) {
    return "independent_article";
  }

  return "irrelevant";
}

export function scoreSeoFinding(
  finding: WebResearchFinding,
  intent: SeoResearchIntent,
): ScoredSeoFinding {
  const domain = extractDomainFromUrl(finding.url);
  const text = `${finding.title} ${finding.snippet}`.toLowerCase();
  const classification = classifySeoSource(finding, intent);
  const serviceRelevance = scoreServiceRelevance(text, intent);
  const geographicRelevance = scoreGeographicRelevance(text, intent);
  const identityRelevance =
    /\b(agency|company|firm|studio|consultants?)\b/i.test(text) ? 0.7 : 0.3;

  let evidenceQuality = 0.4;
  if (finding.snippet.trim().length > 80) {
    evidenceQuality += 0.2;
  }
  if (classification === "official_agency_website") {
    evidenceQuality += 0.3;
  }
  if (classification === "business_directory") {
    evidenceQuality += 0.1;
  }

  let relevanceScore =
    serviceRelevance * 0.35 +
    geographicRelevance * 0.35 +
    identityRelevance * 0.15 +
    evidenceQuality * 0.15;

  if (classification === "seo_educational") {
    relevanceScore = Math.min(relevanceScore, 0.25);
  }
  if (classification === "irrelevant") {
    relevanceScore = Math.min(relevanceScore, 0.15);
  }

  let excludedFromCompetitorEvidence = false;
  let exclusionReason: string | null = null;

  if (classification === "seo_educational") {
    excludedFromCompetitorEvidence = true;
    exclusionReason = "Generic SEO educational content is not competitor evidence.";
  } else if (classification === "irrelevant") {
    excludedFromCompetitorEvidence = true;
    exclusionReason = "Source appears unrelated to the requested local market or service focus.";
  } else if (
    intent.isCompetitorResearch &&
    intent.isLocalMarketResearch &&
    geographicRelevance < 0.2 &&
    classification !== "business_directory"
  ) {
    excludedFromCompetitorEvidence = true;
    exclusionReason = "Insufficient geographic signal for local competitor research.";
  }

  return {
    ...finding,
    domain,
    classification,
    relevanceScore,
    serviceRelevance,
    geographicRelevance,
    identityRelevance,
    evidenceQuality,
    excludedFromCompetitorEvidence,
    exclusionReason,
  };
}

export function scoreAndFilterSeoFindings(
  findings: WebResearchFinding[],
  intent: SeoResearchIntent,
): ScoredSeoFinding[] {
  const scored = findings.map((finding) => scoreSeoFinding(finding, intent));
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored;
}

export function dedupeScoredFindingsByDomain(
  findings: ScoredSeoFinding[],
): ScoredSeoFinding[] {
  const byDomain = new Map<string, ScoredSeoFinding>();
  for (const finding of findings) {
    const key = finding.domain;
    const existing = byDomain.get(key);
    if (!existing || finding.relevanceScore > existing.relevanceScore) {
      byDomain.set(key, finding);
    }
  }
  return [...byDomain.values()].sort((a, b) => b.relevanceScore - a.relevanceScore);
}
