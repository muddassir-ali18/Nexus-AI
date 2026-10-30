"use client";

import type { ChatAssistantMessage } from "@/lib/chat/types";
import { buildAssistantSummaryMarkdown } from "@/lib/chat/format-assistant-summary";
import { SimpleMarkdown } from "@/components/chat/simple-markdown";
import { EvidenceList } from "@/components/dashboard/evidence-display";
import { InvestigationTimeline } from "@/components/dashboard/investigation-timeline";
import { Loader2 } from "lucide-react";

type ChatAssistantMessageProps = {
  message: ChatAssistantMessage;
  onRetry?: () => void;
  isRetrying?: boolean;
};

export function ChatAssistantMessageBlock({
  message,
  onRetry,
  isRetrying = false,
}: ChatAssistantMessageProps) {
  if (message.status === "loading") {
    return (
      <div className="flex gap-3">
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-950 text-xs font-semibold text-teal-300">
          N
        </div>
        <div className="max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Loader2 className="size-4 animate-spin text-teal-300" aria-hidden="true" />
            Investigating… planning, delegating specialists, and running tools.
          </div>
        </div>
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className="flex gap-3">
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-950 text-xs font-semibold text-teal-300">
          N
        </div>
        <div className="max-w-3xl rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3">
          <p className="text-sm text-red-300">{message.error ?? "Investigation failed."}</p>
          {onRetry ? (
            <button
              type="button"
              disabled={isRetrying}
              onClick={onRetry}
              className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-60"
            >
              {isRetrying ? "Retrying…" : "Retry investigation"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const payload = message.payload;
  if (!payload) {
    return null;
  }

  const summary = buildAssistantSummaryMarkdown(payload);

  return (
    <div className="flex gap-3">
      <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-950 text-xs font-semibold text-teal-300">
        N
      </div>
      <div className="min-w-0 max-w-3xl flex-1 space-y-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
          <SimpleMarkdown content={summary} />
        </div>

        <details className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-zinc-300">
            Specialist activity & execution details
          </summary>
          <div className="mt-3 space-y-3">
            <InvestigationTimeline
              embedded
              orchestration={payload.orchestration}
              toolExecutions={payload.toolExecutions}
            />
            {payload.pendingTools.length > 0 ? (
              <ul className="space-y-2 text-sm text-amber-200/90">
                {payload.pendingTools.map((item) => (
                  <li key={`${item.stepId}-${item.toolName}`}>
                    {item.toolName}: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>

        <details className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3" open>
          <summary className="cursor-pointer text-sm font-medium text-zinc-300">
            Evidence ({payload.evidence.length})
          </summary>
          <div className="mt-3">
            <EvidenceList evidence={payload.evidence} />
          </div>
        </details>

        {payload.proposedActions.length > 0 ? (
          <details className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-300">
              Proposed actions (approval required; not executed)
            </summary>
            <ul className="mt-3 space-y-3">
              {payload.proposedActions.map((action) => (
                <li
                  key={action.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm"
                >
                  <p className="font-medium text-zinc-100">{action.title}</p>
                  <p className="mt-1 text-zinc-400">{action.description}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Status: {action.status.replaceAll("_", " ")} · External execution:{" "}
                    {action.requiresExternalExecution ? "required" : "not required"}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
