import type { PendingToolExecution } from "@/lib/agents/types";
import type { Evidence } from "@/lib/data/types";
import type { ToolExecutionResult, WebResearchToolOutput } from "@/lib/tools/types";

import type {
  DecisionConfidenceLevel,
  DecisionSynthesisResult,
  InvestigationDecision,
  SynthesizedRecommendedAction,
} from "./decision-synthesis-types";

const MAX_SUMMARY_LENGTH = 1200;
const MAX_REASONING_ITEMS = 6;
const MAX_LIMITATIONS = 6;
const MAX_ACTIONS = 5;
const MAX_ACTION_FIELD_LENGTH = 500;

const CONFIDENCE_LEVELS = new Set<DecisionConfidenceLevel>([
  "high",
  "medium",
  "low",
]);

const UNSUPPORTED_CERTAINTY =
  /\b(proven root cause|definitely caused|confirmed without doubt|guaranteed to)\b/i;

export type SynthesisModelInput = {
  question: string;
  toolExecutions: ToolExecutionResult[];
  evidence: Evidence[];
  pendingTools: PendingToolExecution[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseConfidence(value: unknown): DecisionConfidenceLevel | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase() as DecisionConfidenceLevel;
  return CONFIDENCE_LEVELS.has(normalized) ? normalized : null;
}

function extractSeoResearchReports(
  toolExecutions: ToolExecutionResult[],
): WebResearchToolOutput["seoResearchReport"][] {
  const reports: NonNullable<WebResearchToolOutput["seoResearchReport"]>[] = [];
  for (const execution of toolExecutions) {
    if (execution.status !== "completed" || execution.toolName !== "web_research") {
      continue;
    }
    const output = execution.output as WebResearchToolOutput | undefined;
    if (output?.seoResearchReport) {
      reports.push(output.seoResearchReport);
    }
  }
  return reports;
}

export function buildSynthesisModelPayload(input: SynthesisModelInput): string {
  const completedTools = input.toolExecutions.filter(
    (execution) => execution.status === "completed",
  );
  const failedTools = input.toolExecutions.filter(
    (execution) => execution.status === "failed",
  );
  const pendingExecutions = input.toolExecutions.filter(
    (execution) => execution.status === "pending",
  );

  return JSON.stringify(
    {
      question: input.question,
      completedToolExecutions: completedTools.map((execution) => ({
        toolName: execution.toolName,
        status: execution.status,
        stepId: execution.stepId,
      })),
      failedToolExecutions: failedTools.map((execution) => ({
        toolName: execution.toolName,
        status: execution.status,
        error: execution.error ?? null,
      })),
      pendingToolExecutions: pendingExecutions.map((execution) => ({
        toolName: execution.toolName,
        status: execution.status,
      })),
      pendingTools: input.pendingTools.map((item) => ({
        toolName: item.toolName,
        description: item.description,
        reason: item.reason,
      })),
      evidence: input.evidence.map((item) => ({
        id: item.id,
        source: item.source,
        toolName: item.toolName,
        claim: item.claim,
        value: item.value ?? null,
      })),
      seoResearchReports: extractSeoResearchReports(input.toolExecutions),
    },
    null,
    2,
  );
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // continue
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1].trim()) as unknown;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }

  throw new Error("Model did not return JSON decision synthesis.");
}

function parseDecision(value: unknown): InvestigationDecision | null {
  if (!isRecord(value)) {
    return null;
  }

  const summary =
    typeof value.summary === "string" ? value.summary.trim() : "";
  if (!summary) {
    return null;
  }

  const confidence = parseConfidence(value.confidence);
  if (!confidence) {
    return null;
  }

  return {
    summary,
    reasoning: parseStringArray(value.reasoning, MAX_REASONING_ITEMS),
    confidence,
    limitations: parseStringArray(value.limitations, MAX_LIMITATIONS),
  };
}

function parseRecommendedActions(
  value: unknown,
): SynthesizedRecommendedAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const actions: SynthesizedRecommendedAction[] = [];

  for (const entry of value.slice(0, MAX_ACTIONS)) {
    if (!isRecord(entry)) {
      continue;
    }

    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const description =
      typeof entry.description === "string" ? entry.description.trim() : "";
    const basis = typeof entry.basis === "string" ? entry.basis.trim() : "";
    const priority = parseConfidence(entry.priority);

    if (!title || !description || !basis || !priority) {
      continue;
    }

    actions.push({ title, description, priority, basis });
  }

  return actions;
}

export function parseDecisionSynthesisResult(
  raw: unknown,
): DecisionSynthesisResult | null {
  if (!isRecord(raw)) {
    return null;
  }

  const decision = parseDecision(raw.decision);
  if (!decision) {
    return null;
  }

  return {
    decision,
    recommendedActions: parseRecommendedActions(raw.recommendedActions),
  };
}

export function validateDecisionSynthesis(
  result: DecisionSynthesisResult,
  evidence: Evidence[],
): string | null {
  const { decision, recommendedActions } = result;

  if (decision.summary.length > MAX_SUMMARY_LENGTH) {
    return "Decision summary exceeded the allowed length.";
  }

  if (UNSUPPORTED_CERTAINTY.test(decision.summary)) {
    return "Decision synthesis used unsupported certainty language.";
  }

  for (const line of [...decision.reasoning, ...decision.limitations]) {
    if (UNSUPPORTED_CERTAINTY.test(line)) {
      return "Decision synthesis used unsupported certainty language.";
    }
  }

  for (const action of recommendedActions) {
    if (
      action.title.length > MAX_ACTION_FIELD_LENGTH ||
      action.description.length > MAX_ACTION_FIELD_LENGTH ||
      action.basis.length > MAX_ACTION_FIELD_LENGTH
    ) {
      return "Recommended action text exceeded the allowed length.";
    }
    if (UNSUPPORTED_CERTAINTY.test(action.description)) {
      return "Recommended action used unsupported certainty language.";
    }
  }

  const evidenceIds = new Set(evidence.map((item) => item.id));
  for (const action of recommendedActions) {
    const idMatches = action.basis.match(/\bevidence id[:\s]+([a-z0-9-]+)/gi);
    if (!idMatches) {
      continue;
    }
    for (const match of idMatches) {
      const id = match.split(/[:\s]+/i).pop()?.trim();
      if (id && !evidenceIds.has(id)) {
        return "Recommended action referenced an unknown evidence id.";
      }
    }
  }

  return null;
}

export function createInsufficientEvidenceDecision(
  question: string,
  pendingTools: PendingToolExecution[],
): DecisionSynthesisResult {
  const limitations = [
    "No deterministic evidence was collected from executed tools.",
  ];

  if (pendingTools.length > 0) {
    limitations.push(
      `${pendingTools.length} planned tool(s) remain pending and may be required to answer the question reliably.`,
    );
  }

  return {
    decision: {
      summary:
        "NEXUS cannot provide a reliable business decision yet because the investigation did not produce usable evidence.",
      reasoning: [
        `The question "${question.trim()}" requires measured tool output before NEXUS can ground an answer.`,
        "Review pending tools or provide explicit inputs (for example a CSV attachment or calculator expression) and investigate again.",
      ],
      confidence: "low",
      limitations,
    },
    recommendedActions: [],
  };
}

export function hasUsableInvestigationEvidence(evidence: Evidence[]): boolean {
  return evidence.length > 0;
}
