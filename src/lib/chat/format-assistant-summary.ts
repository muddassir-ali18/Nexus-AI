import type { InvestigateApiSuccess } from "@/lib/agents/types";
import type { WebResearchToolOutput } from "@/lib/tools/types";

function collectWebResearchOutputs(
  payload: InvestigateApiSuccess,
): WebResearchToolOutput[] {
  const outputs: WebResearchToolOutput[] = [];
  for (const execution of payload.toolExecutions) {
    if (execution.status !== "completed" || execution.toolName !== "web_research") {
      continue;
    }
    const output = execution.output as WebResearchToolOutput | undefined;
    if (output?.findings) {
      outputs.push(output);
    }
  }
  return outputs;
}

function appendSeoPhase10Report(
  sections: string[],
  output: WebResearchToolOutput,
): void {
  const report = output.seoResearchReport;
  if (!report) {
    return;
  }

  sections.push("");
  sections.push("### SEO competitor research report (Phase 10)");
  sections.push("");
  sections.push("#### 1. Executive summary");
  sections.push(report.executiveSummary);

  sections.push("");
  sections.push("#### 2. Research methodology and scope");
  for (const item of report.methodology) {
    sections.push(`- ${item}`);
  }
  if (output.queriesExecuted?.length) {
    sections.push("");
    sections.push("Queries executed:");
    for (const query of output.queriesExecuted) {
      sections.push(`- ${query}`);
    }
  }

  sections.push("");
  sections.push("#### 3. Competitor discovery and verification");
  sections.push(report.competitorCandidateLabel);
  for (const competitor of report.competitors) {
    sections.push("");
    sections.push(`**${competitor.name}** — ${competitor.verificationStatus.replace("_", " ")}`);
    sections.push(
      `- Official website identified: ${competitor.officialWebsiteIdentified ? "yes" : "no"}${competitor.officialWebsiteUrl ? ` (${competitor.officialWebsiteUrl})` : ""}`,
    );
    sections.push(
      `- Geographic presence explicitly supported: ${competitor.chennaiPresenceSupported ? "yes (search-indexed official/consistent signals)" : "no (TLD, brand name, or directory-only insufficient)"}`,
    );
    sections.push(
      `- Services publicly documented (official snippets): ${competitor.servicesPubliclyDocumented ? "yes" : "no"}`,
    );
    sections.push(`- Fully verified: ${competitor.fullyVerified ? "yes" : "no"}`);
    if (competitor.websiteUrl) {
      sections.push(`- Website: ${competitor.websiteUrl}`);
    }
    for (const note of competitor.evidenceLimitations.slice(0, 3)) {
      sections.push(`- Evidence limit: ${note}`);
    }
    for (const url of competitor.sourceUrls) {
      sections.push(`- Source: ${url}`);
    }
    if (competitor.statedServices.length > 0) {
      sections.push(`- Publicly stated services (snippet-level): ${competitor.statedServices.join(", ")}`);
    }
    if (competitor.chennaiPresenceEvidence.length > 0) {
      for (const note of competitor.chennaiPresenceEvidence) {
        sections.push(`- ${note}`);
      }
    }
    if (competitor.missingInformation.length > 0) {
      sections.push("- Missing information:");
      for (const note of competitor.missingInformation) {
        sections.push(`  - ${note}`);
      }
    }
  }

  if (report.competitors.length > 1) {
    sections.push("");
    sections.push("#### 4. Competitor comparison matrix (public snippet signals only)");
    sections.push("| Candidate | Verification | Services (snippet) | Sources |");
    sections.push("| --- | --- | --- | --- |");
    for (const competitor of report.competitors) {
      sections.push(
        `| ${competitor.name} | ${competitor.verificationStatus} | ${competitor.statedServices.join(", ") || "—"} | ${competitor.sourceUrls.length} |`,
      );
    }
  }

  sections.push("");
  sections.push("#### 5–7. Services, positioning, and content themes");
  for (const competitor of report.competitors) {
    if (competitor.positioningNotes.length > 0 || competitor.contentThemes.length > 0) {
      sections.push(`- **${competitor.name}**`);
      for (const note of competitor.positioningNotes) {
        sections.push(`  - Positioning (snippet): ${note}`);
      }
      for (const theme of competitor.contentThemes) {
        sections.push(`  - ${theme}`);
      }
    }
  }

  sections.push("");
  sections.push("#### 8. Differentiation and content opportunities");
  for (const item of report.potentialOpportunities) {
    sections.push(`- ${item}`);
  }

  sections.push("");
  sections.push("#### 9. Confidence and evidence gaps");
  sections.push(
    `- Verified: ${report.verifiedCount}; partially verified: ${report.partiallyVerifiedCount}; unverified: ${report.unverifiedCount}; filtered irrelevant/educational: ${report.filteredIrrelevantCount}`,
  );
  for (const item of report.verifiedFindings) {
    sections.push(`- Verified finding: ${item}`);
  }
  for (const item of report.reasonableInferences) {
    sections.push(`- Reasonable inference: ${item}`);
  }
  for (const item of report.unverifiedClaims) {
    sections.push(`- Unverified: ${item}`);
  }
  for (const gap of report.evidenceGaps) {
    sections.push(`- Gap: ${gap}`);
  }
  if (report.failedQueries.length > 0) {
    sections.push("- Failed Tavily queries:");
    for (const query of report.failedQueries) {
      sections.push(`  - ${query}`);
    }
  }

  sections.push("");
  sections.push("#### 10. Technical SEO audit requirements (not performed)");
  for (const item of report.technicalAuditRequirements) {
    sections.push(`- ${item}`);
  }

  sections.push("");
  sections.push("#### Source references");
  for (const source of report.sourceReferences) {
    sections.push(`- [${source.title}](${source.url}) (${source.classification})`);
  }
}

export function buildAssistantSummaryMarkdown(
  payload: InvestigateApiSuccess,
): string {
  const sections: string[] = [];
  const webOutputs = collectWebResearchOutputs(payload);
  const seoOutputs = webOutputs.filter((item) => item.seoResearch);

  sections.push("## Investigation summary");
  sections.push(payload.question);

  const primarySeo = seoOutputs.find((item) => item.seoResearchReport) ?? seoOutputs[0];
  if (primarySeo?.seoResearchReport) {
    sections.push("");
    sections.push("### Decision context");
    sections.push(primarySeo.seoResearchReport.executiveSummary);
  } else if (payload.decision?.summary) {
    sections.push("");
    sections.push("### Decision");
    sections.push(payload.decision.summary);
    sections.push(`Confidence: **${payload.decision.confidence}**`);
  } else if (payload.decisionError) {
    sections.push("");
    sections.push("### Decision synthesis");
    sections.push(payload.decisionError);
  }

  for (const output of seoOutputs) {
    appendSeoPhase10Report(sections, output);
  }

  if (payload.evidence.length > 0) {
    sections.push("");
    sections.push(seoOutputs.length > 0 ? "### Supporting investigation evidence" : "### Key evidence");
    for (const item of payload.evidence.slice(0, 10)) {
      const prefix =
        item.toolName === "web_research" && item.source.startsWith("http")
          ? `- [${item.claim.slice(0, 120)}](${item.source})`
          : `- ${item.claim}`;
      sections.push(prefix);
    }
  }

  const failedWeb = payload.toolExecutions.filter(
    (execution) =>
      execution.toolName === "web_research" && execution.status === "failed",
  );
  if (failedWeb.length > 0) {
    sections.push("");
    sections.push("### Web research status");
    for (const execution of failedWeb) {
      sections.push(
        `- Research did not complete: ${execution.error ?? "Unknown error"}`,
      );
    }
  }

  if (payload.decision?.summary && primarySeo?.seoResearchReport) {
    sections.push("");
    sections.push("### Nemotron decision synthesis");
    sections.push(payload.decision.summary);
    sections.push(`Confidence: **${payload.decision.confidence}**`);
  }

  if (payload.recommendedActions.length > 0) {
    sections.push("");
    sections.push("### Recommended next steps");
    for (const action of payload.recommendedActions.slice(0, 5)) {
      sections.push(`- **${action.title}** — ${action.description}`);
    }
  }

  return sections.join("\n");
}
