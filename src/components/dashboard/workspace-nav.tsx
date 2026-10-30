"use client";

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "investigations", label: "Investigations" },
  { id: "seo-workspace", label: "SEO Workspace" },
  { id: "evidence", label: "Evidence" },
  { id: "actions", label: "Actions" },
] as const;

export function WorkspaceNav() {
  return (
    <nav
      aria-label="Workspace sections"
      className="sticky top-0 z-10 -mx-6 border-b border-zinc-800/80 bg-zinc-950/90 px-6 py-3 backdrop-blur-md"
    >
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              className="inline-flex rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-teal-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400/60"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
