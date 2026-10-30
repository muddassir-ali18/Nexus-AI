import type { InvestigationPlan, PendingToolExecution } from "@/lib/agents/types";
import { dedupeInvestigationEvidence } from "@/lib/data/evidence-dedupe";
import type { Evidence } from "@/lib/data/types";
import { executeTool } from "@/lib/tools/executor-core";
import { isRegisteredToolName } from "@/lib/tools/registry-core";
import type {
  CalculatorToolOutput,
  CsvAttachment,
  RegisteredToolName,
  ToolContext,
  ToolExecutionResult,
} from "@/lib/tools/types";

export type InvestigationToolAttachments = {
  csv?: CsvAttachment;
};

type SharedToolExecution = {
  primaryExecutionId: string;
  execution: ToolExecutionResult;
};

const CSV_ATTACHMENT_TOOLS = new Set<RegisteredToolName>([
  "data_analysis",
  "customer_analysis",
  "financial_analysis",
]);

function getCalculatorExpression(
  step: InvestigationPlan["steps"][number],
): string | null {
  const expression = step.toolInput?.expression;
  if (typeof expression !== "string") {
    return null;
  }

  const trimmed = expression.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getWebResearchQuery(
  step: InvestigationPlan["steps"][number],
): string | null {
  const query = step.toolInput?.query;
  if (typeof query !== "string") {
    return null;
  }
  const trimmed = query.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildToolContext(
  questionId: string,
  stepId: string,
  attachments?: InvestigationToolAttachments,
): ToolContext {
  return {
    questionId,
    stepId,
    attachments: attachments?.csv ? { csv: attachments.csv } : undefined,
  };
}

function evidenceFromCalculatorExecution(
  execution: ToolExecutionResult,
): Evidence | null {
  if (execution.status !== "completed" || !execution.output) {
    return null;
  }

  const output = execution.output as CalculatorToolOutput;
  if (
    typeof output.value !== "number" ||
    typeof output.expression !== "string" ||
    typeof output.explanation !== "string"
  ) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    source: "Calculator",
    claim: output.explanation,
    value: output.value,
    toolName: "calculator",
  };
}

function evidenceFromInvestigationToolOutput(
  execution: ToolExecutionResult,
): Evidence[] {
  if (execution.status !== "completed" || !execution.output) {
    return [];
  }

  const output = execution.output as { investigationEvidence?: Evidence[] };
  if (!Array.isArray(output.investigationEvidence)) {
    return [];
  }

  return output.investigationEvidence.filter(
    (item): item is Evidence =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.claim === "string" &&
      typeof item.source === "string" &&
      typeof item.toolName === "string",
  );
}

function createSharedExecutionRecord(
  stepId: string,
  toolName: RegisteredToolName,
  shared: SharedToolExecution,
): ToolExecutionResult {
  return {
    id: crypto.randomUUID(),
    stepId,
    toolName,
    status: shared.execution.status,
    durationMs: 0,
    input: {
      sharedExecutionStepId: shared.primaryExecutionId,
    },
    output: shared.execution.output,
    error: shared.execution.error,
  };
}

export async function executeInvestigationTools(
  plan: InvestigationPlan,
  questionId: string,
  attachments?: InvestigationToolAttachments,
): Promise<{
  toolExecutions: ToolExecutionResult[];
  evidence: Evidence[];
  pendingTools: PendingToolExecution[];
}> {
  const toolExecutions: ToolExecutionResult[] = [];
  const evidence: Evidence[] = [];
  const pendingTools: PendingToolExecution[] = [];
  const sharedExecutions = new Map<RegisteredToolName, SharedToolExecution>();

  for (const step of plan.steps) {
    const toolName = step.toolName?.trim();

    if (!toolName) {
      continue;
    }

    if (!isRegisteredToolName(toolName)) {
      pendingTools.push({
        stepId: step.id,
        toolName,
        description: step.description,
        reason: `${toolName} is not available for execution yet.`,
      });
      continue;
    }

    if (toolName === "calculator") {
      const expression = getCalculatorExpression(step);

      if (!expression) {
        toolExecutions.push({
          id: crypto.randomUUID(),
          stepId: step.id,
          toolName: "calculator",
          status: "pending",
        });
        pendingTools.push({
          stepId: step.id,
          toolName: "calculator",
          description: step.description,
          reason:
            "Calculator expression was not provided. Numbers must be explicit in the question or step input.",
        });
        continue;
      }

      const execution = await executeTool(
        "calculator",
        { expression },
        buildToolContext(questionId, step.id, attachments),
      );
      toolExecutions.push(execution);

      const calculatorEvidence = evidenceFromCalculatorExecution(execution);
      if (calculatorEvidence) {
        evidence.push(calculatorEvidence);
      }
      continue;
    }

    if (CSV_ATTACHMENT_TOOLS.has(toolName)) {
      const csvAttachment = attachments?.csv;

      if (!csvAttachment) {
        toolExecutions.push({
          id: crypto.randomUUID(),
          stepId: step.id,
          toolName,
          status: "pending",
        });
        pendingTools.push({
          stepId: step.id,
          toolName,
          description: step.description,
          reason:
            "Sales CSV attachment is missing. Attach a sales CSV to this investigation request to run CSV-based analysis tools.",
        });
        continue;
      }

      const shared = sharedExecutions.get(toolName);
      if (shared) {
        toolExecutions.push(
          createSharedExecutionRecord(step.id, toolName, shared),
        );
        continue;
      }

      const execution = await executeTool(
        toolName,
        {},
        buildToolContext(questionId, step.id, attachments),
      );
      toolExecutions.push(execution);

      if (execution.status === "completed" || execution.status === "failed") {
        sharedExecutions.set(toolName, {
          primaryExecutionId: execution.id,
          execution,
        });
      }

      if (execution.status === "completed") {
        evidence.push(...evidenceFromInvestigationToolOutput(execution));
      }
      continue;
    }

    if (toolName === "web_research") {
      const query = getWebResearchQuery(step);
      if (!query) {
        toolExecutions.push({
          id: crypto.randomUUID(),
          stepId: step.id,
          toolName: "web_research",
          status: "pending",
        });
        pendingTools.push({
          stepId: step.id,
          toolName: "web_research",
          description: step.description,
          reason:
            "Web research requires toolInput.query with a non-empty search query.",
        });
        continue;
      }

      const execution = await executeTool(
        "web_research",
        { query },
        buildToolContext(questionId, step.id, attachments),
      );
      toolExecutions.push(execution);

      if (execution.status === "completed") {
        evidence.push(...evidenceFromInvestigationToolOutput(execution));
      }
      continue;
    }
  }

  return {
    toolExecutions,
    evidence: dedupeInvestigationEvidence(evidence),
    pendingTools,
  };
}
