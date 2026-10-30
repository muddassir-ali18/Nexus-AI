import type { Evidence } from "@/lib/data/types";
import type { SeoResearchReport } from "@/lib/research/seo-research-report";

export type AgentToolName =
  | "planner"
  | "data_analysis"
  | "web_research"
  | "calculator"
  | "evidence_collector"
  | "decision_synthesizer"
  | "what_if_simulation";

/** Tools registered for deterministic execution in v0.2+. */
export type RegisteredToolName =
  | "calculator"
  | "data_analysis"
  | "web_research"
  | "customer_analysis"
  | "financial_analysis";

export type CsvAttachment = {
  fileName: string;
  buffer: ArrayBuffer;
};

export type ToolContext = {
  questionId?: string;
  stepId?: string;
  attachments?: {
    csv?: CsvAttachment;
  };
  /** Server/test-only overrides for web_research (never set from browser requests). */
  webResearch?: {
    apiKey?: string | null;
    fetchImpl?: (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Promise<Response>;
  };
};

export type ToolInput = Record<string, unknown>;

export type ToolOutput = Record<string, unknown>;

export type ToolInputFieldSchema = {
  type: "string" | "number";
  description: string;
};

export type ToolInputSchema = {
  required: string[];
  properties: Record<string, ToolInputFieldSchema>;
};

export type ToolDefinition<TInput extends ToolInput = ToolInput> = {
  name: RegisteredToolName;
  description: string;
  inputSchema: ToolInputSchema;
  execute: (input: TInput, context: ToolContext) => Promise<ToolOutput>;
};

export type ToolExecutionStatus = "completed" | "failed" | "pending";

export type ToolExecutionResult = {
  id: string;
  stepId: string;
  toolName: RegisteredToolName | string;
  status: ToolExecutionStatus;
  durationMs?: number;
  input?: ToolInput;
  output?: ToolOutput;
  error?: string;
};

export type CalculatorToolInput = {
  expression: string;
};

export type CalculatorToolOutput = {
  value: number;
  expression: string;
  explanation: string;
};

export type InvestigationEvidenceToolOutput = {
  investigationEvidence: Evidence[];
  evidenceCount: number;
  limitations?: string[];
};

export type DataAnalysisToolOutput = InvestigationEvidenceToolOutput & {
  fileName: string;
  netRevenue: number;
  grossPositiveRevenue: number;
  negativeAdjustmentsTotal: number;
  validRecordCount: number;
  warnings: string[];
};

export type CustomerAnalysisToolOutput = InvestigationEvidenceToolOutput & {
  fileName: string;
  distinctCustomers: number;
  distinctOrders: number;
  segmentCounts: {
    oneTimeCustomers: number;
    repeatCustomers: number;
    highValueCustomers: number;
  };
  segmentationRule: string;
};

export type FinancialAnalysisToolOutput = InvestigationEvidenceToolOutput & {
  fileName: string;
  netRevenue: number;
  grossPositiveRevenue: number;
  negativeAdjustmentsTotal: number;
  averageOrderValue: number | null;
  discountColumnPresent: boolean;
  promotionColumnPresent: boolean;
  totalRecordedDiscounts: number | null;
  promotionSummaryCount: number;
};

export type WebResearchToolOutput = InvestigationEvidenceToolOutput & {
  query: string;
  findingCount: number;
  findings: Array<{
    title: string;
    url: string;
    snippet: string;
    score?: number;
    query?: string;
    classification?: string;
    relevanceScore?: number;
  }>;
  seoResearch?: boolean;
  queriesExecuted?: string[];
  seoResearchReport?: SeoResearchReport;
  failedQueries?: string[];
  emptyQueries?: string[];
};

/** @deprecated Use ToolDefinition and ToolExecutionResult. */
export type AgentToolInput = ToolInput;

/** @deprecated Use ToolOutput via ToolExecutionResult. */
export type AgentToolOutput = {
  ok: boolean;
  data?: ToolOutput;
  error?: string;
};

/** @deprecated Use ToolDefinition. */
export type AgentTool = {
  name: AgentToolName;
  description: string;
  execute: (input: AgentToolInput) => Promise<AgentToolOutput>;
};
