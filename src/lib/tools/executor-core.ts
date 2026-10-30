import {
  getRegisteredTool,
  validateToolInput,
} from "@/lib/tools/registry-core";
import type {
  ToolContext,
  ToolExecutionResult,
  ToolInput,
} from "@/lib/tools/types";

function getSafeToolErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Tool execution failed.";
}

export async function executeTool(
  toolName: string,
  input: ToolInput,
  context: ToolContext = {},
): Promise<ToolExecutionResult> {
  const startedAt = performance.now();
  const stepId = context.stepId ?? "unknown-step";

  const tool = getRegisteredTool(toolName);
  if (!tool) {
    return {
      id: crypto.randomUUID(),
      stepId,
      toolName,
      status: "failed",
      durationMs: Math.round(performance.now() - startedAt),
      input,
      error: `Tool "${toolName}" is not registered.`,
    };
  }

  try {
    const validatedInput = validateToolInput(tool, input);
    const output = await tool.execute(validatedInput, context);

    return {
      id: crypto.randomUUID(),
      stepId,
      toolName: tool.name,
      status: "completed",
      durationMs: Math.round(performance.now() - startedAt),
      input: validatedInput,
      output,
    };
  } catch (error) {
    return {
      id: crypto.randomUUID(),
      stepId,
      toolName: tool.name,
      status: "failed",
      durationMs: Math.round(performance.now() - startedAt),
      input,
      error: getSafeToolErrorMessage(error),
    };
  }
}
