import type { CompetitorCandidate } from "@/lib/research/seo-competitor-verification";
import { validateExternalResearchUrl } from "@/lib/research/url-safety";
import { compareWebsiteIntelligenceProfiles } from "@/lib/website-intelligence/compare/website-comparison-core";
import { extractPageFromRetrieval } from "@/lib/website-intelligence/extract/page-extract-core";
import { DEFAULT_MAX_PAGES_PER_DOMAIN } from "@/lib/website-intelligence/fetch/fetch-policy";
import {
  createPageRetrievalInvestigationState,
  resolveEffectivePageLimit,
  retrievePublicPage,
  type PageRetrievalDeps,
  type RetrievePublicPageOptions,
} from "@/lib/website-intelligence/fetch/page-retrieval-core";
import {
  enrichCompetitorCandidatesWithProfiles,
  type EnrichedCompetitorCandidate,
} from "@/lib/website-intelligence/profile/competitor-enrichment-core";
import {
  assertProfileEvidenceGrounding,
  buildWebsiteIntelligenceProfile,
  type WebsiteIntelligenceProfile,
} from "@/lib/website-intelligence/profile/website-profile-core";
import type {
  ExtractedPage,
  PageRetrievalRecord,
  WebsiteIntelligenceComparisonReport,
  WebsiteIntelligencePipelineStatus,
} from "@/lib/website-intelligence/types";

export type WebsiteIntelligencePipelineCandidateEligibility = "eligible" | "excluded";

export type CandidateEligibilityAssessment = {
  eligibility: WebsiteIntelligencePipelineCandidateEligibility;
  exclusionReason: string | null;
  normalizedOfficialUrl: string | null;
};

export type WebsiteIntelligencePipelineCandidateRecord = {
  candidate: CompetitorCandidate;
  eligibility: WebsiteIntelligencePipelineCandidateEligibility;
  exclusionReason: string | null;
  plannedCrawlUrls: string[];
  retrievalRecords: PageRetrievalRecord[];
  extractedPages: ExtractedPage[];
  profile: WebsiteIntelligenceProfile | null;
};

export type WebsiteIntelligencePipelineInput = {
  candidates: CompetitorCandidate[];
  maxPagesPerDomain?: number;
};

export type WebsiteIntelligencePipelineDeps = {
  retrievePage: (options: RetrievePublicPageOptions) => Promise<PageRetrievalRecord>;
  extractPage: (input: {
    retrieval: PageRetrievalRecord;
    html?: string;
  }) => ExtractedPage;
  buildProfile: typeof buildWebsiteIntelligenceProfile;
};

export type WebsiteIntelligencePipelineReport = {
  status: WebsiteIntelligencePipelineStatus;
  candidateRecords: WebsiteIntelligencePipelineCandidateRecord[];
  excludedCandidates: Array<{ name: string; domain: string | null; reason: string }>;
  enrichedCandidates: EnrichedCompetitorCandidate[];
  comparisonReport: WebsiteIntelligenceComparisonReport | null;
  comparisonLimitation: string | null;
  totalRetrievalAttempts: number;
  totalSuccessfulExtractions: number;
  pipelineLimitations: string[];
  provenanceEvidenceIds: string[];
  provenanceSourceUrls: string[];
  sanitizedError: string | null;
};

const DIRECTORY_HOST_HINTS = [
  "clutch.co",
  "goodfirms.co",
  "sortlist.com",
  "designrush.com",
  "justdial.com",
  "indiamart.com",
];

function sanitizePublicErrorMessage(message: string): string {
  return message
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[ip]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/api[_-]?key[=:]\S+/gi, "api_key=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function domainFromUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function sortStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function uniqueSorted(values: string[]): string[] {
  return sortStrings([...new Set(values)]);
}

function cloneCandidate(candidate: CompetitorCandidate): CompetitorCandidate {
  return {
    ...candidate,
    geographicEvidence: [...candidate.geographicEvidence],
    evidenceLimitations: [...candidate.evidenceLimitations],
    chennaiPresenceEvidence: [...candidate.chennaiPresenceEvidence],
    statedServices: [...candidate.statedServices],
    positioningNotes: [...candidate.positioningNotes],
    contentThemes: [...candidate.contentThemes],
    sourceUrls: [...candidate.sourceUrls],
    sourceClassifications: [...candidate.sourceClassifications],
    missingInformation: [...candidate.missingInformation],
  };
}

function isDirectoryHost(url: string): boolean {
  const domain = domainFromUrl(url);
  if (!domain) {
    return false;
  }
  return DIRECTORY_HOST_HINTS.some(
    (hint) => domain === hint || domain.endsWith(`.${hint}`),
  );
}

export function assessCandidateEligibility(
  candidate: CompetitorCandidate,
): CandidateEligibilityAssessment {
  if (!candidate.officialWebsiteIdentified) {
    return {
      eligibility: "excluded",
      exclusionReason:
        "No official agency website identified from Phase 10.1 evidence; directory or listing URLs cannot be crawled as the official site.",
      normalizedOfficialUrl: null,
    };
  }

  if (!candidate.officialWebsiteUrl) {
    return {
      eligibility: "excluded",
      exclusionReason:
        "Official website URL is missing; the pipeline will not invent a competitor website URL.",
      normalizedOfficialUrl: null,
    };
  }

  if (
    candidate.sourceClassifications.length > 0 &&
    candidate.sourceClassifications.every((item) => item === "business_directory")
  ) {
    return {
      eligibility: "excluded",
      exclusionReason:
        "Only business directory/listing sources are present; third-party listing pages are not crawled as official websites.",
      normalizedOfficialUrl: null,
    };
  }

  const safety = validateExternalResearchUrl(candidate.officialWebsiteUrl);
  if (!safety.ok || !safety.normalizedUrl) {
    return {
      eligibility: "excluded",
      exclusionReason: "Official website URL failed external URL safety validation.",
      normalizedOfficialUrl: null,
    };
  }

  if (isDirectoryHost(safety.normalizedUrl)) {
    return {
      eligibility: "excluded",
      exclusionReason:
        "Official website URL points to a known directory/listing host; crawl is limited to verified official agency domains.",
      normalizedOfficialUrl: null,
    };
  }

  const officialOrigin = new URL(safety.normalizedUrl).origin;
  const hasOfficialSourceOnOrigin = candidate.sourceUrls.some((sourceUrl) => {
    try {
      return new URL(sourceUrl).origin === officialOrigin;
    } catch {
      return false;
    }
  });
  if (
    candidate.sourceClassifications.includes("official_agency_website") &&
    !hasOfficialSourceOnOrigin
  ) {
    return {
      eligibility: "excluded",
      exclusionReason:
        "Official website URL origin does not match any Phase 10.1 official source URL for this candidate.",
      normalizedOfficialUrl: null,
    };
  }

  return {
    eligibility: "eligible",
    exclusionReason: null,
    normalizedOfficialUrl: safety.normalizedUrl,
  };
}

export function planBoundedCrawlUrls(
  officialWebsiteUrl: string,
  maxPages?: number,
): string[] {
  const safety = validateExternalResearchUrl(officialWebsiteUrl);
  if (!safety.ok || !safety.normalizedUrl) {
    return [];
  }

  const limit = resolveEffectivePageLimit(maxPages ?? DEFAULT_MAX_PAGES_PER_DOMAIN);
  const base = new URL(safety.normalizedUrl);
  const homepage = new URL("/", base.origin).toString();
  const candidates = [
    homepage,
    new URL("/services", base.origin).toString(),
    new URL("/about", base.origin).toString(),
    new URL("/contact", base.origin).toString(),
  ];

  const planned: string[] = [];
  for (const url of candidates) {
    const key = url.toLowerCase();
    if (planned.some((item) => item.toLowerCase() === key)) {
      continue;
    }
    planned.push(url);
    if (planned.length >= limit) {
      break;
    }
  }
  return planned;
}

function isUsableProfile(profile: WebsiteIntelligenceProfile): boolean {
  return profile.crawlCoverage.pagesRetrievedSuccessfully > 0;
}

function resolvePipelineStatus(input: {
  eligibleCount: number;
  excludedCount: number;
  usableProfileCount: number;
  hadRetrievalFailures: boolean;
  sanitizedError: string | null;
}): WebsiteIntelligencePipelineStatus {
  if (input.sanitizedError) {
    return "failed";
  }
  if (input.eligibleCount === 0) {
    return "no_eligible_candidates";
  }
  if (input.usableProfileCount < 2) {
    return "insufficient_profiles";
  }
  if (input.excludedCount > 0 || input.hadRetrievalFailures) {
    return "completed_with_limitations";
  }
  return "completed";
}

function collectProvenance(records: WebsiteIntelligencePipelineCandidateRecord[]): {
  evidenceIds: string[];
  sourceUrls: string[];
} {
  const evidenceIds: string[] = [];
  const sourceUrls: string[] = [];
  for (const record of records) {
    for (const page of record.extractedPages) {
      sourceUrls.push(page.finalPageUrl);
      for (const item of page.evidence) {
        evidenceIds.push(item.id);
        sourceUrls.push(item.finalPageUrl);
      }
    }
  }
  return {
    evidenceIds: uniqueSorted(evidenceIds),
    sourceUrls: uniqueSorted(sourceUrls),
  };
}

export function createDefaultWebsiteIntelligencePipelineDeps(
  retrievalDeps?: PageRetrievalDeps,
): WebsiteIntelligencePipelineDeps {
  return {
    retrievePage: (options) =>
      retrievePublicPage({
        ...options,
        deps: options.deps ?? retrievalDeps,
      }),
    extractPage: extractPageFromRetrieval,
    buildProfile: buildWebsiteIntelligenceProfile,
  };
}

export async function runWebsiteIntelligencePipeline(
  input: WebsiteIntelligencePipelineInput,
  deps: WebsiteIntelligencePipelineDeps = createDefaultWebsiteIntelligencePipelineDeps(),
): Promise<WebsiteIntelligencePipelineReport> {
  const sortedCandidates = [...input.candidates]
    .map(cloneCandidate)
    .sort((a, b) => (a.officialWebsiteUrl ?? a.name).localeCompare(b.officialWebsiteUrl ?? b.name));

  const pipelineLimitations = [
    "Website intelligence pipeline uses bounded HTML retrieval; search snippets remain separate from page-level evidence.",
    "Phase 10.1 verification status is preserved and is not upgraded or downgraded by crawling.",
    "Absence of a service or page type in crawled HTML is not proof that the competitor lacks it.",
  ];

  const state = createPageRetrievalInvestigationState();
  const candidateRecords: WebsiteIntelligencePipelineCandidateRecord[] = [];
  const excludedCandidates: Array<{ name: string; domain: string | null; reason: string }> = [];
  let sanitizedError: string | null = null;
  let totalRetrievalAttempts = 0;
  let totalSuccessfulExtractions = 0;
  let hadRetrievalFailures = false;

  try {
    for (const candidate of sortedCandidates) {
      const assessment = assessCandidateEligibility(candidate);
      if (assessment.eligibility === "excluded") {
        excludedCandidates.push({
          name: candidate.name,
          domain: domainFromUrl(candidate.officialWebsiteUrl),
          reason: assessment.exclusionReason ?? "Candidate excluded.",
        });
        candidateRecords.push({
          candidate,
          eligibility: "excluded",
          exclusionReason: assessment.exclusionReason,
          plannedCrawlUrls: [],
          retrievalRecords: [],
          extractedPages: [],
          profile: null,
        });
        continue;
      }

      const plannedCrawlUrls = planBoundedCrawlUrls(
        assessment.normalizedOfficialUrl!,
        input.maxPagesPerDomain,
      );
      const retrievalRecords: PageRetrievalRecord[] = [];
      const extractedPages: ExtractedPage[] = [];

      for (const url of plannedCrawlUrls) {
        totalRetrievalAttempts += 1;
        const record = await deps.retrievePage({
          url,
          state,
          maxPagesPerDomain: input.maxPagesPerDomain,
        });
        retrievalRecords.push(record);
        if (record.status !== "success") {
          hadRetrievalFailures = true;
        }
        const extracted = deps.extractPage({ retrieval: record });
        extractedPages.push(extracted);
        if (record.status === "success") {
          totalSuccessfulExtractions += 1;
        }
      }

      const domain = domainFromUrl(assessment.normalizedOfficialUrl);
      let profile: WebsiteIntelligenceProfile | null = null;
      const successfulPages = retrievalRecords.filter((item) => item.status === "success").length;
      if (successfulPages > 0 && domain) {
        profile = deps.buildProfile({
          domain,
          officialWebsiteUrl: assessment.normalizedOfficialUrl,
          extractedPages,
          retrievalRecords,
          maxPageLimit: resolveEffectivePageLimit(input.maxPagesPerDomain),
          phase101Verification: {
            verificationStatus: candidate.verificationStatus,
            fullyVerified: candidate.fullyVerified,
            officialWebsiteUrl: candidate.officialWebsiteUrl,
            evidenceLimitations: candidate.evidenceLimitations,
            searchGeographicEvidenceCount: candidate.geographicEvidence.length,
          },
        });
        assertProfileEvidenceGrounding({
          businessIdentity: profile.businessIdentity.candidates,
          documentedServices: profile.documentedServices,
          geographicSignals: profile.geographicSignals,
          valuePropositions: profile.valuePropositions,
          targetCustomerIndicators: profile.targetCustomerIndicators,
          blogCategories: profile.blogCategories,
          contentThemes: profile.contentThemes,
          internalLinkHubs: profile.internalLinkHubs,
          pageStructure: profile.pageStructure,
        });
      }

      candidateRecords.push({
        candidate,
        eligibility: "eligible",
        exclusionReason: null,
        plannedCrawlUrls,
        retrievalRecords,
        extractedPages,
        profile,
      });
    }
  } catch (error) {
    sanitizedError = sanitizePublicErrorMessage(
      error instanceof Error ? error.message : "Website intelligence pipeline failed.",
    );
  }

  const profilesByDomain = new Map<string, WebsiteIntelligenceProfile>();
  for (const record of candidateRecords) {
    if (record.profile) {
      profilesByDomain.set(record.profile.domain, record.profile);
    }
  }

  const enrichedCandidates = enrichCompetitorCandidatesWithProfiles({
    candidates: sortedCandidates,
    profilesByDomain,
  });

  const usableProfiles = [...profilesByDomain.values()]
    .filter(isUsableProfile)
    .sort((a, b) => a.domain.localeCompare(b.domain));

  let comparisonReport: WebsiteIntelligenceComparisonReport | null = null;
  let comparisonLimitation: string | null = null;
  if (usableProfiles.length >= 2) {
    comparisonReport = compareWebsiteIntelligenceProfiles(usableProfiles);
  } else {
    comparisonLimitation =
      usableProfiles.length === 0
        ? "No competitor profiles had successfully retrieved HTML pages; comparison was not run."
        : "Fewer than two competitors had usable page-level profiles; comparison was not run.";
    pipelineLimitations.push(comparisonLimitation);
  }

  const eligibleCount = candidateRecords.filter((item) => item.eligibility === "eligible").length;
  const status = resolvePipelineStatus({
    eligibleCount,
    excludedCount: excludedCandidates.length,
    usableProfileCount: usableProfiles.length,
    hadRetrievalFailures,
    sanitizedError,
  });

  const provenance = collectProvenance(candidateRecords);

  return {
    status,
    candidateRecords,
    excludedCandidates,
    enrichedCandidates,
    comparisonReport,
    comparisonLimitation,
    totalRetrievalAttempts,
    totalSuccessfulExtractions,
    pipelineLimitations: uniqueSorted(pipelineLimitations),
    provenanceEvidenceIds: provenance.evidenceIds,
    provenanceSourceUrls: provenance.sourceUrls,
    sanitizedError,
  };
}
