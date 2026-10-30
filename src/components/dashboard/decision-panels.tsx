import type {
  InvestigationDecision,
  SynthesizedRecommendedAction,
} from "@/lib/agents/decision-synthesis-types";
import { Panel } from "@/components/ui/panel";

type DecisionPanelsProps = {
  hasPlan: boolean;
  isInvestigating: boolean;
  decision: InvestigationDecision | null;
  recommendedActions: SynthesizedRecommendedAction[];
  decisionError: string | null;
};

function confidenceLabel(confidence: InvestigationDecision["confidence"]): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

function priorityClass(priority: SynthesizedRecommendedAction["priority"]): string {
  switch (priority) {
    case "high":
      return "text-red-300/90";
    case "medium":
      return "text-amber-300/90";
    default:
      return "text-zinc-400";
  }
}

export function DecisionPanels({
  hasPlan,
  isInvestigating,
  decision,
  recommendedActions,
  decisionError,
}: DecisionPanelsProps) {
  const decisionEyebrow = decision
    ? "AI interpretation"
    : decisionError
      ? "Unavailable"
      : hasPlan
        ? isInvestigating
          ? "Synthesizing"
          : "Empty"
        : "Empty";

  const actionsEyebrow =
    recommendedActions.length > 0
      ? "Suggested"
      : decisionError
        ? "Unavailable"
        : "Empty";

  return (
    <>
      <Panel eyebrow={decisionEyebrow} title="Decision">
        {isInvestigating && hasPlan && !decision && !decisionError ? (
          <p className="text-sm leading-6 text-zinc-500">
            Nemotron is synthesizing an evidence-grounded decision…
          </p>
        ) : null}

        {decision ? (
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-300/80">
              AI-generated decision (verify against deterministic evidence above)
            </p>
            <p className="text-sm leading-6 text-zinc-100">{decision.summary}</p>
            <p className="text-xs text-zinc-500">
              Confidence:{" "}
              <span className="text-zinc-300">
                {confidenceLabel(decision.confidence)}
              </span>
            </p>
            {decision.reasoning.length > 0 ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Reasoning
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-300">
                  {decision.reasoning.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {decision.limitations.length > 0 ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Limitations
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-500">
                  {decision.limitations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {!decision && decisionError ? (
          <p className="text-sm leading-6 text-zinc-500">{decisionError}</p>
        ) : null}

        {!decision && !decisionError && hasPlan && !isInvestigating ? (
          <p className="text-sm leading-6 text-zinc-500">
            No decision synthesis was returned for this investigation.
          </p>
        ) : null}

        {!hasPlan ? (
          <p className="text-sm leading-6 text-zinc-500">
            No decision has been synthesized. This panel stays empty until an
            investigation completes.
          </p>
        ) : null}
      </Panel>

      <Panel eyebrow={actionsEyebrow} title="Recommended Actions">
        {recommendedActions.length > 0 ? (
          <ul className="space-y-3">
            {recommendedActions.map((action) => (
              <li
                key={`${action.title}-${action.description}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-100">
                    {action.title}
                  </p>
                  <p
                    className={`text-xs uppercase tracking-wide ${priorityClass(action.priority)}`}
                  >
                    {action.priority} priority
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  {action.description}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Basis: {action.basis}
                </p>
              </li>
            ))}
          </ul>
        ) : decision ? (
          <p className="text-sm leading-6 text-zinc-500">
            No recommended actions were returned for this investigation.
          </p>
        ) : decisionError ? (
          <p className="text-sm leading-6 text-zinc-500">
            Recommendations are unavailable because decision synthesis failed.
          </p>
        ) : (
          <p className="text-sm leading-6 text-zinc-500">
            Recommendations will appear here when synthesis returns actionable
            next steps grounded in evidence.
          </p>
        )}
      </Panel>
    </>
  );
}
