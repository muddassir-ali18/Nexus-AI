import {
  ALLOWED_HTML_CONTENT_TYPES,
  DEFAULT_HTTP_TIMEOUT_MS,
  DEFAULT_MAX_PAGES_PER_DOMAIN,
  DEFAULT_MAX_RESPONSE_BYTES,
  HARD_MAX_PAGES_PER_DOMAIN,
} from "@/lib/website-intelligence/fetch/fetch-policy";
import {
  createRobotsInvestigationCache,
  evaluateRobotsPermission,
  type RobotsFetchDeps,
  type RobotsInvestigationCache,
} from "@/lib/website-intelligence/fetch/robots-core";
import {
  safeHttpFetch,
  type SafeHttpFetchStatus,
} from "@/lib/website-intelligence/fetch/safe-http-client";
import type { PageRetrievalRecord, PageRetrievalStatus } from "@/lib/website-intelligence/types";
import { validateExternalResearchUrl } from "@/lib/research/url-safety";

export type PageRetrievalInvestigationState = {
  robotsCache: RobotsInvestigationCache;
  retrievedUrlKeys: Set<string>;
  successfulPagesPerDomain: Map<string, number>;
};

export type PageRetrievalDeps = RobotsFetchDeps;

export type RetrievePublicPageOptions = {
  url: string;
  state: PageRetrievalInvestigationState;
  maxPagesPerDomain?: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
  deps?: PageRetrievalDeps;
};

function sanitizePublicErrorMessage(message: string | null): string | null {
  if (!message) {
    return null;
  }
  return message
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[ip]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function normalizeUrlKey(rawUrl: string): string | null {
  const check = validateExternalResearchUrl(rawUrl);
  if (!check.ok || !check.normalizedUrl) {
    return null;
  }
  return check.normalizedUrl.toLowerCase();
}

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function parseContentType(headers: Record<string, string>): string | null {
  const raw = headers["content-type"];
  if (!raw) {
    return null;
  }
  return raw.split(";")[0]?.trim().toLowerCase() ?? null;
}

function isAllowedHtmlContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  return ALLOWED_HTML_CONTENT_TYPES.some(
    (allowed) => contentType === allowed || contentType.startsWith(`${allowed};`),
  );
}

function baseRecord(input: {
  requestedUrl: string;
  status: PageRetrievalStatus;
  errorMessage: string | null;
}): PageRetrievalRecord {
  return {
    requestedUrl: input.requestedUrl,
    finalUrl: null,
    canonicalUrl: null,
    status: input.status,
    httpStatus: null,
    contentType: null,
    byteLength: null,
    redirectChain: [],
    robotsChecked: false,
    robotsAllowed: null,
    retrievedAt: new Date().toISOString(),
    errorMessage: sanitizePublicErrorMessage(input.errorMessage),
    body: null,
  };
}

function mapFetchStatus(status: SafeHttpFetchStatus): PageRetrievalStatus {
  switch (status) {
    case "blocked_url":
    case "blocked_dns":
      return "blocked_policy";
    case "blocked_redirect":
      return "redirect_blocked";
    case "too_many_redirects":
      return "too_many_redirects";
    case "timeout":
      return "timeout";
    case "response_too_large":
      return "response_too_large";
    case "network_error":
      return "network_error";
    default:
      return "network_error";
  }
}

export function createPageRetrievalInvestigationState(): PageRetrievalInvestigationState {
  return {
    robotsCache: createRobotsInvestigationCache(),
    retrievedUrlKeys: new Set(),
    successfulPagesPerDomain: new Map(),
  };
}

export function resolveEffectivePageLimit(requested?: number): number {
  const value = requested ?? DEFAULT_MAX_PAGES_PER_DOMAIN;
  return Math.min(Math.max(value, 0), HARD_MAX_PAGES_PER_DOMAIN);
}

export async function retrievePublicPage(
  options: RetrievePublicPageOptions,
): Promise<PageRetrievalRecord> {
  const requestedUrl = options.url.trim();
  const urlKey = normalizeUrlKey(requestedUrl);
  if (!urlKey) {
    return baseRecord({
      requestedUrl,
      status: "blocked_policy",
      errorMessage: "URL failed safety validation.",
    });
  }

  if (options.state.retrievedUrlKeys.has(urlKey)) {
    return baseRecord({
      requestedUrl,
      status: "duplicate_url",
      errorMessage: "This URL was already retrieved in the current investigation.",
    });
  }

  const domain = domainFromUrl(urlKey);
  const maxPages = resolveEffectivePageLimit(options.maxPagesPerDomain);
  if (domain) {
    const used = options.state.successfulPagesPerDomain.get(domain) ?? 0;
    if (used >= maxPages) {
      return baseRecord({
        requestedUrl,
        status: "domain_page_limit",
        errorMessage: `Domain page limit reached (${maxPages} pages per domain).`,
      });
    }
  }

  const robots = await evaluateRobotsPermission({
    pageUrl: urlKey,
    cache: options.state.robotsCache,
    deps: options.deps,
  });

  if (!robots.allowed) {
    return {
      ...baseRecord({
        requestedUrl,
        status: "blocked_robots",
        errorMessage: robots.reason,
      }),
      robotsChecked: true,
      robotsAllowed: false,
    };
  }

  options.state.retrievedUrlKeys.add(urlKey);

  const fetchResult = await safeHttpFetch({
    url: urlKey,
    method: "GET",
    timeoutMs: options.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    maxResponseBytes: options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    lookup: options.deps?.lookup,
    executePinnedRequest: options.deps?.executePinnedRequest,
  });

  if (fetchResult.status !== "success") {
    const status = mapFetchStatus(fetchResult.status);
    return {
      ...baseRecord({
        requestedUrl,
        status,
        errorMessage: fetchResult.errorMessage ?? "Page retrieval failed.",
      }),
      finalUrl: fetchResult.finalUrl,
      httpStatus: fetchResult.httpStatus,
      redirectChain: fetchResult.redirectChain,
      robotsChecked: true,
      robotsAllowed: true,
    };
  }

  const httpStatus = fetchResult.httpStatus ?? 0;
  const contentType = parseContentType(fetchResult.headers);
  const byteLength = fetchResult.body?.length ?? 0;

  if (httpStatus === 429) {
    return {
      ...baseRecord({
        requestedUrl,
        status: "rate_limited",
        errorMessage: "Origin returned HTTP 429 (rate limited).",
      }),
      finalUrl: fetchResult.finalUrl,
      httpStatus,
      contentType,
      byteLength,
      redirectChain: fetchResult.redirectChain,
      robotsChecked: true,
      robotsAllowed: true,
    };
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return {
      ...baseRecord({
        requestedUrl,
        status: "http_error",
        errorMessage: `Origin returned HTTP ${httpStatus} (access not available without authentication).`,
      }),
      finalUrl: fetchResult.finalUrl,
      httpStatus,
      contentType,
      byteLength,
      redirectChain: fetchResult.redirectChain,
      robotsChecked: true,
      robotsAllowed: true,
    };
  }

  if (httpStatus === 404) {
    return {
      ...baseRecord({
        requestedUrl,
        status: "http_error",
        errorMessage: "Origin returned HTTP 404 (page not found).",
      }),
      finalUrl: fetchResult.finalUrl,
      httpStatus,
      contentType,
      byteLength,
      redirectChain: fetchResult.redirectChain,
      robotsChecked: true,
      robotsAllowed: true,
    };
  }

  if (httpStatus >= 500) {
    return {
      ...baseRecord({
        requestedUrl,
        status: "http_error",
        errorMessage: `Origin returned HTTP ${httpStatus} (server error).`,
      }),
      finalUrl: fetchResult.finalUrl,
      httpStatus,
      contentType,
      byteLength,
      redirectChain: fetchResult.redirectChain,
      robotsChecked: true,
      robotsAllowed: true,
    };
  }

  if (httpStatus < 200 || httpStatus >= 300) {
    return {
      ...baseRecord({
        requestedUrl,
        status: "http_error",
        errorMessage: `Origin returned HTTP ${httpStatus}.`,
      }),
      finalUrl: fetchResult.finalUrl,
      httpStatus,
      contentType,
      byteLength,
      redirectChain: fetchResult.redirectChain,
      robotsChecked: true,
      robotsAllowed: true,
    };
  }

  if (!isAllowedHtmlContentType(contentType)) {
    return {
      ...baseRecord({
        requestedUrl,
        status: "unsupported_content_type",
        errorMessage: contentType
          ? `Content-Type ${contentType} is not supported (HTML/XHTML only).`
          : "Missing or unsupported Content-Type (HTML/XHTML only).",
      }),
      finalUrl: fetchResult.finalUrl,
      httpStatus,
      contentType,
      byteLength,
      redirectChain: fetchResult.redirectChain,
      robotsChecked: true,
      robotsAllowed: true,
    };
  }

  if (domain) {
    const used = options.state.successfulPagesPerDomain.get(domain) ?? 0;
    options.state.successfulPagesPerDomain.set(domain, used + 1);
  }

  return {
    requestedUrl,
    finalUrl: fetchResult.finalUrl,
    canonicalUrl: null,
    status: "success",
    httpStatus,
    contentType,
    byteLength,
    redirectChain: fetchResult.redirectChain,
    robotsChecked: true,
    robotsAllowed: true,
    retrievedAt: new Date().toISOString(),
    errorMessage: null,
    body: fetchResult.body,
  };
}
