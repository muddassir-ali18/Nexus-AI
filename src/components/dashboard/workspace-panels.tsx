import type {
  InvestigationDecision,
  SynthesizedRecommendedAction,
} from "@/lib/agents/decision-synthesis-types";
import type { AgentRunStatus } from "@/lib/agents/types";
import type { ProposedAction } from "@/lib/agents/specialists-types";
import type { Evidence } from "@/lib/data/types";
import { DecisionPanels } from "@/components/dashboard/decision-panels";
import { ProposedActionsPanel } from "@/components/dashboard/proposed-actions-panel";
import { EvidenceList } from "@/components/dashboard/evidence-display";
import { InvestigationPlaceholder } from "@/components/dashboard/investigation-plan-panel";
import { Panel } from "@/components/ui/panel";

type WorkspacePanelsProps = {
  status: AgentRunStatus;
  error?: string | null;
  hasPlan: boolean;
  evidence: Evidence[];
  decision: InvestigationDecision | null;
  recommendedActions: SynthesizedRecommendedAction[];
  decisionError: string | null;
  proposedActions: ProposedAction[];
};

export function WorkspacePanels({
  status,
  error,
  hasPlan,
  evidence,
  decision,
  recommendedActions,
  decisionError,
  proposedActions,
}: WorkspacePanelsProps) {
  const investigationStatus =
    status === "planning"
      ? "planning"
      : status === "failed"
        ? "failed"
        : "idle";

  const evidenceDescription =
    evidence.length > 0
      ? `${evidence.length} evidence item${evidence.length === 1 ? "" : "s"} collected from executed tools.`
      : hasPlan
        ? "No evidence collected yet. Tools without valid inputs remain pending."
        : "No evidence has been collected. NEXUS will not display placeholder findings.";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {!hasPlan ? (
        <InvestigationPlaceholder status={investigationStatus} error={error} />
      ) : (
        <Panel
          eyebrow="Planned"
          title="Investigation"
          description="An investigation plan was generated. Review the planned and execution sections above."
        />
      )}

      <div id="evidence" className="scroll-mt-28 md:col-span-2">
        <Panel
          eyebrow={evidence.length > 0 ? "Collected" : hasPlan ? "Empty" : "Empty"}
          title="Evidence"
          description={evidenceDescription}
        >
          <EvidenceList
            evidence={evidence}
            emptyMessage={
              hasPlan
                ? "No evidence was collected from executed tools."
                : "Evidence appears here after a successful investigation."
            }
          />
        </Panel>
      </div>

      <div
        id="actions"
        className="scroll-mt-28 grid gap-4 md:col-span-2 md:grid-cols-2"
      >
      <DecisionPanels
        hasPlan={hasPlan}
        isInvestigating={status === "planning"}
        decision={decision}
        recommendedActions={recommendedActions}
        decisionError={decisionError}
      />

      <ProposedActionsPanel proposedActions={proposedActions} />
      </div>
    </div>
  );
}
