import type { OrchestrationRecord } from "@/lib/agents/specialists-types";

type SpecialistsPanelProps = {
  orchestration: OrchestrationRecord | null;
};

function runStatusClass(
  status: OrchestrationRecord["specialistRuns"][number]["status"],
): string {
  switch (status) {
    case "completed":
      return "text-emerald-400/90";
    case "failed":
      return "text-red-400";
    case "pending":
      return "text-amber-300/90";
    default:
      return "text-zinc-500";
  }
}

export function SpecialistsPanel({ orchestration }: SpecialistsPanelProps) {
  if (!orchestration || orchestration.specialistRuns.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-6 sm:p-8">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
        Multi-agent coordination
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">
        Specialist delegation
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
        NEXUS assigned plan steps to logical specialists. Iteration{" "}
        {orchestration.iteration} of {orchestration.maxIterations} (
        {orchestration.replanningEnabled
          ? "replanning enabled"
          : "single-pass delegation"}
        ). Stop reason: {orchestration.stopReason.replaceAll("_", " ")}.
      </p>

      <ul className="mt-6 space-y-3">
        {orchestration.specialistRuns.map((run) => (
          <li
            key={run.stepId}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-100">
                {run.specialistName}
              </p>
              <p
                className={`text-xs uppercase tracking-wide ${runStatusClass(run.status)}`}
              >
                {run.status}
              </p>
            </div>
            <p className="mt-2 text-sm text-zinc-300">{run.description}</p>
            <p className="mt-2 text-xs text-zinc-600">
              Task type: {run.taskType.replaceAll("_", " ")}
            </p>
            {run.toolExecutions.length > 0 ? (
              <p className="mt-2 text-xs text-zinc-500">
                Tools attempted:{" "}
                {run.toolExecutions
                  .map((execution) => execution.toolName)
                  .join(", ")}
              </p>
            ) : null}
            {run.pendingReason ? (
              <p className="mt-2 text-sm text-amber-200/80">{run.pendingReason}</p>
            ) : null}
            {run.error ? (
              <p className="mt-2 text-sm text-red-400">{run.error}</p>
            ) : null}
            {run.capabilityNote ? (
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {run.capabilityNote}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
