import type { Evidence } from "@/lib/data/types";
import {
  looksLikeSeoResearchQuery,
  runBoundedSeoResearch,
} from "@/lib/research/seo-research-core";
import type { ScoredSeoFinding } from "@/lib/research/seo-relevance-engine";
import { runWebResearchSearch } from "@/lib/research/web-research-core";
import type {
  ToolContext,
  ToolInput,
  ToolOutput,
  WebResearchToolOutput,
} from "@/lib/tools/types";

export class WebResearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebResearchError";
  }
}

function getResearchQuery(input: ToolInput): string {
  const query = input.query;
  if (typeof query !== "string" || !query.trim()) {
    throw new WebResearchError(
      "Web research requires toolInput.query with a non-empty search query.",
    );
  }
  return query.trim();
}

function shouldRunSeoResearchMode(input: ToolInput, query: string): boolean {
  if (input.seoResearch === true) {
    return true;
  }
  return looksLikeSeoResearchQuery(query);
}

function scoredFindingsToEvidence(findings: ScoredSeoFinding[]): Evidence[] {
  return findings.map((finding) => ({
    id: crypto.randomUUID(),
    source: finding.url,
    claim: `[${finding.classification}] ${finding.title}: ${finding.snippet || "No excerpt returned."}`,
    toolName: "web_research",
  }));
}

function plainFindingsToEvidence(
  findings: Array<{ title: string; url: string; snippet: string }>,
): Evidence[] {
  return findings.map((finding) => ({
    id: crypto.randomUUID(),
    source: finding.url,
    claim: `${finding.title}: ${finding.snippet || "No excerpt returned."}`,
    toolName: "web_research",
  }));
}

export async function executeWebResearchCore(
  input: ToolInput,
  context: ToolContext,
): Promise<ToolOutput> {
  const query = getResearchQuery(input);
  const fetchOptions = {
    apiKey: context.webResearch?.apiKey,
    fetchImpl: context.webResearch?.fetchImpl,
  };

  if (shouldRunSeoResearchMode(input, query)) {
    const seo = await runBoundedSeoResearch(query, fetchOptions);
    const investigationEvidence = scoredFindingsToEvidence(
      seo.scoredFindings.filter((item) => !item.excludedFromCompetitorEvidence),
    );

    const output: WebResearchToolOutput = {
      query: seo.primaryQuery,
      findingCount: seo.findings.length,
      findings: seo.scoredFindings.map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        score: item.score,
        query: item.query,
        classification: item.classification,
        relevanceScore: item.relevanceScore,
      })),
      investigationEvidence,
      evidenceCount: investigationEvidence.length,
      seoResearch: true,
      queriesExecuted: seo.queriesExecuted,
      limitations: seo.limitations,
      seoResearchReport: seo.seoResearchReport,
      failedQueries: seo.failedQueries,
      emptyQueries: seo.emptyQueries,
    };

    return output;
  }

  const result = await runWebResearchSearch(query, fetchOptions);
  const investigationEvidence = plainFindingsToEvidence(result.findings);

  const output: WebResearchToolOutput = {
    query: result.query,
    findingCount: result.findings.length,
    findings: result.findings,
    investigationEvidence,
    evidenceCount: investigationEvidence.length,
    seoResearch: false,
    limitations: [
      "Web findings are third-party sources and must be verified independently.",
    ],
  };

  return output;
}
