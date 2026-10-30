import "server-only";

import { assertNebiusConfigured, createNebiusClient } from "@/lib/ai/nebius";
import {
  buildPlannerSystemPrompt,
  buildPlannerUserContent,
  type PlannerRequestContext,
} from "@/lib/agents/planner-prompts";
import type {
  BusinessQuestion,
  InvestigationPlan,
  InvestigationStep,
} from "@/lib/agents/types";
import { NexusParseError } from "@/lib/utils/errors";

export type { PlannerRequestContext };
export {
  buildPlannerSystemPrompt,
  buildPlannerUserContent,
} from "@/lib/agents/planner-prompts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeToolName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "calculator" || normalized === "calculations") {
    return "calculator";
  }

  if (
    normalized === "data_analysis" ||
    normalized === "business data analysis" ||
    normalized === "data analysis"
  ) {
    return "data_analysis";
  }

  if (normalized === "web_research" || normalized === "web research") {
    return "web_research";
  }

  if (normalized === "customer_analysis" || normalized === "customer analysis") {
    return "customer_analysis";
  }

  if (
    normalized === "financial_analysis" ||
    normalized === "financial analysis"
  ) {
    return "financial_analysis";
  }

  return value.trim();
}

function parseToolInput(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return value;
}

function parseInvestigationStep(
  value: unknown,
  index: number,
): InvestigationStep {
  if (!isRecord(value)) {
    throw new NexusParseError(`Step ${index + 1} must be an object.`);
  }

  const id =
    typeof value.id === "string" && value.id.trim().length > 0
      ? value.id.trim()
      : `step-${index + 1}`;

  const description =
    typeof value.description === "string" ? value.description.trim() : "";
  if (!description) {
    throw new NexusParseError(
      `Step ${index + 1} is missing a description.`,
    );
  }

  const reason =
    typeof value.reason === "string" ? value.reason.trim() : "";
  if (!reason) {
    throw new NexusParseError(`Step ${index + 1} is missing a reason.`);
  }

  const toolName =
    normalizeToolName(value.toolName) ??
    normalizeToolName(value.tool);

  const toolInput = parseToolInput(value.toolInput);

  const tool =
    typeof value.tool === "string" && value.tool.trim().length > 0
      ? value.tool.trim()
      : toolName;

  return {
    id,
    description,
    reason,
    tool,
    toolName,
    toolInput,
  };
}

export function parseInvestigationPlan(raw: unknown): InvestigationPlan {
  if (!isRecord(raw)) {
    throw new NexusParseError("Investigation plan must be a JSON object.");
  }

  const objective =
    typeof raw.objective === "string" ? raw.objective.trim() : "";
  if (!objective) {
    throw new NexusParseError("Investigation plan objective is missing.");
  }

  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new NexusParseError(
      "Investigation plan must include at least one step.",
    );
  }

  const steps = raw.steps.map((step, index) =>
    parseInvestigationStep(step, index),
  );

  return { objective, steps };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Fall through to alternate extraction strategies.
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim()) as unknown;
    } catch {
      throw new NexusParseError("Model returned invalid JSON in a code block.");
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    } catch {
      throw new NexusParseError("Model returned malformed JSON.");
    }
  }

  throw new NexusParseError("Model did not return a JSON investigation plan.");
}

export async function createInvestigationPlan(
  question: BusinessQuestion,
  context?: PlannerRequestContext,
): Promise<InvestigationPlan> {
  assertNebiusConfigured();
  const client = createNebiusClient();
  const response = await client.chat({
    messages: [
      { role: "system", content: buildPlannerSystemPrompt(context) },
      {
        role: "user",
        content: buildPlannerUserContent(question.text, context),
      },
    ],
  });

  const parsed = extractJsonObject(response.content);
  return parseInvestigationPlan(parsed);
}
