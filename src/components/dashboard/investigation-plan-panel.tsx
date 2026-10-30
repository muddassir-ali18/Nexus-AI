import type { InvestigationPlan } from "@/lib/agents/types";
import { Panel } from "@/components/ui/panel";

type InvestigationPlanPanelProps = {
  question: string;
  plan: InvestigationPlan;
};

export function InvestigationPlanPanel({
  question,
  plan,
}: InvestigationPlanPanelProps) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-6 sm:p-8">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
        Planned
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">
        Investigation plan
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
        AI-generated planning from Nemotron. Steps describe intended work—they
        are not measured evidence until tools run below.
      </p>

      <div className="mt-6 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            User question
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-200">{question}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Objective
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{plan.objective}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Steps
          </p>
          <ol className="mt-3 space-y-3">
            {plan.steps.map((step, index) => (
              <li
                key={step.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="flex gap-3">
                  <span className="text-xs font-medium tabular-nums text-zinc-500">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-100">
                      {step.description}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {step.reason}
                    </p>
                    {step.toolName ? (
                      <p className="mt-2 text-xs text-zinc-600">
                        Tool: {step.toolName}
                      </p>
                    ) : step.tool ? (
                      <p className="mt-2 text-xs text-zinc-600">
                        Suggested tool: {step.tool}
                      </p>
                    ) : null}
                    {step.toolInput?.expression &&
                    typeof step.toolInput.expression === "string" ? (
                      <p className="mt-2 text-xs text-zinc-600">
                        Input: {step.toolInput.expression}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

type InvestigationPlaceholderProps = {
  status: "idle" | "planning" | "failed";
  error?: string | null;
};

export function InvestigationPlaceholder({
  status,
  error,
}: InvestigationPlaceholderProps) {
  if (status === "planning") {
    return (
      <Panel
        eyebrow="Planning"
        title="Investigation"
        description="Nemotron is generating an investigation plan and preparing tool execution."
      />
    );
  }

  if (status === "failed" && error) {
    return (
      <Panel
        eyebrow="Failed"
        title="Investigation"
        description={error}
      />
    );
  }

  return (
    <Panel
      eyebrow="Ready"
      title="Investigation"
      description="Submit a business question to generate an investigation plan and run available tools."
    />
  );
}
