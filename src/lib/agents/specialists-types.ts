import type { PendingToolExecution } from "@/lib/agents/types";
import type { Evidence } from "@/lib/data/types";
import type { RegisteredToolName, ToolExecutionResult } from "@/lib/tools/types";

export type SpecialistId =
  | "research"
  | "data_finance"
  | "customer"
  | "website_seo";

export type SpecialistTaskType =
  | "external_research"
  | "csv_business_metrics"
  | "financial_analysis"
  | "customer_segmentation"
  | "deterministic_arithmetic"
  | "website_seo_audit"
  | "seo_web_research";

export type SpecialistAssignmentStatus =
  | "assigned"
  | "pending_prerequisites"
  | "unsupported";

export type SpecialistRunStatus =
  | "completed"
  | "failed"
  | "pending"
  | "skipped";

export type SpecialistDefinition = {
  id: SpecialistId;
  name: string;
  responsibility: string;
  supportedTaskTypes: SpecialistTaskType[];
  permittedTools: RegisteredToolName[];
  capabilityNote?: string;
};

export type SpecialistAssignment = {
  stepId: string;
  specialistId: SpecialistId;
  specialistName: string;
  taskType: SpecialistTaskType;
  status: SpecialistAssignmentStatus;
  description: string;
  reason: string;
  permittedTools: RegisteredToolName[];
  requestedTool?: string;
  statusMessage?: string;
};

export type SpecialistRunRecord = {
  stepId: string;
  specialistId: SpecialistId;
  specialistName: string;
  taskType: SpecialistTaskType;
  status: SpecialistRunStatus;
  description: string;
  toolExecutions: ToolExecutionResult[];
  pendingReason?: string;
  error?: string;
  capabilityNote?: string;
};

export type OrchestrationStopReason =
  | "ready_for_synthesis"
  | "pending_tools"
  | "unsupported_tasks"
  | "budget_exhausted";

export type OrchestrationRecord = {
  iteration: number;
  maxIterations: number;
  stopReason: OrchestrationStopReason;
  durationMs: number;
  assignments: SpecialistAssignment[];
  specialistRuns: SpecialistRunRecord[];
  evidenceCount: number;
  replanningEnabled: boolean;
};

export type ProposedActionStatus =
  | "proposed"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "completed";

export type ProposedActionImpactLevel = "low" | "medium" | "high";

export type ProposedAction = {
  id: string;
  title: string;
  description: string;
  rationale: string;
  evidenceIds: string[];
  impactLevel: ProposedActionImpactLevel;
  requiresExternalExecution: boolean;
  status: ProposedActionStatus;
};

export type CoordinationContext = {
  csvAttached: boolean;
  webResearchConfigured: boolean;
};

export type CoordinationInput = {
  plan: import("@/lib/agents/types").InvestigationPlan;
  toolExecutions: ToolExecutionResult[];
  evidence: Evidence[];
  pendingTools: PendingToolExecution[];
  context: CoordinationContext;
  startedAtMs: number;
  budgetMs: number;
};
