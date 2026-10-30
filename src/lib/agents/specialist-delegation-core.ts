import {
  MAX_ORCHESTRATION_ITERATIONS,
  selectSpecialistForStep,
} from "@/lib/agents/specialists-core";
import type {
  CoordinationContext,
  CoordinationInput,
  OrchestrationRecord,
  OrchestrationStopReason,
  SpecialistAssignment,
  SpecialistRunRecord,
  SpecialistRunStatus,
} from "@/lib/agents/specialists-types";
import type { InvestigationPlan, PendingToolExecution } from "@/lib/agents/types";
import type { ToolExecutionResult } from "@/lib/tools/types";

function buildAssignments(
  plan: InvestigationPlan,
  context: CoordinationContext,
): SpecialistAssignment[] {
  const assignments: SpecialistAssignment[] = [];

  for (const step of plan.steps) {
    const selection = selectSpecialistForStep(step, context);
    if (!selection) {
      continue;
    }

    assignments.push({
      stepId: step.id,
      specialistId: selection.specialist.id,
      specialistName: selection.specialist.name,
      taskType: selection.taskType,
      status: selection.assignmentStatus,
      description: step.description,
      reason: step.reason,
      permittedTools: selection.specialist.permittedTools,
      requestedTool: selection.requestedTool,
      statusMessage: selection.statusMessage,
    });
  }

  return assignments;
}

function resolveRunStatus(input: {
  assignment: SpecialistAssignment;
  executions: ToolExecutionResult[];
  pendingTools: PendingToolExecution[];
}): {
  status: SpecialistRunStatus;
  pendingReason?: string;
  error?: string;
} {
  if (input.assignment.status === "unsupported") {
    return {
      status: "skipped",
      error: input.assignment.statusMessage,
    };
  }

  const pending = input.pendingTools.find(
    (item) => item.stepId === input.assignment.stepId,
  );
  if (pending) {
    return { status: "pending", pendingReason: pending.reason };
  }

  if (input.executions.length === 0) {
    if (input.assignment.status === "pending_prerequisites") {
      return {
        status: "pending",
        pendingReason: input.assignment.statusMessage,
      };
    }
    return { status: "skipped" };
  }

  if (input.executions.some((execution) => execution.status === "failed")) {
    const failed = input.executions.find(
      (execution) => execution.status === "failed",
    );
    return {
      status: "failed",
      error: failed?.error ?? "Specialist tool execution failed.",
    };
  }

  if (input.executions.some((execution) => execution.status === "pending")) {
    return {
      status: "pending",
      pendingReason:
        "Required inputs for this specialist task were not available.",
    };
  }

  if (input.executions.every((execution) => execution.status === "completed")) {
    return { status: "completed" };
  }

  return { status: "skipped" };
}

function buildSpecialistRuns(
  assignments: SpecialistAssignment[],
  toolExecutions: ToolExecutionResult[],
  pendingTools: PendingToolExecution[],
): SpecialistRunRecord[] {
  return assignments.map((assignment) => {
    const executions = toolExecutions.filter(
      (execution) => execution.stepId === assignment.stepId,
    );
    const resolved = resolveRunStatus({
      assignment,
      executions,
      pendingTools,
    });

    return {
      stepId: assignment.stepId,
      specialistId: assignment.specialistId,
      specialistName: assignment.specialistName,
      taskType: assignment.taskType,
      status: resolved.status,
      description: assignment.description,
      toolExecutions: executions,
      pendingReason: resolved.pendingReason,
      error: resolved.error,
      capabilityNote:
        assignment.specialistId === "website_seo"
          ? assignment.statusMessage
          : undefined,
    };
  });
}

function resolveStopReason(input: {
  specialistRuns: SpecialistRunRecord[];
  pendingTools: PendingToolExecution[];
  budgetExhausted: boolean;
}): OrchestrationStopReason {
  if (input.budgetExhausted) {
    return "budget_exhausted";
  }

  if (
    input.specialistRuns.some(
      (run) => run.status === "skipped" && run.specialistId === "website_seo",
    )
  ) {
    return "unsupported_tasks";
  }

  if (input.pendingTools.length > 0) {
    return "pending_tools";
  }

  if (
    input.specialistRuns.some(
      (run) => run.status === "pending" || run.status === "failed",
    )
  ) {
    return "pending_tools";
  }

  return "ready_for_synthesis";
}

export function coordinateInvestigationPass(
  input: CoordinationInput,
): OrchestrationRecord {
  const durationMs = Math.max(0, Date.now() - input.startedAtMs);
  const budgetExhausted = durationMs >= input.budgetMs;

  const assignments = buildAssignments(input.plan, input.context);
  const specialistRuns = buildSpecialistRuns(
    assignments,
    input.toolExecutions,
    input.pendingTools,
  );

  const stopReason = resolveStopReason({
    specialistRuns,
    pendingTools: input.pendingTools,
    budgetExhausted,
  });

  return {
    iteration: 1,
    maxIterations: MAX_ORCHESTRATION_ITERATIONS,
    stopReason,
    durationMs,
    assignments,
    specialistRuns,
    evidenceCount: input.evidence.length,
    replanningEnabled: false,
  };
}
