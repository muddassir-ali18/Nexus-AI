import { investigateQuestion } from "@/lib/agents/orchestrator";
import type { InvestigateApiResponse } from "@/lib/agents/types";
import { parseInvestigateRequest } from "@/lib/api/investigate-request";
import {
  getErrorStatusCode,
  getSafeErrorMessage,
} from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const parsed = await parseInvestigateRequest(request);
    const result = await investigateQuestion(
      parsed.question,
      parsed.attachments,
    );

    const response: InvestigateApiResponse = {
      success: true,
      question: result.question.text,
      plan: result.plan,
      toolExecutions: result.toolExecutions,
      evidence: result.evidence,
      pendingTools: result.pendingTools,
      orchestration: result.orchestration,
      proposedActions: result.proposedActions,
      decision: result.decisionSynthesis?.decision ?? null,
      recommendedActions:
        result.decisionSynthesis?.recommendedActions ?? [],
      decisionError: result.decisionError,
    };

    return Response.json(response);
  } catch (error) {
    const response: InvestigateApiResponse = {
      success: false,
      error: getSafeErrorMessage(error),
    };

    return Response.json(response, { status: getErrorStatusCode(error) });
  }
}
