/** Shared limits for website intelligence HTTP retrieval (Stage 11+). */

export const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_REDIRECTS = 5;
export const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576; // 1 MiB

export const ALLOWED_HTTP_PORTS = new Set([80, 443]);

export const DEFAULT_MAX_PAGES_PER_DOMAIN = 3;
export const HARD_MAX_PAGES_PER_DOMAIN = 10;

export const ALLOWED_HTML_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
];

export const NEXUS_WEBSITE_FETCH_USER_AGENT =
  "NexusWebsiteIntelligence/1.0 (+https://nexus.local; bounded public page retrieval)";

/** Product token used for robots.txt User-agent group matching. */
export const NEXUS_ROBOTS_USER_AGENT_TOKEN = "NexusWebsiteIntelligence";
