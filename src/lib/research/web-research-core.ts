import { validateExternalResearchUrl } from "@/lib/research/url-safety";

export type WebResearchFinding = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  query?: string;
};

export type WebResearchSearchResult = {
  query: string;
  findings: WebResearchFinding[];
};

export type WebResearchFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RESULTS = 5;

export function isWebResearchConfigured(apiKey?: string | null): boolean {
  const resolved = apiKey ?? readWebResearchApiKey();
  return Boolean(resolved?.trim());
}

export function readWebResearchApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const apiKey = env.TAVILY_API_KEY?.trim();
  return apiKey ? apiKey : null;
}

export function sanitizeWebResearchErrorMessage(message: string): string {
  return message
    .replace(/tvly-[a-zA-Z0-9_-]+/gi, "[redacted]")
    .replace(/api_key["']?\s*[:=]\s*["']?[^"'\s]+/gi, "api_key=[redacted]")
    .slice(0, 300);
}

type TavilySearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
  error?: string;
  detail?: string;
};

function mapHttpFailure(status: number, payload: TavilySearchResponse): string {
  const providerMessage =
    typeof payload.error === "string"
      ? payload.error
      : typeof payload.detail === "string"
        ? payload.detail
        : "";

  if (status === 401 || status === 403) {
    return sanitizeWebResearchErrorMessage(
      providerMessage ||
        "Tavily rejected the API credentials. Verify TAVILY_API_KEY in the server environment.",
    );
  }

  if (status === 429) {
    return "Tavily rate limit reached. Retry later or reduce research requests.";
  }

  return sanitizeWebResearchErrorMessage(
    providerMessage || "Web research provider request failed.",
  );
}

export async function runWebResearchSearch(
  query: string,
  options?: {
    apiKey?: string | null;
    fetchImpl?: WebResearchFetcher;
    timeoutMs?: number;
  },
): Promise<WebResearchSearchResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Web research requires a non-empty query.");
  }

  const apiKey = options?.apiKey ?? readWebResearchApiKey();
  if (!isWebResearchConfigured(apiKey)) {
    throw new Error(
      "Web research is not configured. Set TAVILY_API_KEY in the server environment to enable web_research.",
    );
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: trimmedQuery,
        max_results: MAX_RESULTS,
        search_depth: "basic",
        include_answer: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Tavily search timed out before results were returned.");
    }
    throw new Error("Unable to reach Tavily search. Check server network access.");
  }

  const payload = (await response.json()) as TavilySearchResponse;
  if (!response.ok) {
    throw new Error(mapHttpFailure(response.status, payload));
  }

  const findings: WebResearchFinding[] = [];
  for (const item of payload.results ?? []) {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const rawUrl = typeof item.url === "string" ? item.url.trim() : "";
    const urlCheck = validateExternalResearchUrl(rawUrl);
    const snippet =
      typeof item.content === "string" ? item.content.trim().slice(0, 500) : "";
    if (!title || !urlCheck.ok || !urlCheck.normalizedUrl) {
      continue;
    }
    const url = urlCheck.normalizedUrl;
    const finding: WebResearchFinding = {
      title,
      url,
      snippet,
      query: trimmedQuery,
    };
    if (typeof item.score === "number") {
      finding.score = item.score;
    }
    findings.push(finding);
  }

  return {
    query: trimmedQuery,
    findings,
  };
}
