import { StatusChip } from "@/components/ui/status-chip";

type AppHeaderProps = {
  statusLabel?: string;
};

export function AppHeader({ statusLabel = "Ready" }: AppHeaderProps) {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-teal-300/80">
            NEXUS SEO Agent
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
              NEXUS
            </h1>
            <p className="text-sm text-zinc-400">
              Multi-agent organic growth investigations
            </p>
          </div>
        </div>
        <StatusChip label={statusLabel} />
      </div>
    </header>
  );
}
