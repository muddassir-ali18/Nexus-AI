import type {
  SpecialistDefinition,
  SpecialistId,
  SpecialistTaskType,
} from "@/lib/agents/specialists-types";
import type { InvestigationStep } from "@/lib/agents/types";
import { looksLikeSeoResearchQuery } from "@/lib/research/seo-research-core";
import type { RegisteredToolName } from "@/lib/tools/types";
import { isRegisteredToolName } from "@/lib/tools/registry-core";

export const MAX_ORCHESTRATION_ITERATIONS = 1;

export const DEFAULT_ORCHESTRATION_BUDGET_MS = 120_000;

const SPECIALISTS: SpecialistDefinition[] = [
  {
    id: "research",
    name: "Research Specialist",
    responsibility:
      "Gather external, source-backed context for the investigation using configured web research.",
    supportedTaskTypes: ["external_research"],
    permittedTools: ["web_research"],
  },
  {
    id: "data_finance",
    name: "Data & Finance Specialist",
    responsibility:
      "Run deterministic CSV business metrics, financial analysis, and explicit arithmetic when inputs are available.",
    supportedTaskTypes: [
      "csv_business_metrics",
      "financial_analysis",
      "deterministic_arithmetic",
    ],
    permittedTools: ["data_analysis", "financial_analysis", "calculator"],
  },
  {
    id: "customer",
    name: "Customer Specialist",
    responsibility:
      "Analyze customer order frequency and segmentation from uploaded sales CSV data with required identifiers.",
    supportedTaskTypes: ["customer_segmentation"],
    permittedTools: ["customer_analysis"],
  },
  {
    id: "website_seo",
    name: "Website & SEO Specialist",
    responsibility:
      "Bound full-site crawls and automated SEO audits. SEO topic and competitor research runs through Tavily via the Research Specialist.",
    supportedTaskTypes: ["website_seo_audit", "seo_web_research"],
    permittedTools: [],
    capabilityNote:
      "Website crawling and automated SEO auditing are not implemented. SEO research uses server-side Tavily web search (web_research) and does not provide rankings, keyword volumes, or crawl metrics.",
  },
];

const SPECIALIST_BY_ID = new Map<SpecialistId, SpecialistDefinition>(
  SPECIALISTS.map((specialist) => [specialist.id, specialist]),
);

const TOOL_TO_SPECIALIST: Record<RegisteredToolName, SpecialistId> = {
  web_research: "research",
  data_analysis: "data_finance",
  financial_analysis: "data_finance",
  calculator: "data_finance",
  customer_analysis: "customer",
};

const TOOL_TO_TASK_TYPE: Record<RegisteredToolName, SpecialistTaskType> = {
  web_research: "external_research",
  data_analysis: "csv_business_metrics",
  financial_analysis: "financial_analysis",
  calculator: "deterministic_arithmetic",
  customer_analysis: "customer_segmentation",
};

export function listSpecialistDefinitions(): SpecialistDefinition[] {
  return [...SPECIALISTS];
}

export function getSpecialistDefinition(
  id: SpecialistId,
): SpecialistDefinition | undefined {
  return SPECIALIST_BY_ID.get(id);
}

export function resolveSpecialistForTool(
  toolName: string,
): SpecialistDefinition | null {
  if (!isRegisteredToolName(toolName)) {
    return null;
  }
  const specialistId = TOOL_TO_SPECIALIST[toolName];
  return SPECIALIST_BY_ID.get(specialistId) ?? null;
}

export function resolveTaskTypeForTool(
  toolName: RegisteredToolName,
): SpecialistTaskType {
  return TOOL_TO_TASK_TYPE[toolName];
}

function stepText(step: InvestigationStep): string {
  const query =
    typeof step.toolInput?.query === "string" ? step.toolInput.query : "";
  return `${step.description} ${step.reason} ${query}`.trim();
}

export function isWebsiteSeoAuditOrCrawlStep(step: InvestigationStep): boolean {
  const text = stepText(step).toLowerCase();
  return (
    /\b(crawl|crawler|lighthouse|core web vitals|site audit|website audit|technical audit|seo audit|full audit)\b/.test(
      text,
    ) && !/\b(research|competitor|content brief|search intent|best practices)\b/.test(
      text,
    )
  );
}

export function isSeoWebResearchInvestigationStep(
  step: InvestigationStep,
): boolean {
  if (isWebsiteSeoAuditOrCrawlStep(step)) {
    return false;
  }
  return looksLikeSeoResearchQuery(stepText(step));
}

/** @deprecated Use isWebsiteSeoAuditOrCrawlStep or isSeoWebResearchInvestigationStep */
export function isWebsiteSeoInvestigationStep(step: InvestigationStep): boolean {
  return (
    isWebsiteSeoAuditOrCrawlStep(step) || isSeoWebResearchInvestigationStep(step)
  );
}

export function specialistPermitsTool(
  specialistId: SpecialistId,
  toolName: RegisteredToolName,
): boolean {
  const specialist = SPECIALIST_BY_ID.get(specialistId);
  if (!specialist) {
    return false;
  }
  return specialist.permittedTools.includes(toolName);
}

export function selectSpecialistForStep(
  step: InvestigationStep,
  context: { csvAttached: boolean; webResearchConfigured: boolean },
): {
  specialist: SpecialistDefinition;
  taskType: SpecialistTaskType;
  requestedTool?: string;
  assignmentStatus: "assigned" | "pending_prerequisites" | "unsupported";
  statusMessage?: string;
} | null {
  const toolName = step.toolName?.trim();

  if (toolName && isRegisteredToolName(toolName)) {
    const specialist = resolveSpecialistForTool(toolName);
    if (!specialist) {
      return null;
    }

    if (!specialistPermitsTool(specialist.id, toolName)) {
      return {
        specialist,
        taskType: resolveTaskTypeForTool(toolName),
        requestedTool: toolName,
        assignmentStatus: "unsupported",
        statusMessage: `${specialist.name} is not permitted to run ${toolName}.`,
      };
    }

    if (toolName === "web_research" && !context.webResearchConfigured) {
      return {
        specialist,
        taskType: "external_research",
        requestedTool: toolName,
        assignmentStatus: "pending_prerequisites",
        statusMessage:
          "Web research requires TAVILY_API_KEY on the server.",
      };
    }

    if (
      (toolName === "data_analysis" ||
        toolName === "financial_analysis" ||
        toolName === "customer_analysis") &&
      !context.csvAttached
    ) {
      return {
        specialist,
        taskType: resolveTaskTypeForTool(toolName),
        requestedTool: toolName,
        assignmentStatus: "pending_prerequisites",
        statusMessage: "CSV-based tools require an attached sales CSV.",
      };
    }

    return {
      specialist,
      taskType: resolveTaskTypeForTool(toolName),
      requestedTool: toolName,
      assignmentStatus: "assigned",
    };
  }

  if (isSeoWebResearchInvestigationStep(step)) {
    const research = SPECIALIST_BY_ID.get("research")!;
    if (!context.webResearchConfigured) {
      return {
        specialist: research,
        taskType: "seo_web_research",
        requestedTool: "web_research",
        assignmentStatus: "pending_prerequisites",
        statusMessage:
          "SEO web research requires TAVILY_API_KEY on the server.",
      };
    }

    if (!toolName) {
      return {
        specialist: research,
        taskType: "seo_web_research",
        requestedTool: "web_research",
        assignmentStatus: "pending_prerequisites",
        statusMessage:
          "Include toolName web_research with toolInput.query (and optional seoResearch: true) to run Tavily SEO research.",
      };
    }

    return {
      specialist: research,
      taskType: "seo_web_research",
      requestedTool: toolName,
      assignmentStatus: "assigned",
    };
  }

  if (isWebsiteSeoAuditOrCrawlStep(step)) {
    const specialist = SPECIALIST_BY_ID.get("website_seo")!;
    return {
      specialist,
      taskType: "website_seo_audit",
      assignmentStatus: "unsupported",
      statusMessage: specialist.capabilityNote,
    };
  }

  return null;
}
