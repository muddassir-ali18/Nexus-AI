export function WorkspaceOverview() {
  return (
    <section
      id="overview"
      className="scroll-mt-28 rounded-xl border border-zinc-800/80 bg-gradient-to-br from-zinc-950 via-zinc-950 to-teal-950/20 p-6 sm:p-8"
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-teal-300/80">
        SEO Agent Workspace
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
        Investigate organic growth with specialist agents
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
        Type a goal, attach a supported sales CSV, or dictate a request with your
        microphone. NEXUS plans the investigation, delegates to specialists, runs
        deterministic tools, collects evidence, and synthesizes a decision with
        approval-gated recommendations.
      </p>
      <div className="mt-5 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/90">
          Capability boundaries (honest)
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-400">
          <li>
            Website crawling, live SEO audits, and Search Console integrations are{" "}
            <span className="text-zinc-200">not implemented</span> in this release.
          </li>
          <li>
            CSV investigations require an uploaded{" "}
            <span className="text-zinc-200">.csv</span> file (PDF/DOCX/URL uploads
            are not supported).
          </li>
          <li>
            External research requires server{" "}
            <span className="text-zinc-200">TAVILY_API_KEY</span> configuration.
          </li>
          <li>
            Sample CSV metrics are clearly synthetic demo data when shown in the SEO
            Workspace analyzer.
          </li>
        </ul>
      </div>
    </section>
  );
}
