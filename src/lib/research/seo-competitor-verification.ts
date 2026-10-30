import type { SeoResearchIntent } from "@/lib/research/seo-research-intent";
import type { ScoredSeoFinding, SourceClassification } from "@/lib/research/seo-relevance-engine";

export type CompetitorVerificationStatus =
  | "verified"
  | "partially_verified"
  | "unverified";

export type GeographicEvidenceKind =
  | "search_snippet"
  | "official_page_signal"
  | "third_party_listing";

export type GeographicEvidenceEntry = {
  sourceUrl: string;
  sourceTitle: string;
  evidenceKind: GeographicEvidenceKind;
  description: string;
};

export type CompetitorEvidenceAssessment = {
  officialWebsiteIdentified: boolean;
  officialWebsiteUrl: string | null;
  chennaiPresenceSupported: boolean;
  servicesPubliclyDocumented: boolean;
  competitorFullyVerified: boolean;
  geographicEvidence: GeographicEvidenceEntry[];
  evidenceLimitations: string[];
  conflictingGeography: boolean;
  verificationStatus: CompetitorVerificationStatus;
};

export type CompetitorCandidate = {
  name: string;
  /** Official site URL when identified; never inferred from directory listings alone. */
  websiteUrl: string | null;
  verificationStatus: CompetitorVerificationStatus;
  officialWebsiteIdentified: boolean;
  officialWebsiteUrl: string | null;
  chennaiPresenceSupported: boolean;
  servicesPubliclyDocumented: boolean;
  fullyVerified: boolean;
  geographicEvidence: GeographicEvidenceEntry[];
  evidenceLimitations: string[];
  conflictingGeography: boolean;
  chennaiPresenceEvidence: string[];
  statedServices: string[];
  positioningNotes: string[];
  contentThemes: string[];
  sourceUrls: string[];
  sourceClassifications: SourceClassification[];
  missingInformation: string[];
};

const OFFICIAL_LOCATION_PATH =
  /\/(contact|about|about-us|location|locations|office|offices|address|chennai|who-we-are|company)(\/|$|\?)/i;

const OTHER_MARKET_CITIES = [
  "Mumbai",
  "Bengaluru",
  "Bangalore",
  "Delhi",
  "Hyderabad",
  "Pune",
  "Kolkata",
  "New York",
  "London",
];

function buildExplicitGeoPattern(geography: string): RegExp {
  const escaped = geography.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:based in|located in|office in|operations in|headquartered in|serving)\\s+${escaped}|${escaped}\\s+(?:office|team|operations|headquarters|branch)|address[^.]{0,100}${escaped}|${escaped}[^.]{0,40}(?:address|location)`,
    "i",
  );
}

function hasExplicitGeographyInText(text: string, geography: string): boolean {
  if (!text.toLowerCase().includes(geography.toLowerCase())) {
    return false;
  }
  return buildExplicitGeoPattern(geography).test(text);
}

function isOfficialPageLocationSignal(finding: ScoredSeoFinding, geography: string): boolean {
  if (finding.classification !== "official_agency_website") {
    return false;
  }
  const pathAndSnippet = `${finding.url} ${finding.title} ${finding.snippet}`;
  if (OFFICIAL_LOCATION_PATH.test(finding.url)) {
    return pathAndSnippet.toLowerCase().includes(geography.toLowerCase());
  }
  return hasExplicitGeographyInText(pathAndSnippet, geography);
}

function isWeakSnippetGeoOnly(finding: ScoredSeoFinding, geography: string): boolean {
  const text = `${finding.title} ${finding.snippet}`;
  if (!text.toLowerCase().includes(geography.toLowerCase())) {
    return false;
  }
  if (finding.classification !== "official_agency_website") {
    return false;
  }
  return !isOfficialPageLocationSignal(finding, geography);
}

export function assessCompetitorEvidence(
  findings: ScoredSeoFinding[],
  intent: SeoResearchIntent,
): CompetitorEvidenceAssessment {
  const geography = intent.geography;
  const officialFindings = findings.filter(
    (item) => item.classification === "official_agency_website",
  );
  const directoryFindings = findings.filter(
    (item) => item.classification === "business_directory",
  );

  const officialWebsiteIdentified = officialFindings.length > 0;
  const officialWebsiteUrl =
    officialFindings.find((item) => OFFICIAL_LOCATION_PATH.test(item.url))?.url ??
    officialFindings[0]?.url ??
    null;

  const geographicEvidence: GeographicEvidenceEntry[] = [];
  const evidenceLimitations: string[] = [
    "Geographic and service signals come from Tavily search snippets/indexed text only — not a full website crawl, legal-entity check, or page-level verification.",
  ];

  let conflictingGeography = false;
  if (geography) {
    const targetLower = geography.toLowerCase();
    for (const finding of findings) {
      const blob = `${finding.title} ${finding.snippet}`.toLowerCase();
      for (const other of OTHER_MARKET_CITIES) {
        if (other.toLowerCase() === targetLower) {
          continue;
        }
        if (hasExplicitGeographyInText(blob, other) && blob.includes(targetLower)) {
          conflictingGeography = true;
        }
      }
    }
  }

  if (geography) {
    for (const finding of findings) {
      const text = `${finding.title} ${finding.snippet}`;
      if (!text.toLowerCase().includes(geography.toLowerCase())) {
        continue;
      }

      if (finding.classification === "business_directory") {
        geographicEvidence.push({
          sourceUrl: finding.url,
          sourceTitle: finding.title,
          evidenceKind: "third_party_listing",
          description: `${geography} mentioned on a third-party directory/listing (search-result snippet). This does not verify an official site or local operations.`,
        });
        continue;
      }

      if (isOfficialPageLocationSignal(finding, geography)) {
        geographicEvidence.push({
          sourceUrl: finding.url,
          sourceTitle: finding.title,
          evidenceKind: "official_page_signal",
          description: `Official-site URL or snippet suggests ${geography} operations (search-indexed page signal, not a live page audit).`,
        });
        continue;
      }

      if (finding.classification === "official_agency_website") {
        geographicEvidence.push({
          sourceUrl: finding.url,
          sourceTitle: finding.title,
          evidenceKind: "search_snippet",
          description: `${geography} appears in a homepage/generic official-site search snippet only — not confirmed via contact, address, or location page.`,
        });
        continue;
      }

      if (hasExplicitGeographyInText(text, geography)) {
        geographicEvidence.push({
          sourceUrl: finding.url,
          sourceTitle: finding.title,
          evidenceKind: "search_snippet",
          description: `${geography} mentioned in a third-party search snippet (${finding.classification.replace(/_/g, " ")}).`,
        });
      }
    }
  }

  const hasOfficialPageSignal = officialFindings.some((finding) =>
    geography ? isOfficialPageLocationSignal(finding, geography) : false,
  );
  const explicitOfficialSnippet = officialFindings.some((finding) =>
    geography
      ? hasExplicitGeographyInText(`${finding.title} ${finding.snippet}`, geography)
      : false,
  );
  const strongOfficialGeoSourceCount = officialFindings.filter((finding) => {
    if (!geography) {
      return false;
    }
    return (
      isOfficialPageLocationSignal(finding, geography) ||
      hasExplicitGeographyInText(`${finding.title} ${finding.snippet}`, geography)
    );
  }).length;

  const directoryOnlyGeo =
    directoryFindings.some((f) =>
      `${f.title} ${f.snippet}`.toLowerCase().includes((geography ?? "").toLowerCase()),
    ) && !officialWebsiteIdentified;

  let chennaiPresenceSupported = false;
  if (geography && !conflictingGeography) {
    if (hasOfficialPageSignal || explicitOfficialSnippet) {
      chennaiPresenceSupported = true;
    } else if (strongOfficialGeoSourceCount >= 2) {
      chennaiPresenceSupported = true;
    } else if (
      strongOfficialGeoSourceCount >= 1 &&
      geographicEvidence.filter((item) => item.evidenceKind === "third_party_listing")
        .length >= 1
    ) {
      chennaiPresenceSupported = true;
    }
  }

  if (directoryOnlyGeo && !chennaiPresenceSupported) {
    evidenceLimitations.push(
      `${geography ?? "Local market"} appears only on directory/listing snippets; official Chennai operations are not established.`,
    );
  }

  if (
    geography &&
    officialFindings.some((finding) => isWeakSnippetGeoOnly(finding, geography)) &&
    !hasOfficialPageSignal &&
    !explicitOfficialSnippet
  ) {
    evidenceLimitations.push(
      `${geography} name appears in marketing/snippet text on an official domain, but explicit location or operations evidence was not found in indexed snippets.`,
    );
  }

  if (officialWebsiteIdentified && geography && !chennaiPresenceSupported) {
    evidenceLimitations.push(
      `Official website candidate identified, but explicit ${geography} presence is not supported from contact/location/operations signals in search snippets.`,
    );
  }

  const officialText = officialFindings
    .map((item) => `${item.title} ${item.snippet}`)
    .join(" ");
  const statedFromOfficial = extractServiceSignals(officialText);
  const servicesPubliclyDocumented = statedFromOfficial.length > 0;

  if (!servicesPubliclyDocumented && directoryFindings.length > 0) {
    evidenceLimitations.push(
      "Service claims in directory snippets are not treated as officially documented services.",
    );
  }

  let verificationStatus: CompetitorVerificationStatus = "unverified";
  if (conflictingGeography) {
    verificationStatus = "partially_verified";
    evidenceLimitations.push(
      "Conflicting geographic signals detected across sources; local market focus is uncertain.",
    );
  } else if (
    officialWebsiteIdentified &&
    chennaiPresenceSupported &&
    (intent.isLocalMarketResearch ? Boolean(geography) : true)
  ) {
    verificationStatus = "verified";
  } else if (
    officialWebsiteIdentified ||
    chennaiPresenceSupported ||
    directoryFindings.length > 0 ||
    findings.some((item) => item.geographicRelevance >= 0.2)
  ) {
    verificationStatus = "partially_verified";
  }

  const competitorFullyVerified = verificationStatus === "verified";

  return {
    officialWebsiteIdentified,
    officialWebsiteUrl,
    chennaiPresenceSupported,
    servicesPubliclyDocumented,
    competitorFullyVerified,
    geographicEvidence,
    evidenceLimitations,
    conflictingGeography,
    verificationStatus,
  };
}

function inferAgencyName(finding: ScoredSeoFinding): string {
  const title = finding.title.trim();
  const withoutSuffix = title
    .replace(/\s*[|\-–—:]\s*.+$/, "")
    .replace(/\b(top|best|leading)\b/gi, "")
    .trim();
  if (withoutSuffix.length >= 3 && withoutSuffix.length <= 80) {
    return withoutSuffix;
  }
  const domainPart = finding.domain.split(".")[0] ?? finding.domain;
  return domainPart.replace(/-/g, " ").trim() || finding.domain;
}

function extractServiceSignals(text: string): string[] {
  const services: string[] = [];
  const patterns = [
    /\b(local seo|technical seo|on-page seo|link building|content marketing|ppc|google ads)\b/gi,
    /\b(seo audit|keyword research|seo consulting)\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0]?.trim();
      if (value && !services.some((item) => item.toLowerCase() === value.toLowerCase())) {
        services.push(value);
      }
    }
  }
  return services;
}

function extractContentThemes(text: string): string[] {
  const themes: string[] = [];
  if (/\bblog\b/i.test(text)) {
    themes.push("Blog/content publishing mentioned in public snippets");
  }
  if (/\bcase stud(y|ies)\b/i.test(text)) {
    themes.push("Case studies mentioned in public snippets");
  }
  if (/\bportfolio\b/i.test(text)) {
    themes.push("Portfolio/work samples mentioned");
  }
  return themes;
}

export function buildCompetitorCandidates(
  findings: ScoredSeoFinding[],
  intent: SeoResearchIntent,
): CompetitorCandidate[] {
  const eligible = findings.filter((item) => !item.excludedFromCompetitorEvidence);
  const grouped = new Map<string, ScoredSeoFinding[]>();

  for (const finding of eligible) {
    const key = finding.domain;
    const list = grouped.get(key) ?? [];
    list.push(finding);
    grouped.set(key, list);
  }

  const candidates: CompetitorCandidate[] = [];

  for (const [, domainFindings] of grouped) {
    const primary = domainFindings[0];
    if (!primary) {
      continue;
    }
    const assessment = assessCompetitorEvidence(domainFindings, intent);
    const officialFindings = domainFindings.filter(
      (item) => item.classification === "official_agency_website",
    );
    const combinedText = domainFindings
      .map((item) => `${item.title} ${item.snippet}`)
      .join(" ");
    const name = inferAgencyName(primary);

    const chennaiPresenceEvidence = assessment.geographicEvidence.map(
      (entry) => `[${entry.evidenceKind}] ${entry.description} Source: ${entry.sourceUrl}`,
    );

    const missingInformation: string[] = [];
    if (!assessment.officialWebsiteIdentified) {
      missingInformation.push(
        "No official agency website identified from search snippets (directory/listing alone is insufficient).",
      );
    } else {
      missingInformation.push(
        "Official website ownership and corporate identity are not legally verified — only search-result association.",
      );
    }
    if (intent.geography && !assessment.chennaiPresenceSupported) {
      missingInformation.push(
        `Explicit ${intent.geography} presence not supported (requires contact/location/operations signals or multiple consistent official sources, not TLD or brand name alone).`,
      );
    }
    if (!assessment.servicesPubliclyDocumented) {
      missingInformation.push(
        "SEO services not documented from official-site snippets; directory marketing copy is excluded.",
      );
    }
    if (
      domainFindings.every((item) => item.classification === "business_directory")
    ) {
      missingInformation.push(
        "Only directory/listing sources found; detailed service claims require an official site source.",
      );
    }

    const positioningSource = officialFindings[0] ?? primary;

    candidates.push({
      name,
      websiteUrl: assessment.officialWebsiteUrl,
      verificationStatus: assessment.verificationStatus,
      officialWebsiteIdentified: assessment.officialWebsiteIdentified,
      officialWebsiteUrl: assessment.officialWebsiteUrl,
      chennaiPresenceSupported: assessment.chennaiPresenceSupported,
      servicesPubliclyDocumented: assessment.servicesPubliclyDocumented,
      fullyVerified: assessment.competitorFullyVerified,
      geographicEvidence: assessment.geographicEvidence,
      evidenceLimitations: assessment.evidenceLimitations,
      conflictingGeography: assessment.conflictingGeography,
      chennaiPresenceEvidence,
      statedServices: assessment.servicesPubliclyDocumented
        ? extractServiceSignals(
            officialFindings.map((item) => `${item.title} ${item.snippet}`).join(" "),
          )
        : [],
      positioningNotes: positioningSource.snippet
        ? [positioningSource.snippet.slice(0, 280)]
        : [],
      contentThemes: extractContentThemes(combinedText),
      sourceUrls: domainFindings.map((item) => item.url),
      sourceClassifications: [
        ...new Set(domainFindings.map((item) => item.classification)),
      ],
      missingInformation,
    });
  }

  candidates.sort((a, b) => {
    const rank = (status: CompetitorVerificationStatus) =>
      status === "verified" ? 3 : status === "partially_verified" ? 2 : 1;
    return rank(b.verificationStatus) - rank(a.verificationStatus);
  });

  const limit = intent.requestedCompetitorCount ?? candidates.length;
  return candidates.slice(0, Math.max(limit, 0));
}

export function buildCompetitorCandidateLabel(input: {
  intent: SeoResearchIntent;
  candidates: CompetitorCandidate[];
}): string {
  const verified = input.candidates.filter((item) => item.fullyVerified).length;
  const partial = input.candidates.filter(
    (item) => item.verificationStatus === "partially_verified",
  ).length;
  const requested = input.intent.requestedCompetitorCount;
  const count = input.candidates.length;

  if (requested && count < requested) {
    return `${count} relevant competitor candidate(s) identified through public web research (${verified} fully verified, ${partial} partially verified). Fewer than the requested ${requested}; additional focused discovery may be required.`;
  }
  if (requested) {
    return `${count} relevant competitor candidate(s) identified through public web research (${verified} fully verified, ${partial} partially verified). These are not ranked "top ${requested}" unless a defensible ranking method and evidence exist.`;
  }
  return `${count} relevant competitor candidate(s) identified through public web research (${verified} fully verified, ${partial} partially verified).`;
}
