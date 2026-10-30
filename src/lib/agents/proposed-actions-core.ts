import type { SynthesizedRecommendedAction } from "@/lib/agents/decision-synthesis-types";
import type {
  ProposedAction,
  ProposedActionImpactLevel,
} from "@/lib/agents/specialists-types";
import type { Evidence } from "@/lib/data/types";

const EXTERNAL_ACTION_PATTERN =
  /\b(publish|deploy|send email|email customers|change price|change pricing|update pricing|update live pricing|modify website|purchase|buy|commit funds|push live|post on|schedule campaign|disable promotion|enable promotion|refund automatically|charge card|storefront)\b/i;

const HIGH_IMPACT_PATTERN =
  /\b(price|pricing|purchase|financial commit|publish|deploy live|customer communication|refund|charge|promotion change)\b/i;

const MEDIUM_IMPACT_PATTERN =
  /\b(campaign|discount|website|email|promotion|partnership|vendor)\b/i;

function mapPriorityToImpact(
  priority: SynthesizedRecommendedAction["priority"],
): ProposedActionImpactLevel {
  if (priority === "high") {
    return "high";
  }
  if (priority === "medium") {
    return "medium";
  }
  return "low";
}

function inferImpactLevel(action: SynthesizedRecommendedAction): ProposedActionImpactLevel {
  const text = `${action.title} ${action.description} ${action.basis}`;
  if (HIGH_IMPACT_PATTERN.test(text)) {
    return "high";
  }
  if (MEDIUM_IMPACT_PATTERN.test(text)) {
    return "medium";
  }
  return mapPriorityToImpact(action.priority);
}

function inferRequiresExternalExecution(
  action: SynthesizedRecommendedAction,
): boolean {
  const text = `${action.title} ${action.description} ${action.basis}`;
  return EXTERNAL_ACTION_PATTERN.test(text);
}

function extractEvidenceIds(basis: string, evidence: Evidence[]): string[] {
  const ids = new Set<string>();
  for (const item of evidence) {
    if (basis.includes(item.id)) {
      ids.add(item.id);
    }
  }
  return [...ids];
}

/**
 * Maps synthesis recommendations into approval-gated proposed actions.
 * The server never marks actions approved or completed — only awaiting approval.
 */
export function buildProposedActionsFromRecommendations(
  recommendedActions: SynthesizedRecommendedAction[],
  evidence: Evidence[],
): ProposedAction[] {
  return recommendedActions.map((action) => {
    const requiresExternalExecution = inferRequiresExternalExecution(action);
    const impactLevel = inferImpactLevel(action);
    const evidenceIds = extractEvidenceIds(action.basis, evidence);

    return {
      id: crypto.randomUUID(),
      title: action.title,
      description: action.description,
      rationale: action.basis,
      evidenceIds,
      impactLevel,
      requiresExternalExecution,
      status: requiresExternalExecution ? "awaiting_approval" : "proposed",
    };
  });
}

export function enforceApprovalBoundary(
  actions: ProposedAction[],
): ProposedAction[] {
  return actions.map((action) => {
    if (action.status === "approved" || action.status === "completed") {
      return {
        ...action,
        status: "awaiting_approval",
      };
    }
    return action;
  });
}
