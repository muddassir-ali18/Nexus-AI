import type { PendingToolExecution } from "@/lib/agents/types";
import type { Evidence } from "@/lib/data/types";
import type { ToolExecutionResult } from "@/lib/tools/types";

export function shouldOfferInvestigationRetry(input: {
  pendingTools: PendingToolExecution[];
  hasCsvAttachment: boolean;
  lastQuestion: string | null;
}): boolean {
  if (!input.lastQuestion?.trim() || !input.hasCsvAttachment) {
    return false;
  }

  return input.pendingTools.some(
    (item) => item.toolName === "data_analysis",
  );
}

export function groupInvestigationEvidence(evidence: Evidence[]): {
  deterministic: Evidence[];
  other: Evidence[];
} {
  const deterministicToolNames = new Set([
    "calculator",
    "data_analysis",
    "customer_analysis",
    "financial_analysis",
  ]);
  const deterministic = evidence.filter((item) =>
    deterministicToolNames.has(item.toolName),
  );
  const other = evidence.filter(
    (item) => !deterministicToolNames.has(item.toolName),
  );

  return { deterministic, other };
}

export function formatToolExecutionLabel(
  execution: ToolExecutionResult,
): string {
  if (execution.input?.sharedExecutionStepId) {
    return `${execution.toolName} (shared execution)`;
  }
  if (execution.toolName === "data_analysis") {
    return "data_analysis (sales CSV)";
  }
  if (execution.toolName === "customer_analysis") {
    return "customer_analysis (CSV customers)";
  }
  if (execution.toolName === "financial_analysis") {
    return "financial_analysis (CSV financials)";
  }
  if (execution.toolName === "web_research") {
    return "web_research (external sources)";
  }
  return execution.toolName;
}

export function listVisibleToolExecutions(
  toolExecutions: ToolExecutionResult[],
): ToolExecutionResult[] {
  return toolExecutions.filter((execution) =>
    ["completed", "failed", "pending"].includes(execution.status),
  );
}

export function isEvidenceSourceUrl(source: string): boolean {
  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
