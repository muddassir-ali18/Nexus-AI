import type { OrchestrationRecord } from "@/lib/agents/specialists-types";
import type { ToolExecutionResult } from "@/lib/tools/types";
import { formatToolExecutionLabel } from "@/components/dashboard/investigation-ui";

type InvestigationTimelineProps = {
  orchestration: OrchestrationRecord | null;
  toolExecutions: ToolExecutionResult[];
  embedded?: boolean;
};

function statusClass(status: string): string {
  switch (status) {
    case "completed":
      return "border-emerald-900/50 bg-emerald-950/20 text-emerald-300";
    case "failed":
      return "border-red-900/50 bg-red-950/20 text-red-300";
    case "pending":
      return "border-amber-900/50 bg-amber-950/20 text-amber-200";
    case "skipped":
      return "border-zinc-800 bg-zinc-900/30 text-zinc-400";
    default:
      return "border-zinc-800 bg-zinc-900/30 text-zinc-400";
  }
}

export function InvestigationTimeline({
  orchestration,
  toolExecutions,
  embedded = false,
}: InvestigationTimelineProps) {
  if (!orchestration || orchestration.specialistRuns.length === 0) {
    return null;
  }

  const executionByStep = new Map(
    toolExecutions.map((execution) => [execution.stepId, execution]),
  );

  const timeline = (
      <ol className={`relative space-y-4 border-l border-zinc-800 pl-5 ${embedded ? "" : "mt-6"}`}>
        {orchestration.specialistRuns.map((run) => {
          const linkedExecution =
            executionByStep.get(run.stepId) ?? run.toolExecutions[0];

          return (
            <li key={run.stepId} className="relative">
              <span
                className="absolute -left-[0.62rem] top-2 size-2.5 rounded-full bg-teal-400"
                aria-hidden="true"
              />
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {run.specialistName}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {run.taskType.replaceAll("_", " ")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${statusClass(run.status)}`}
                  >
                    {run.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-zinc-300">{run.description}</p>
                {linkedExecution ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    Tool: {formatToolExecutionLabel(linkedExecution)} ·{" "}
                    {linkedExecution.status}
                    {linkedExecution.error ? ` — ${linkedExecution.error}` : ""}
                  </p>
                ) : null}
                {run.pendingReason ? (
                  <p className="mt-2 text-sm text-amber-200/85">{run.pendingReason}</p>
                ) : null}
                {run.capabilityNote ? (
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {run.capabilityNote}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
  );

  if (embedded) {
    return timeline;
  }

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-6 sm:p-8">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
        Investigation timeline
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">
        Specialist activity
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Recorded orchestration only — no simulated progress. Single-pass delegation
        (iteration {orchestration.iteration}/{orchestration.maxIterations}).
      </p>
      {timeline}
    </section>
  );
}
