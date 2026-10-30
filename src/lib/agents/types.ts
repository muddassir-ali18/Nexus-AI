import type {
  DecisionSynthesisResult,
} from "@/lib/agents/decision-synthesis-types";
import type {
  OrchestrationRecord,
  ProposedAction,
} from "@/lib/agents/specialists-types";
import type { Evidence } from "@/lib/data/types";
import type { ToolExecutionResult } from "@/lib/tools/types";

export const MAX_QUESTION_LENGTH = 2000;

export type BusinessQuestionId = string;
export type AgentTaskId = string;
export type AgentStepId = string;
export type AgentEvidenceId = string;

/** Input shape accepted by the investigate API. */
export type BusinessQuestionInput = {
  question: string;
};

export type BusinessQuestion = {
  id: BusinessQuestionId;
  text: string;
  askedAt: string;
  context?: string;
};

export type AgentRunStatus =
  | "idle"
  | "planning"
  | "planned"
  | "failed";

export type AgentMessageRole = "system" | "user" | "assistant";

export type AgentMessage = {
  role: AgentMessageRole;
  content: string;
};

export type InvestigationStep = {
  id: string;
  description: string;
  reason: string;
  /** Legacy planner hint retained for display compatibility. */
  tool?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
};

export type InvestigationPlan = {
  objective: string;
  steps: InvestigationStep[];
};

export type PendingToolExecution = {
  stepId: string;
  toolName: string;
  description: string;
  reason: string;
};

export type InvestigationResult = {
  question: BusinessQuestion;
  plan: InvestigationPlan;
  status: AgentRunStatus;
  toolExecutions: ToolExecutionResult[];
  evidence: Evidence[];
  pendingTools: PendingToolExecution[];
  orchestration: OrchestrationRecord;
  proposedActions: ProposedAction[];
  decisionSynthesis: DecisionSynthesisResult | null;
  decisionError: string | null;
};

export type AgentStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type AgentStepKind =
  | "plan"
  | "select_tools"
  | "execute_tool"
  | "collect_evidence"
  | "synthesize"
  | "simulate";

export type AgentStep = {
  id: AgentStepId;
  taskId: AgentTaskId;
  kind: AgentStepKind;
  title: string;
  status: AgentStepStatus;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type AgentTaskStatus = "draft" | "planned" | "running" | "completed" | "failed";

export type AgentTask = {
  id: AgentTaskId;
  question: BusinessQuestion;
  status: AgentTaskStatus;
  plan: AgentStep[];
  selectedTools: string[];
  createdAt: string;
  updatedAt: string;
};

export type EvidenceSourceKind =
  | "internal_data"
  | "web_research"
  | "calculation"
  | "simulation"
  | "model_reasoning";

export type AgentEvidence = {
  id: AgentEvidenceId;
  taskId: AgentTaskId;
  sourceKind: EvidenceSourceKind;
  toolName?: string;
  summary: string;
  detail?: string;
  confidence: number;
  citations?: string[];
  collectedAt: string;
};

export type RecommendedAction = {
  title: string;
  rationale: string;
  priority: "low" | "medium" | "high";
};

export type AgentDecision = {
  headline: string;
  narrative: string;
  confidence: number;
  recommendedActions: RecommendedAction[];
};

export type AgentResult = {
  task: AgentTask;
  evidence: AgentEvidence[];
  decision: AgentDecision | null;
  whatIfNotes?: string[];
};

export type InvestigateApiSuccess = {
  success: true;
  question: string;
  plan: InvestigationPlan;
  toolExecutions: ToolExecutionResult[];
  evidence: Evidence[];
  pendingTools: PendingToolExecution[];
  orchestration: OrchestrationRecord;
  proposedActions: ProposedAction[];
  decision: DecisionSynthesisResult["decision"] | null;
  recommendedActions: DecisionSynthesisResult["recommendedActions"];
  decisionError: string | null;
};

export type InvestigateApiFailure = {
  success: false;
  error: string;
};

export type InvestigateApiResponse = InvestigateApiSuccess | InvestigateApiFailure;
