import type { ProposedAction } from "@/lib/agents/specialists-types";
import { Panel } from "@/components/ui/panel";

type ProposedActionsPanelProps = {
  proposedActions: ProposedAction[];
};

function statusLabel(status: ProposedAction["status"]): string {
  return status.replaceAll("_", " ");
}

function impactClass(impact: ProposedAction["impactLevel"]): string {
  switch (impact) {
    case "high":
      return "text-red-300/90";
    case "medium":
      return "text-amber-300/90";
    default:
      return "text-zinc-400";
  }
}

export function ProposedActionsPanel({
  proposedActions,
}: ProposedActionsPanelProps) {
  if (proposedActions.length === 0) {
    return null;
  }

  return (
    <Panel eyebrow="Approval boundary" title="Proposed actions">
      <p className="mb-4 text-sm leading-6 text-zinc-500">
        NEXUS may investigate and propose actions. External or consequential
        steps remain unexecuted until a human approves them in a future workflow.
        There is no approve/reject control in this release — statuses are
        informational only. The model cannot approve its own proposals.
      </p>
      <ul className="space-y-3">
        {proposedActions.map((action) => (
          <li
            key={action.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-100">{action.title}</p>
              <p className="text-xs uppercase tracking-wide text-amber-300/90">
                {statusLabel(action.status)}
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {action.description}
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Rationale: {action.rationale}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
              <span className={impactClass(action.impactLevel)}>
                {action.impactLevel} impact
              </span>
              <span>
                External execution:{" "}
                {action.requiresExternalExecution ? "required" : "not required"}
              </span>
              {action.evidenceIds.length > 0 ? (
                <span>Evidence refs: {action.evidenceIds.join(", ")}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
