type ChatWelcomeProps = {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
};

const PROMPTS = [
  {
    title: "Analyze an SEO performance CSV",
    body: "Attach a .csv and ask for revenue, trends, and evidence-backed findings.",
  },
  {
    title: "Research competitors",
    body: "Uses web research when Tavily is configured on the server.",
  },
  {
    title: "Analyze business revenue and trends",
    body: "General investigation with deterministic CSV tools when data is attached.",
  },
  {
    title: "Review a website SEO request",
    body: "Explains which SEO capabilities exist today and which are not implemented.",
  },
] as const;

export function ChatWelcome({ onSelectPrompt, disabled = false }: ChatWelcomeProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-10 text-center sm:py-16">
      <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
        What can I help you investigate?
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
        NEXUS researches topics, analyzes attached CSV files, delegates to specialist
        agents, and returns evidence-backed findings with approval-gated recommendations.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt.title}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(`${prompt.title}. ${prompt.body}`)}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-left transition-colors hover:border-teal-900/50 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="text-sm font-medium text-zinc-100">{prompt.title}</p>
            <p className="mt-2 text-xs leading-6 text-zinc-500">{prompt.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
