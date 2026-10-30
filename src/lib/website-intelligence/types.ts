export type PageRetrievalStatus =
  | "success"
  | "blocked_robots"
  | "blocked_policy"
  | "duplicate_url"
  | "domain_page_limit"
  | "timeout"
  | "response_too_large"
  | "unsupported_content_type"
  | "too_many_redirects"
  | "redirect_blocked"
  | "rate_limited"
  | "http_error"
  | "network_error";

export type PageRetrievalRecord = {
  requestedUrl: string;
  finalUrl: string | null;
  canonicalUrl: string | null;
  status: PageRetrievalStatus;
  httpStatus: number | null;
  contentType: string | null;
  byteLength: number | null;
  redirectChain: string[];
  robotsChecked: boolean;
  robotsAllowed: boolean | null;
  retrievedAt: string;
  errorMessage: string | null;
  body: Buffer | null;
};

export type RobotsPolicyDecision = {
  allowed: boolean;
  robotsChecked: true;
  origin: string;
  reason: string;
  matchedRule: string | null;
  ruleType: "allow" | "disallow" | "policy_deny" | null;
};

export type PageEvidenceType =
  | "page_title"
  | "meta_description"
  | "og_site_name"
  | "canonical"
  | "robots_meta"
  | "html_lang"
  | "heading"
  | "internal_link"
  | "external_link"
  | "visible_text"
  | "service_mention"
  | "location_mention"
  | "value_proposition"
  | "blog_metadata"
  | "content_category";

export type ExtractionMethod =
  | "html_parser"
  | "meta_tag"
  | "link_href"
  | "heuristic_main_content"
  | "heuristic_boilerplate_removed";

export type CanonicalUrlStatus =
  | "valid_same_origin"
  | "valid_cross_origin"
  | "invalid_unsafe"
  | "missing";

export type PageEvidenceRecord = {
  id: string;
  requestedPageUrl: string;
  finalPageUrl: string;
  canonicalUrl: string | null;
  canonicalUrlStatus: CanonicalUrlStatus | null;
  evidenceType: PageEvidenceType;
  extractionMethod: ExtractionMethod;
  value: string;
  context: string | null;
  retrievalStatus: PageRetrievalStatus;
};

export type ExtractedPage = {
  requestedUrl: string;
  finalPageUrl: string;
  canonicalUrl: string | null;
  canonicalUrlStatus: CanonicalUrlStatus;
  canonicalUrlNote: string | null;
  retrievalStatus: PageRetrievalStatus;
  evidence: PageEvidenceRecord[];
  limitations: string[];
  boilerplateNotes: string[];
  /** Full document text before boilerplate removal (for audit). */
  rawVisibleText: string;
  /** Text after boilerplate heuristics (also emitted as visible_text evidence). */
  mainVisibleText: string;
};

/** Observation state for fair cross-competitor comparison (Phase 11.E). */
export type ComparisonObservationState =
  | "observed"
  | "not_observed_in_crawled_pages"
  | "insufficient_evidence"
  | "crawl_unavailable";

export type WebsiteComparisonDimension =
  | "documented_services"
  | "business_positioning"
  | "value_propositions"
  | "target_customer_indicators"
  | "landing_page_themes"
  | "blog_educational_content"
  | "geographic_targeting"
  | "page_structure"
  | "internal_link_hubs";

/**
 * Structured output for multi-profile website comparison.
 * Designed to attach to {@link SeoResearchReport} in a later phase without merging provenance.
 */
export type WebsiteIntelligenceComparisonReport = {
  comparedDomains: string[];
  comparisonLimitations: string[];
  observations: WebsiteComparisonObservation[];
  opportunities: WebsiteComparisonOpportunity[];
  summary: string;
};

export type WebsiteComparisonObservation = {
  domain: string;
  displayName: string;
  dimension: WebsiteComparisonDimension;
  state: ComparisonObservationState;
  observedValues: string[];
  evidenceIds: string[];
  sourcePageUrls: string[];
  crawlCoverageSummary: string;
  confidence: "high" | "medium" | "low";
  limitations: string[];
};

export type WebsiteComparisonOpportunity = {
  opportunityId: string;
  dimension: WebsiteComparisonDimension;
  hypothesis: string;
  isHypothesis: true;
  hypothesisDisclaimer: string;
  supportingObservationRefs: string[];
  evidenceIds: string[];
  sourcePageUrls: string[];
  rationale: string;
  evidenceGap: string;
  confidence: "high" | "medium" | "low";
  relatedDomains: string[];
};

export type WebsiteIntelligencePipelineStatus =
  | "completed"
  | "completed_with_limitations"
  | "no_eligible_candidates"
  | "insufficient_profiles"
  | "failed";
