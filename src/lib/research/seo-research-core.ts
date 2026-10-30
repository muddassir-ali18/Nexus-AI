import {
  buildCompetitorCandidates,
} from "@/lib/research/seo-competitor-verification";
import {
  parseSeoResearchIntent,
  type SeoResearchIntent,
} from "@/lib/research/seo-research-intent";
import {
  buildSeoResearchReport,
  type SeoResearchReport,
} from "@/lib/research/seo-research-report";
import {
  dedupeScoredFindingsByDomain,
  scoreAndFilterSeoFindings,
  type ScoredSeoFinding,
} from "@/lib/research/seo-relevance-engine";
import type { WebResearchFinding } from "@/lib/research/web-research-core";
import { runWebResearchSearch } from "@/lib/research/web-research-core";

export const MAX_SEO_TAVILY_QUERIES = 3;
export const MAX_SEO_COMPETITOR_TAVILY_QUERIES = 5;

export function looksLikeSeoResearchQuery(query: string): boolean {
  const text = query.toLowerCase();
  return (
    /\b(seo|search engine optimization|search intent|keyword|content brief|organic growth|competitor|serp|technical seo)\b/.test(
      text,
    ) || /(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}/i.test(text)
  );
}

export function extractDomainFromText(text: string): string | null {
  const match = text.match(
    /(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i,
  );
  return match?.[1]?.toLowerCase() ?? null;
}

export function buildSeoSearchQueries(researchQuestion: string): string[] {
  return buildFocusedSeoSearchQueries(parseSeoResearchIntent(researchQuestion));
}

export function buildFocusedSeoSearchQueries(intent: SeoResearchIntent): string[] {
  const queries: string[] = [];
  const seen = new Set<string>();

  function add(query: string) {
    const normalized = query.trim().replace(/\s+/g, " ");
    if (!normalized || seen.has(normalized.toLowerCase())) {
      return;
    }
    seen.add(normalized.toLowerCase());
    queries.push(normalized);
  }

  add(intent.rawQuestion);

  const geo = intent.geography;
  const industry = intent.industry ?? "SEO agency";

  if (intent.isCompetitorResearch && geo) {
    add(`${industry} in ${geo} official website`);
    add(`${geo} SEO companies and services`);
    add(`${geo} digital marketing agencies offering SEO`);
    add(`${geo} SEO agency case studies blog content strategy`);
  }

  const domain = extractDomainFromText(intent.rawQuestion);
  if (domain) {
    add(`${domain} SEO services publicly available information`);
    add(`${domain} technical SEO recommendations site pages`);
  }

  if (/competitor/i.test(intent.rawQuestion) && !geo) {
    add(`${intent.rawQuestion} competitor content positioning public web sources`);
  }

  if (/keyword|search intent|content opportunity/i.test(intent.rawQuestion)) {
    add(`${intent.rawQuestion} search intent content opportunities SEO`);
  }

  if (/technical seo/i.test(intent.rawQuestion)) {
    add(`${intent.rawQuestion} technical SEO best practices authoritative sources`);
  }

  const maxQueries =
    intent.isCompetitorResearch && intent.isLocalMarketResearch
      ? MAX_SEO_COMPETITOR_TAVILY_QUERIES
      : MAX_SEO_TAVILY_QUERIES;

  return queries.slice(0, maxQueries);
}

export function dedupeFindingsByUrl(
  findings: WebResearchFinding[],
): WebResearchFinding[] {
  const byUrl = new Map<string, WebResearchFinding>();
  for (const finding of findings) {
    const key = finding.url.trim().toLowerCase();
    if (!key) {
      continue;
    }
    if (!byUrl.has(key)) {
      byUrl.set(key, finding);
    }
  }
  return [...byUrl.values()];
}

export type SeoResearchResult = {
  primaryQuery: string;
  queriesExecuted: string[];
  findings: WebResearchFinding[];
  scoredFindings: ScoredSeoFinding[];
  seoResearchReport: SeoResearchReport;
  limitations: string[];
  failedQueries: string[];
  emptyQueries: string[];
};

export async function runBoundedSeoResearch(
  researchQuestion: string,
  options?: Parameters<typeof runWebResearchSearch>[1],
): Promise<SeoResearchResult> {
  const intent = parseSeoResearchIntent(researchQuestion);
  const queries = buildFocusedSeoSearchQueries(intent);
  const limitations = [
    "Findings come from Tavily web search snippets, not a full website crawl.",
    "Keyword volumes, rankings, Search Console metrics, backlinks counts, and traffic estimates are not available from this research mode.",
    "Directory listings alone cannot establish detailed service claims; official websites are preferred for company descriptions.",
    "Generic SEO educational articles are excluded from competitor verification evidence.",
  ];

  const aggregated: WebResearchFinding[] = [];
  const failedQueries: string[] = [];
  const emptyQueries: string[] = [];

  for (const query of queries) {
    try {
      const result = await runWebResearchSearch(query, options);
      if (result.findings.length === 0) {
        emptyQueries.push(query);
      }
      aggregated.push(...result.findings);
    } catch {
      failedQueries.push(query);
    }
  }

  const dedupedFindings = dedupeFindingsByUrl(aggregated);
  const scoredFindings = dedupeScoredFindingsByDomain(
    scoreAndFilterSeoFindings(dedupedFindings, intent),
  );
  const competitors = buildCompetitorCandidates(scoredFindings, intent);
  const seoResearchReport = buildSeoResearchReport({
    intent,
    queriesExecuted: queries,
    failedQueries,
    emptyQueries,
    scoredFindings,
    competitors,
  });

  const evidenceFindings = scoredFindings.filter(
    (item) => !item.excludedFromCompetitorEvidence,
  );

  if (evidenceFindings.length === 0) {
    limitations.push(
      "No relevant competitor or market sources passed Phase 10 relevance filters.",
    );
  }
  if (failedQueries.length > 0) {
    limitations.push(
      `${failedQueries.length} Tavily query(ies) failed; see seoResearchReport.failedQueries for details.`,
    );
  }

  const domain = extractDomainFromText(researchQuestion);
  if (domain) {
    limitations.push(
      `Public web results about ${domain} were retrieved via search indexing signals; this is not a complete technical audit of the live site.`,
    );
  }

  return {
    primaryQuery: researchQuestion.trim(),
    queriesExecuted: queries,
    findings: evidenceFindings,
    scoredFindings,
    seoResearchReport,
    limitations,
    failedQueries,
    emptyQueries,
  };
}
