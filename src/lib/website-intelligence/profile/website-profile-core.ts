import type { CompetitorVerificationStatus } from "@/lib/research/seo-competitor-verification";
import type {
  ExtractedPage,
  PageEvidenceType,
  PageRetrievalRecord,
  PageRetrievalStatus,
} from "@/lib/website-intelligence/types";

export type ProfileConfidence = "high" | "medium" | "low";

export type GroundedStringClaim = {
  value: string;
  evidenceIds: string[];
  sourcePageUrls: string[];
  confidence: ProfileConfidence;
  notes: string[];
};

export type BusinessIdentityCandidate = {
  name: string;
  source:
    | "homepage_title"
    | "page_title"
    | "og_site_name"
    | "meta_description"
    | "primary_heading";
  evidenceIds: string[];
  confidence: ProfileConfidence;
};

export type DocumentedService = {
  normalizedLabel: string;
  originalWordings: string[];
  evidenceIds: string[];
  sourcePageUrls: string[];
  confidence: ProfileConfidence;
};

export type GeographicSignalKind =
  | "explicit_office_or_address"
  | "explicit_service_area"
  | "city_or_region_mention"
  | "incidental_reference";

export type GeographicSignal = {
  kind: GeographicSignalKind;
  label: string;
  evidenceIds: string[];
  sourcePageUrls: string[];
  supportingExcerpt: string | null;
};

export type PageStructureEntry = {
  requestedUrl: string;
  finalPageUrl: string;
  retrievalStatus: PageRetrievalStatus;
  title: string | null;
  titleEvidenceId: string | null;
  headings: Array<{ level: number; text: string; evidenceId: string }>;
};

export type InternalLinkHub = {
  destinationUrl: string;
  inboundLinkCount: number;
  evidenceIds: string[];
  anchorSamples: string[];
};

export type EvidenceSourceSummary = {
  finalPageUrl: string;
  retrievalStatus: PageRetrievalStatus;
  evidenceCount: number;
  evidenceIds: string[];
};

export type CrawlCoverageReport = {
  pagesAttempted: number;
  pagesRetrievedSuccessfully: number;
  pagesBlockedByRobots: number;
  failedPagesByStatus: Partial<Record<PageRetrievalStatus, number>>;
  maxPageLimit: number;
  missingPageTypes: string[];
  extractionLimitations: string[];
  coverageDisclaimer: string;
};

export type Phase101VerificationSnapshot = {
  verificationStatus: CompetitorVerificationStatus;
  fullyVerified: boolean;
  officialWebsiteUrl: string | null;
  evidenceLimitations: string[];
  searchGeographicEvidenceCount: number;
  preservationNote: string;
};

export type WebsiteIntelligenceProfile = {
  domain: string;
  officialWebsiteUrl: string | null;
  businessIdentity: {
    candidates: BusinessIdentityCandidate[];
    conflictingNames: string[];
  };
  documentedServices: DocumentedService[];
  geographicSignals: GeographicSignal[];
  valuePropositions: GroundedStringClaim[];
  targetCustomerIndicators: GroundedStringClaim[];
  pageStructure: PageStructureEntry[];
  blogCategories: GroundedStringClaim[];
  contentThemes: GroundedStringClaim[];
  internalLinkHubs: InternalLinkHub[];
  evidenceSources: EvidenceSourceSummary[];
  crawlCoverage: CrawlCoverageReport;
  phase101Verification: Phase101VerificationSnapshot | null;
  profileLimitations: string[];
};

export type WebsiteProfileBuildInput = {
  domain: string;
  officialWebsiteUrl?: string | null;
  extractedPages: ExtractedPage[];
  retrievalRecords: PageRetrievalRecord[];
  maxPageLimit?: number;
  phase101Verification?: {
    verificationStatus: CompetitorVerificationStatus;
    fullyVerified: boolean;
    officialWebsiteUrl: string | null;
    evidenceLimitations: string[];
    searchGeographicEvidenceCount: number;
  } | null;
};

const SERVICE_LABELS: Record<string, string> = {
  "local seo": "Local SEO",
  "technical seo": "Technical SEO",
  "on-page seo": "On-Page SEO",
  "link building": "Link Building",
  "content marketing": "Content Marketing",
  "seo audit": "SEO Audit",
  "keyword research": "Keyword Research",
  "seo consulting": "SEO Consulting",
  "digital marketing": "Digital Marketing",
  ppc: "PPC",
  "google ads": "Google Ads",
};

const TARGET_CUSTOMER_PATTERN =
  /\b(for small businesses|for startups|for enterprise(?:s)?|b2b|b2c|saas companies|e-commerce brands|local businesses|mid-market)\b/gi;

const EXPLICIT_GEO_PATTERN_PARTS = [
  "based in",
  "located in",
  "office in",
  "operations in",
  "headquartered in",
  "serving",
  "service area",
  "we serve",
];

function sortStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function uniqueSorted(values: string[]): string[] {
  return sortStrings([...new Set(values)]);
}

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isHomepageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return path === "/";
  } catch {
    return false;
  }
}

function pagePath(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function mainTextForPage(page: ExtractedPage): string {
  const main = page.evidence.find(
    (item) =>
      item.evidenceType === "visible_text" &&
      item.extractionMethod === "heuristic_main_content",
  );
  return main?.value ?? page.mainVisibleText;
}

function hasExplicitGeographyInText(text: string, place: string): boolean {
  const lower = text.toLowerCase();
  const placeLower = place.toLowerCase();
  if (!lower.includes(placeLower)) {
    return false;
  }
  const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:${EXPLICIT_GEO_PATTERN_PARTS.join("|")})\\s+${escaped}|${escaped}\\s+(?:office|team|operations|headquarters|branch)|address[^.]{0,100}${escaped}`,
    "i",
  );
  return pattern.test(text);
}

function classifyGeographicMention(
  place: string,
  pageText: string,
  pageUrl: string,
): GeographicSignalKind {
  const path = pagePath(pageUrl);
  if (
    /\/(contact|about|location|office|address)/i.test(path) &&
    hasExplicitGeographyInText(pageText, place)
  ) {
    return "explicit_office_or_address";
  }
  if (/\b(serving|service area|we serve|areas we serve)\b/i.test(pageText) && pageText.toLowerCase().includes(place.toLowerCase())) {
    return "explicit_service_area";
  }
  if (hasExplicitGeographyInText(pageText, place)) {
    return "explicit_service_area";
  }
  if (pageText.toLowerCase().includes(place.toLowerCase())) {
    return "city_or_region_mention";
  }
  return "incidental_reference";
}

function normalizeServiceLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  return SERVICE_LABELS[key] ?? raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function serviceConfidence(
  pages: ExtractedPage[],
  evidenceIds: string[],
): ProfileConfidence {
  const pagesWithService = new Set<string>();
  let inHeading = false;
  let onServicesPath = false;

  for (const page of pages) {
    for (const record of page.evidence) {
      if (!evidenceIds.includes(record.id)) {
        continue;
      }
      pagesWithService.add(page.finalPageUrl);
      if (record.evidenceType === "heading" && /services?/i.test(record.value)) {
        inHeading = true;
      }
      if (/\/services?(\/|$)/i.test(pagePath(page.finalPageUrl))) {
        onServicesPath = true;
      }
    }
  }

  if (pagesWithService.size >= 2 || onServicesPath) {
    return "high";
  }
  if (inHeading && pagesWithService.size >= 1) {
    return "medium";
  }
  if (pagesWithService.size === 1) {
    return "low";
  }
  return "low";
}

function extractTargetCustomers(text: string, page: ExtractedPage): Array<{ value: string; evidenceId: string }> {
  const mainRecord = page.evidence.find(
    (item) =>
      item.evidenceType === "visible_text" &&
      item.extractionMethod === "heuristic_main_content",
  );
  const evidenceId = mainRecord?.id;
  if (!evidenceId) {
    return [];
  }
  const found: Array<{ value: string; evidenceId: string }> = [];
  for (const match of text.matchAll(TARGET_CUSTOMER_PATTERN)) {
    const value = match[0]?.trim();
    if (value) {
      found.push({ value, evidenceId });
    }
  }
  return found;
}

function themeKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function groupExtractedPagesByDomain(
  pages: ExtractedPage[],
): Map<string, ExtractedPage[]> {
  const grouped = new Map<string, ExtractedPage[]>();
  for (const page of pages) {
    const domain = domainFromUrl(page.finalPageUrl);
    if (!domain) {
      continue;
    }
    const list = grouped.get(domain) ?? [];
    list.push(page);
    grouped.set(domain, list);
  }
  return grouped;
}

export function buildWebsiteIntelligenceProfile(
  input: WebsiteProfileBuildInput,
): WebsiteIntelligenceProfile {
  const domain = input.domain.toLowerCase();
  const pages = input.extractedPages.filter(
    (page) => domainFromUrl(page.finalPageUrl) === domain,
  );
  const sortedPages = [...pages].sort((a, b) =>
    a.finalPageUrl.localeCompare(b.finalPageUrl),
  );

  const officialWebsiteUrl =
    input.officialWebsiteUrl ??
    (sortedPages.find((p) => p.retrievalStatus === "success")
      ? `https://${domain}/`
      : null);

  const profileLimitations = [
    "Profile fields are aggregated from bounded HTML page extraction only; this is not a complete website audit.",
    "Each field links to page-level evidence IDs; Tavily search snippets are not merged into these records.",
  ];

  const identityCandidates: BusinessIdentityCandidate[] = [];
  for (const page of sortedPages) {
    if (page.retrievalStatus !== "success") {
      continue;
    }
    const homepage = isHomepageUrl(page.finalPageUrl);
    for (const record of page.evidence) {
      if (record.evidenceType === "page_title") {
        identityCandidates.push({
          name: record.value,
          source: homepage ? "homepage_title" : "page_title",
          evidenceIds: [record.id],
          confidence: homepage ? "high" : "medium",
        });
      }
      if (record.evidenceType === "og_site_name") {
        identityCandidates.push({
          name: record.value,
          source: "og_site_name",
          evidenceIds: [record.id],
          confidence: "high",
        });
      }
      if (record.evidenceType === "meta_description" && record.value.length >= 24) {
        identityCandidates.push({
          name: record.value.slice(0, 160),
          source: "meta_description",
          evidenceIds: [record.id],
          confidence: "low",
        });
      }
      if (record.evidenceType === "heading" && record.context === "h1") {
        identityCandidates.push({
          name: record.value,
          source: "primary_heading",
          evidenceIds: [record.id],
          confidence: homepage ? "high" : "medium",
        });
      }
    }
  }

  identityCandidates.sort((a, b) => a.name.localeCompare(b.name));
  const distinctIdentityNames = uniqueSorted(identityCandidates.map((c) => c.name));
  const conflictingNames =
    distinctIdentityNames.length > 1 ? distinctIdentityNames : [];

  const serviceMap = new Map<
    string,
    { wordings: Set<string>; evidenceIds: Set<string>; urls: Set<string> }
  >();
  for (const page of sortedPages) {
    if (page.retrievalStatus !== "success") {
      continue;
    }
    for (const record of page.evidence) {
      if (record.evidenceType !== "service_mention") {
        continue;
      }
      const normalized = normalizeServiceLabel(record.value);
      const bucket = serviceMap.get(normalized) ?? {
        wordings: new Set<string>(),
        evidenceIds: new Set<string>(),
        urls: new Set<string>(),
      };
      bucket.wordings.add(record.value);
      bucket.evidenceIds.add(record.id);
      bucket.urls.add(page.finalPageUrl);
      serviceMap.set(normalized, bucket);
    }
  }

  const documentedServices: DocumentedService[] = [...serviceMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([normalizedLabel, bucket]) => {
      const evidenceIds = sortStrings([...bucket.evidenceIds]);
      const confidence = serviceConfidence(sortedPages, evidenceIds);
      return {
        normalizedLabel,
        originalWordings: sortStrings([...bucket.wordings]),
        evidenceIds,
        sourcePageUrls: sortStrings([...bucket.urls]),
        confidence,
      };
    })
    .filter((service) => service.confidence !== "low");

  const geoMap = new Map<
    string,
    {
      kind: GeographicSignalKind;
      label: string;
      evidenceIds: Set<string>;
      urls: Set<string>;
      excerpt: string | null;
    }
  >();

  for (const page of sortedPages) {
    if (page.retrievalStatus !== "success") {
      continue;
    }
    const text = mainTextForPage(page);
    for (const record of page.evidence) {
      if (record.evidenceType !== "location_mention") {
        continue;
      }
      const kind = classifyGeographicMention(record.value, text, page.finalPageUrl);
      const key = `${kind}:${record.value.toLowerCase()}`;
      const bucket = geoMap.get(key) ?? {
        kind,
        label: record.value,
        evidenceIds: new Set<string>(),
        urls: new Set<string>(),
        excerpt: null,
      };
      bucket.evidenceIds.add(record.id);
      bucket.urls.add(page.finalPageUrl);
      if (!bucket.excerpt && text) {
        const idx = text.toLowerCase().indexOf(record.value.toLowerCase());
        if (idx >= 0) {
          bucket.excerpt = text.slice(Math.max(0, idx - 40), idx + record.value.length + 40).trim();
        }
      }
      geoMap.set(key, bucket);
    }
  }

  const geographicSignals: GeographicSignal[] = [...geoMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, bucket]) => ({
      kind: bucket.kind,
      label: bucket.label,
      evidenceIds: sortStrings([...bucket.evidenceIds]),
      sourcePageUrls: sortStrings([...bucket.urls]),
      supportingExcerpt: bucket.excerpt,
    }));

  const valuePropositions: GroundedStringClaim[] = [];
  for (const page of sortedPages) {
    for (const record of page.evidence) {
      if (record.evidenceType !== "value_proposition") {
        continue;
      }
      valuePropositions.push({
        value: record.value,
        evidenceIds: [record.id],
        sourcePageUrls: [page.finalPageUrl],
        confidence: "medium",
        notes: [],
      });
    }
  }
  valuePropositions.sort((a, b) => a.value.localeCompare(b.value));

  const targetMap = new Map<string, { evidenceIds: Set<string>; urls: Set<string> }>();
  for (const page of sortedPages) {
    const matches = extractTargetCustomers(mainTextForPage(page), page);
    for (const match of matches) {
      const key = match.value.toLowerCase();
      const bucket = targetMap.get(key) ?? {
        evidenceIds: new Set<string>(),
        urls: new Set<string>(),
      };
      bucket.evidenceIds.add(match.evidenceId);
      bucket.urls.add(page.finalPageUrl);
      targetMap.set(key, bucket);
    }
  }
  const targetCustomerIndicators: GroundedStringClaim[] = [...targetMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({
      value: key,
      evidenceIds: sortStrings([...bucket.evidenceIds]),
      sourcePageUrls: sortStrings([...bucket.urls]),
      confidence: "medium" as ProfileConfidence,
      notes: ["Derived from explicit audience phrasing in main content."],
    }));

  const pageStructure: PageStructureEntry[] = sortedPages.map((page) => {
    const titleRecord = page.evidence.find((e) => e.evidenceType === "page_title");
    const headings = page.evidence
      .filter((e) => e.evidenceType === "heading")
      .map((e) => ({
        level: Number.parseInt(e.context?.replace("h", "") ?? "0", 10) || 0,
        text: e.value,
        evidenceId: e.id,
      }))
      .sort((a, b) => a.level - b.level || a.text.localeCompare(b.text));
    return {
      requestedUrl: page.requestedUrl,
      finalPageUrl: page.finalPageUrl,
      retrievalStatus: page.retrievalStatus,
      title: titleRecord?.value ?? null,
      titleEvidenceId: titleRecord?.id ?? null,
      headings,
    };
  });

  const blogCategoryMap = new Map<string, { evidenceIds: Set<string>; urls: Set<string> }>();
  for (const page of sortedPages) {
    for (const record of page.evidence) {
      if (record.evidenceType !== "content_category") {
        continue;
      }
      const bucket = blogCategoryMap.get(record.value) ?? {
        evidenceIds: new Set<string>(),
        urls: new Set<string>(),
      };
      bucket.evidenceIds.add(record.id);
      bucket.urls.add(page.finalPageUrl);
      blogCategoryMap.set(record.value, bucket);
    }
  }
  const blogCategories: GroundedStringClaim[] = [...blogCategoryMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, bucket]) => ({
      value,
      evidenceIds: sortStrings([...bucket.evidenceIds]),
      sourcePageUrls: sortStrings([...bucket.urls]),
      confidence: "medium" as ProfileConfidence,
      notes: [],
    }));

  const themeMap = new Map<string, { evidenceIds: Set<string>; urls: Set<string> }>();
  for (const page of sortedPages) {
    for (const record of page.evidence) {
      if (record.evidenceType !== "heading") {
        continue;
      }
      const level = Number.parseInt(record.context?.replace("h", "") ?? "0", 10);
      if (level < 2 || level > 3) {
        continue;
      }
      const key = themeKey(record.value);
      if (key.length < 4) {
        continue;
      }
      const bucket = themeMap.get(key) ?? {
        evidenceIds: new Set<string>(),
        urls: new Set<string>(),
      };
      bucket.evidenceIds.add(record.id);
      bucket.urls.add(page.finalPageUrl);
      themeMap.set(key, bucket);
    }
  }
  const contentThemes: GroundedStringClaim[] = [...themeMap.entries()]
    .filter(([, bucket]) => bucket.urls.size >= 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({
      value: key,
      evidenceIds: sortStrings([...bucket.evidenceIds]),
      sourcePageUrls: sortStrings([...bucket.urls]),
      confidence: bucket.urls.size >= 2 ? ("high" as ProfileConfidence) : ("medium" as ProfileConfidence),
      notes:
        bucket.urls.size >= 2
          ? ["Repeated heading theme across multiple crawled pages."]
          : ["Observed on a single crawled page; not a site-wide content strategy claim."],
    }));

  const linkHubMap = new Map<
    string,
    { count: number; evidenceIds: string[]; anchors: Set<string> }
  >();
  for (const page of sortedPages) {
    for (const record of page.evidence) {
      if (record.evidenceType !== "internal_link") {
        continue;
      }
      const dest = record.value.toLowerCase();
      const bucket = linkHubMap.get(dest) ?? {
        count: 0,
        evidenceIds: [],
        anchors: new Set<string>(),
      };
      bucket.count += 1;
      bucket.evidenceIds.push(record.id);
      const anchor = record.context?.replace(/^anchor:\s*/i, "");
      if (anchor) {
        bucket.anchors.add(anchor);
      }
      linkHubMap.set(dest, bucket);
    }
  }
  const internalLinkHubs: InternalLinkHub[] = [...linkHubMap.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([destinationUrl, bucket]) => ({
      destinationUrl,
      inboundLinkCount: bucket.count,
      evidenceIds: sortStrings(bucket.evidenceIds),
      anchorSamples: sortStrings([...bucket.anchors]).slice(0, 5),
    }));

  const evidenceSources: EvidenceSourceSummary[] = sortedPages.map((page) => ({
    finalPageUrl: page.finalPageUrl,
    retrievalStatus: page.retrievalStatus,
    evidenceCount: page.evidence.length,
    evidenceIds: sortStrings(page.evidence.map((e) => e.id)),
  }));

  const domainRetrievals = input.retrievalRecords.filter(
    (record) => domainFromUrl(record.requestedUrl) === domain,
  );
  const failedPagesByStatus: Partial<Record<PageRetrievalStatus, number>> = {};
  for (const record of domainRetrievals) {
    if (record.status === "success") {
      continue;
    }
    failedPagesByStatus[record.status] = (failedPagesByStatus[record.status] ?? 0) + 1;
  }

  const pagesAttempted = domainRetrievals.length;
  const pagesRetrievedSuccessfully = domainRetrievals.filter(
    (r) => r.status === "success",
  ).length;
  const pagesBlockedByRobots = domainRetrievals.filter(
    (r) => r.status === "blocked_robots",
  ).length;
  const maxPageLimit = input.maxPageLimit ?? 3;

  const missingPageTypes: string[] = [];
  const paths = new Set(
    sortedPages
      .filter((p) => p.retrievalStatus === "success")
      .map((p) => pagePath(p.finalPageUrl)),
  );
  if (!paths.has("/")) {
    missingPageTypes.push("homepage");
  }
  if (![...paths].some((p) => /\/services?(\/|$)/.test(p))) {
    missingPageTypes.push("services");
  }
  if (![...paths].some((p) => /\/(contact|about)/.test(p))) {
    missingPageTypes.push("contact_or_about");
  }
  if (![...paths].some((p) => /\/blog(\/|$)/.test(p))) {
    missingPageTypes.push("blog");
  }

  const extractionLimitations = uniqueSorted(
    sortedPages.flatMap((p) => p.limitations).concat(profileLimitations),
  );

  const crawlCoverage: CrawlCoverageReport = {
    pagesAttempted,
    pagesRetrievedSuccessfully,
    pagesBlockedByRobots,
    failedPagesByStatus,
    maxPageLimit,
    missingPageTypes: sortStrings(missingPageTypes),
    extractionLimitations,
    coverageDisclaimer: `Partial crawl only (${pagesRetrievedSuccessfully}/${pagesAttempted} pages retrieved successfully; limit ${maxPageLimit} per domain). Not a complete website audit.`,
  };

  const phase101Verification = input.phase101Verification
    ? {
        verificationStatus: input.phase101Verification.verificationStatus,
        fullyVerified: input.phase101Verification.fullyVerified,
        officialWebsiteUrl: input.phase101Verification.officialWebsiteUrl,
        evidenceLimitations: [...input.phase101Verification.evidenceLimitations],
        searchGeographicEvidenceCount:
          input.phase101Verification.searchGeographicEvidenceCount,
        preservationNote:
          "Phase 10.1 verification status is preserved as-is; page-level extraction does not upgrade or downgrade search-based verification.",
      }
    : null;

  assertProfileEvidenceGrounding({
    businessIdentity: identityCandidates,
    documentedServices,
    geographicSignals,
    valuePropositions,
    targetCustomerIndicators,
    blogCategories,
    contentThemes,
    internalLinkHubs,
    pageStructure,
  });

  return {
    domain,
    officialWebsiteUrl,
    businessIdentity: {
      candidates: identityCandidates,
      conflictingNames,
    },
    documentedServices,
    geographicSignals,
    valuePropositions,
    targetCustomerIndicators,
    pageStructure,
    blogCategories,
    contentThemes,
    internalLinkHubs,
    evidenceSources,
    crawlCoverage,
    phase101Verification,
    profileLimitations,
  };
}

type GroundingCheckInput = {
  businessIdentity: BusinessIdentityCandidate[];
  documentedServices: DocumentedService[];
  geographicSignals: GeographicSignal[];
  valuePropositions: GroundedStringClaim[];
  targetCustomerIndicators: GroundedStringClaim[];
  blogCategories: GroundedStringClaim[];
  contentThemes: GroundedStringClaim[];
  internalLinkHubs: InternalLinkHub[];
  pageStructure: PageStructureEntry[];
};

export function assertProfileEvidenceGrounding(input: GroundingCheckInput): void {
  const requireIds = (ids: string[], label: string) => {
    if (ids.length === 0) {
      throw new Error(`Profile field "${label}" must reference at least one evidence ID.`);
    }
    for (const id of ids) {
      if (!id.trim()) {
        throw new Error(`Profile field "${label}" contains an empty evidence ID.`);
      }
    }
  };

  for (const candidate of input.businessIdentity) {
    requireIds(candidate.evidenceIds, "businessIdentity");
  }
  for (const service of input.documentedServices) {
    requireIds(service.evidenceIds, "documentedServices");
  }
  for (const geo of input.geographicSignals) {
    requireIds(geo.evidenceIds, "geographicSignals");
  }
  for (const claim of [
    ...input.valuePropositions,
    ...input.targetCustomerIndicators,
    ...input.blogCategories,
    ...input.contentThemes,
  ]) {
    requireIds(claim.evidenceIds, "groundedClaim");
  }
  for (const hub of input.internalLinkHubs) {
    requireIds(hub.evidenceIds, "internalLinkHubs");
  }
  for (const page of input.pageStructure) {
    for (const heading of page.headings) {
      requireIds([heading.evidenceId], "pageStructure.heading");
    }
    if (page.title && !page.titleEvidenceId) {
      throw new Error("Page title must include titleEvidenceId when title is set.");
    }
  }
}

export function collectEvidenceIdsByType(
  pages: ExtractedPage[],
  type: PageEvidenceType,
): string[] {
  return sortStrings(
    pages.flatMap((page) =>
      page.evidence.filter((e) => e.evidenceType === type).map((e) => e.id),
    ),
  );
}
