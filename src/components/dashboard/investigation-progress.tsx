import type { AgentRunStatus } from "@/lib/agents/types";
import { Loader2 } from "lucide-react";

type InvestigationProgressProps = {
  status: AgentRunStatus;
};

const STEPS = [
  "Planning investigation",
  "Delegating specialists",
  "Running tools",
  "Synthesizing decision",
] as const;

export function InvestigationProgress({ status }: InvestigationProgressProps) {
  if (status !== "planning") {
    return null;
  }

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-teal-900/40 bg-teal-950/10 p-5"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-teal-100">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Investigation in progress
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300"
          >
            <span className="text-xs text-teal-300/80">{index + 1}.</span> {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
