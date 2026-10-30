import type { Evidence } from "@/lib/data/types";
import { isEvidenceSourceUrl } from "@/components/dashboard/investigation-ui";

type EvidenceListProps = {
  evidence: Evidence[];
  emptyMessage?: string;
};

export function EvidenceList({ evidence, emptyMessage }: EvidenceListProps) {
  if (evidence.length === 0) {
    return emptyMessage ? (
      <p className="text-sm leading-6 text-zinc-500">{emptyMessage}</p>
    ) : null;
  }

  return (
    <ul className="space-y-3">
      {evidence.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {item.toolName}
            </p>
            {item.toolName === "web_research" ? (
              <span className="text-[0.65rem] uppercase tracking-wide text-teal-300/80">
                External source
              </span>
            ) : null}
          </div>
          {isEvidenceSourceUrl(item.source) ? (
            <a
              href={item.source}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm font-medium text-teal-300 underline decoration-teal-500/40 underline-offset-2 hover:text-teal-200"
            >
              {item.source}
            </a>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">{item.source}</p>
          )}
          <p className="mt-2 text-sm leading-6 text-zinc-100">{item.claim}</p>
          {typeof item.value === "number" ? (
            <p className="mt-2 text-xs text-zinc-600">Value: {item.value}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
