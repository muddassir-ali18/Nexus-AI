import { executeCalculator } from "@/lib/tools/calculator";
import { executeCustomerAnalysis } from "@/lib/tools/customer-analysis";
import { executeDataAnalysis } from "@/lib/tools/data-analysis";
import { executeFinancialAnalysis } from "@/lib/tools/financial-analysis";
import { executeWebResearchCore } from "@/lib/tools/web-research-core";
import type {
  RegisteredToolName,
  ToolDefinition,
  ToolInput,
  ToolOutput,
} from "@/lib/tools/types";

const calculatorTool: ToolDefinition = {
  name: "calculator",
  description:
    "Evaluate deterministic arithmetic expressions with +, -, *, /, parentheses, and decimals.",
  inputSchema: {
    required: ["expression"],
    properties: {
      expression: {
        type: "string",
        description: "A limited arithmetic expression such as (500 - 100) * 0.20",
      },
    },
  },
  execute: executeCalculator,
};

const dataAnalysisTool: ToolDefinition = {
  name: "data_analysis",
  description:
    "Run deterministic sales CSV analysis on a request-scoped CSV attachment. Produces metrics and evidence without Nemotron.",
  inputSchema: {
    required: [],
    properties: {},
  },
  execute: executeDataAnalysis,
};

const customerAnalysisTool: ToolDefinition = {
  name: "customer_analysis",
  description:
    "Analyze customer order frequency and value segments from an attached sales CSV with customer_id and order_id columns.",
  inputSchema: {
    required: [],
    properties: {},
  },
  execute: executeCustomerAnalysis,
};

const financialAnalysisTool: ToolDefinition = {
  name: "financial_analysis",
  description:
    "Analyze revenue, discounts, promotions, and financial metrics from an attached sales CSV using deterministic calculations.",
  inputSchema: {
    required: [],
    properties: {},
  },
  execute: executeFinancialAnalysis,
};

const webResearchTool: ToolDefinition = {
  name: "web_research",
  description:
    "Search the web for external sources relevant to the investigation query (requires server TAVILY_API_KEY).",
  inputSchema: {
    required: ["query"],
    properties: {
      query: {
        type: "string",
        description: "A concise web search query derived from the investigation question.",
      },
      seoResearch: {
        type: "string",
        description:
          "Optional. Set to true to run bounded multi-query SEO research mode when the question is SEO-focused.",
      },
    },
  },
  execute: executeWebResearchCore,
};

const TOOL_REGISTRY = new Map<RegisteredToolName, ToolDefinition>([
  ["calculator", calculatorTool],
  ["data_analysis", dataAnalysisTool],
  ["customer_analysis", customerAnalysisTool],
  ["financial_analysis", financialAnalysisTool],
  ["web_research", webResearchTool],
]);

export function getRegisteredTool(
  name: string,
): ToolDefinition | undefined {
  return TOOL_REGISTRY.get(name as RegisteredToolName);
}

export function listRegisteredTools(): ToolDefinition[] {
  return Array.from(TOOL_REGISTRY.values());
}

export function isRegisteredToolName(name: string): name is RegisteredToolName {
  return TOOL_REGISTRY.has(name as RegisteredToolName);
}

export function validateToolInput(
  tool: ToolDefinition,
  input: ToolInput,
): ToolInput {
  for (const field of tool.inputSchema.required) {
    const value = input[field];
    const schema = tool.inputSchema.properties[field];

    if (schema?.type === "string" && (typeof value !== "string" || !value.trim())) {
      throw new Error(`Tool input "${field}" must be a non-empty string.`);
    }

    if (schema?.type === "number" && typeof value !== "number") {
      throw new Error(`Tool input "${field}" must be a number.`);
    }
  }

  return input;
}

export async function runRegisteredTool(
  name: RegisteredToolName,
  input: ToolInput,
  context: Parameters<ToolDefinition["execute"]>[1],
): Promise<ToolOutput> {
  const tool = TOOL_REGISTRY.get(name);
  if (!tool) {
    throw new Error(`Tool "${name}" is not registered.`);
  }

  const validatedInput = validateToolInput(tool, input);
  return tool.execute(validatedInput, context);
}
