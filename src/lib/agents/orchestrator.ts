import "server-only";

import {
  executeInvestigationTools,
  type InvestigationToolAttachments,
} from "@/lib/agents/execute-investigation-tools";
import { synthesizeInvestigationDecision } from "@/lib/agents/decision-synthesis";
import { createInvestigationPlan } from "@/lib/agents/planner";
import {
  buildProposedActionsFromRecommendations,
  enforceApprovalBoundary,
} from "@/lib/agents/proposed-actions-core";
import { coordinateInvestigationPass } from "@/lib/agents/specialist-delegation-core";
import { DEFAULT_ORCHESTRATION_BUDGET_MS } from "@/lib/agents/specialists-core";
import { isWebResearchConfigured } from "@/lib/research/web-research-core";
import type {
  AgentEvidence,
  AgentResult,
  AgentTask,
  BusinessQuestion,
  InvestigationResult,
} from "@/lib/agents/types";
import { validateBusinessQuestionText } from "@/lib/agents/question-validation";
import {
  NexusNotImplementedError,
} from "@/lib/utils/errors";

export type { InvestigationToolAttachments };
export { executeInvestigationTools };
export { validateBusinessQuestionText } from "@/lib/agents/question-validation";

function createBusinessQuestion(text: string): BusinessQuestion {
  return {
    id: crypto.randomUUID(),
    text,
    askedAt: new Date().toISOString(),
  };
}

/**
 * Agent Core v0.2 — plan plus deterministic tool execution.
 */
export async function investigateQuestion(
  questionInput: unknown,
  attachments?: InvestigationToolAttachments,
): Promise<InvestigationResult> {
  const startedAtMs = Date.now();
  const text = validateBusinessQuestionText(questionInput);
  const question = createBusinessQuestion(text);
  const webResearchConfigured = isWebResearchConfigured();
  const plannerContext = {
    csvFileName: attachments?.csv?.fileName,
    webResearchConfigured,
  };
  const plan = await createInvestigationPlan(question, plannerContext);
  const { toolExecutions, evidence, pendingTools } =
    await executeInvestigationTools(plan, question.id, attachments);

  const orchestration = coordinateInvestigationPass({
    plan,
    toolExecutions,
    evidence,
    pendingTools,
    context: {
      csvAttached: Boolean(attachments?.csv),
      webResearchConfigured,
    },
    startedAtMs,
    budgetMs: DEFAULT_ORCHESTRATION_BUDGET_MS,
  });

  const decisionOutcome = await synthesizeInvestigationDecision({
    question: question.text,
    toolExecutions,
    evidence,
    pendingTools,
  });

  const proposedActions = enforceApprovalBoundary(
    buildProposedActionsFromRecommendations(
      decisionOutcome.synthesis?.recommendedActions ?? [],
      evidence,
    ),
  );

  return {
    question,
    plan,
    status: "planned",
    toolExecutions,
    evidence,
    pendingTools,
    orchestration,
    proposedActions,
    decisionSynthesis: decisionOutcome.synthesis,
    decisionError: decisionOutcome.error,
  };
}

export async function receiveQuestion(
  question: BusinessQuestion,
): Promise<AgentTask> {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    question,
    status: "draft",
    plan: [],
    selectedTools: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function planInvestigation(task: AgentTask): Promise<AgentTask> {
  const investigationPlan = await createInvestigationPlan(task.question);
  const now = new Date().toISOString();

  return {
    ...task,
    plan: investigationPlan.steps.map((step, index) => ({
      id: step.id,
      taskId: task.id,
      kind: "execute_tool" as const,
      title: step.description,
      status: "pending" as const,
      toolName: step.toolName,
      input: {
        reason: step.reason,
        tool: step.tool,
        toolInput: step.toolInput,
        order: index + 1,
      },
    })),
    selectedTools: investigationPlan.steps
      .map((step) => step.toolName)
      .filter((toolName): toolName is string => Boolean(toolName)),
    status: "planned",
    updatedAt: now,
  };
}

export async function executeTools(
  _task: AgentTask,
  _tools: string[],
): Promise<AgentEvidence[]> {
  void _task;
  void _tools;
  throw new NexusNotImplementedError("Legacy tool execution");
}

export async function collectEvidence(
  _task: AgentTask,
): Promise<AgentEvidence[]> {
  void _task;
  throw new NexusNotImplementedError("Evidence collection");
}

export async function synthesizeDecision(
  _task: AgentTask,
  _evidence: AgentEvidence[],
): Promise<AgentResult> {
  void _task;
  void _evidence;
  throw new NexusNotImplementedError("Decision synthesis");
}

export async function runInvestigation(
  question: BusinessQuestion,
): Promise<AgentResult> {
  const task = await receiveQuestion(question);
  await planInvestigation(task);
  throw new NexusNotImplementedError("Autonomous investigation");
}
