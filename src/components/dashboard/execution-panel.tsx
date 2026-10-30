import type { PendingToolExecution } from "@/lib/agents/types";
import type { Evidence } from "@/lib/data/types";
import type { ToolExecutionResult } from "@/lib/tools/types";
import { EvidenceList } from "@/components/dashboard/evidence-display";
import {
  formatToolExecutionLabel,
  groupInvestigationEvidence,
  listVisibleToolExecutions,
  shouldOfferInvestigationRetry,
} from "@/components/dashboard/investigation-ui";

type ExecutionPanelProps = {
  toolExecutions: ToolExecutionResult[];
  evidence: Evidence[];
  pendingTools: PendingToolExecution[];
  attachedCsvFileName?: string | null;
  lastQuestion?: string | null;
  onRetryInvestigation?: () => void;
  isRetrying?: boolean;
};

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) {
    return "—";
  }
  return `${durationMs} ms`;
}

function executionStatusClass(status: ToolExecutionResult["status"]): string {
  switch (status) {
    case "completed":
      return "text-emerald-400/90";
    case "failed":
      return "text-red-400";
    default:
      return "text-amber-300/90";
  }
}

export function ExecutionPanel({
  toolExecutions,
  evidence,
  pendingTools,
  attachedCsvFileName,
  lastQuestion,
  onRetryInvestigation,
  isRetrying = false,
}: ExecutionPanelProps) {
  const visibleExecutions = listVisibleToolExecutions(toolExecutions);
  const { deterministic, other } = groupInvestigationEvidence(evidence);
  const showRetry = shouldOfferInvestigationRetry({
    pendingTools,
    hasCsvAttachment: Boolean(attachedCsvFileName),
    lastQuestion: lastQuestion ?? null,
  });

  if (
    visibleExecutions.length === 0 &&
    evidence.length === 0 &&
    pendingTools.length === 0
  ) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-6 sm:p-8">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
        Execution
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">
        Tool results
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
        Deterministic tool output appears below. Investigation plan steps are
        AI-generated planning only—not measured evidence.
      </p>

      {visibleExecutions.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Tool runs
          </p>
          <ul className="mt-3 space-y-3">
            {visibleExecutions.map((execution) => (
              <li
                key={execution.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-100">
                    {formatToolExecutionLabel(execution)}
                  </p>
                  <p
                    className={`text-xs uppercase tracking-wide ${executionStatusClass(execution.status)}`}
                  >
                    {execution.status}
                  </p>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Duration: {formatDuration(execution.durationMs)}
                </p>
                {execution.error ? (
                  <p className="mt-2 text-sm text-red-400">{execution.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {deterministic.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Deterministic evidence
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Measured by executed CSV/calculator tools. Not Nemotron hypotheses.
          </p>
          <div className="mt-3">
            <EvidenceList evidence={deterministic} />
          </div>
        </div>
      ) : null}

      {other.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            External source evidence
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Source-backed findings from web research (verify independently).
          </p>
          <div className="mt-3">
            <EvidenceList evidence={other} />
          </div>
        </div>
      ) : null}

      {pendingTools.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Pending tools
          </p>
          <ul className="mt-3 space-y-3">
            {pendingTools.map((item) => (
              <li
                key={`${item.stepId}-${item.toolName}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-200">
                    {item.toolName === "data_analysis"
                      ? "data_analysis (sales CSV)"
                      : item.toolName}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-amber-300/90">
                    pending
                  </p>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{item.description}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {item.reason}
                </p>
              </li>
            ))}
          </ul>

          {showRetry && onRetryInvestigation ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
              <p className="text-sm text-zinc-400">
                The plan did not run data analysis on your attached CSV, or a
                required input was missing. You can retry the same question and
                attachment without re-uploading.
              </p>
              <button
                type="button"
                disabled={isRetrying}
                onClick={onRetryInvestigation}
                className="mt-3 inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetrying ? "Retrying…" : "Retry investigation"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
