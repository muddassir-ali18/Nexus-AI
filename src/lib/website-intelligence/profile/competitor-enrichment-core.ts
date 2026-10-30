import type { CompetitorCandidate } from "@/lib/research/seo-competitor-verification";
import type { WebsiteIntelligenceProfile } from "@/lib/website-intelligence/profile/website-profile-core";

export type WebsiteProfileReference = {
  domain: string;
  officialWebsiteUrl: string | null;
  pagesRetrievedSuccessfully: number;
  pagesAttempted: number;
  documentedServiceCount: number;
  pageLevelEvidenceSourceCount: number;
  crawlCoverageDisclaimer: string;
};

export type EnrichedCompetitorCandidate = CompetitorCandidate & {
  websiteProfile: WebsiteProfileReference | null;
  pageLevelEvidenceNotes: string[];
};

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

function buildProfileReference(profile: WebsiteIntelligenceProfile): WebsiteProfileReference {
  return {
    domain: profile.domain,
    officialWebsiteUrl: profile.officialWebsiteUrl,
    pagesRetrievedSuccessfully: profile.crawlCoverage.pagesRetrievedSuccessfully,
    pagesAttempted: profile.crawlCoverage.pagesAttempted,
    documentedServiceCount: profile.documentedServices.length,
    pageLevelEvidenceSourceCount: profile.evidenceSources.filter(
      (source) => source.retrievalStatus === "success" && source.evidenceCount > 0,
    ).length,
    crawlCoverageDisclaimer: profile.crawlCoverage.coverageDisclaimer,
  };
}

function profileNotesForCandidate(
  candidate: CompetitorCandidate,
  profile: WebsiteIntelligenceProfile | null,
): string[] {
  const notes: string[] = [
    "Search-result verification (Phase 10.1) and page-level HTML evidence remain separate provenance streams.",
  ];

  if (!profile) {
    notes.push(
      "No website intelligence profile attached for this domain; enrichment is limited to existing search evidence.",
    );
    return notes;
  }

  if (profile.crawlCoverage.pagesRetrievedSuccessfully === 0) {
    notes.push(
      "Page crawl returned no successful HTML retrievals; profile fields may be empty despite search snippets.",
    );
  }

  if (profile.documentedServices.length === 0 && candidate.servicesPubliclyDocumented) {
    notes.push(
      "Search snippets document services, but bounded page extraction did not confirm service mentions on retrieved pages.",
    );
  }

  if (
    profile.geographicSignals.every((item) => item.kind === "city_or_region_mention" || item.kind === "incidental_reference") &&
    candidate.chennaiPresenceSupported
  ) {
    notes.push(
      "Phase 10.1 geographic verification uses search evidence; page-level signals are incidental mentions only — not upgraded to office proof.",
    );
  }

  if (profile.businessIdentity.conflictingNames.length > 0) {
    notes.push(
      `Conflicting business names observed on crawled pages: ${profile.businessIdentity.conflictingNames.join(", ")}.`,
    );
  }

  return notes;
}

function missingInformationFromProfile(
  candidate: CompetitorCandidate,
  profile: WebsiteIntelligenceProfile | null,
): string[] {
  const additions: string[] = [];
  if (!profile) {
    additions.push("Website intelligence profile not available for additive page-level enrichment.");
    return additions;
  }

  if (profile.crawlCoverage.missingPageTypes.length > 0) {
    additions.push(
      `Crawl did not retrieve page types: ${profile.crawlCoverage.missingPageTypes.join(", ")}.`,
    );
  }

  if (profile.crawlCoverage.pagesBlockedByRobots > 0) {
    additions.push(
      `${profile.crawlCoverage.pagesBlockedByRobots} page(s) blocked by robots.txt during crawl.`,
    );
  }

  return additions;
}

export function enrichCompetitorCandidatesWithProfiles(input: {
  candidates: CompetitorCandidate[];
  profilesByDomain: Map<string, WebsiteIntelligenceProfile>;
}): EnrichedCompetitorCandidate[] {
  const sortedCandidates = [...input.candidates].sort((a, b) =>
    (a.websiteUrl ?? a.name).localeCompare(b.websiteUrl ?? b.name),
  );

  return sortedCandidates.map((candidate) => {
    const domain =
      domainFromUrl(candidate.officialWebsiteUrl) ?? domainFromUrl(candidate.websiteUrl);
    const profile = domain ? input.profilesByDomain.get(domain) ?? null : null;

    const websiteProfile = profile ? buildProfileReference(profile) : null;
    const pageLevelEvidenceNotes = profileNotesForCandidate(candidate, profile);
    const missingInformation = uniquePreserveOrder([
      ...candidate.missingInformation,
      ...missingInformationFromProfile(candidate, profile),
    ]);

    return {
      ...candidate,
      verificationStatus: candidate.verificationStatus,
      fullyVerified: candidate.fullyVerified,
      officialWebsiteIdentified: candidate.officialWebsiteIdentified,
      officialWebsiteUrl: candidate.officialWebsiteUrl,
      chennaiPresenceSupported: candidate.chennaiPresenceSupported,
      servicesPubliclyDocumented: candidate.servicesPubliclyDocumented,
      geographicEvidence: [...candidate.geographicEvidence],
      evidenceLimitations: [...candidate.evidenceLimitations],
      conflictingGeography: candidate.conflictingGeography,
      chennaiPresenceEvidence: [...candidate.chennaiPresenceEvidence],
      statedServices: [...candidate.statedServices],
      positioningNotes: [...candidate.positioningNotes],
      contentThemes: [...candidate.contentThemes],
      sourceUrls: [...candidate.sourceUrls],
      sourceClassifications: [...candidate.sourceClassifications],
      missingInformation,
      websiteProfile,
      pageLevelEvidenceNotes,
    };
  });
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}
