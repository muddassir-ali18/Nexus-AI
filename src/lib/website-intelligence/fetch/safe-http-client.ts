import http from "node:http";
import https from "node:https";

import {
  DEFAULT_HTTP_TIMEOUT_MS,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_MAX_RESPONSE_BYTES,
  NEXUS_WEBSITE_FETCH_USER_AGENT,
} from "@/lib/website-intelligence/fetch/fetch-policy";
import {
  type DnsLookupFn,
  type ResolvedAddress,
  resolvePublicAddresses,
  validateExternalResearchUrl,
} from "@/lib/research/url-safety";

export type SafeHttpFetchStatus =
  | "success"
  | "blocked_url"
  | "blocked_dns"
  | "blocked_redirect"
  | "too_many_redirects"
  | "timeout"
  | "response_too_large"
  | "network_error";

export type SafeHttpFetchResult = {
  status: SafeHttpFetchStatus;
  requestedUrl: string;
  finalUrl: string | null;
  httpStatus: number | null;
  redirectChain: string[];
  headers: Record<string, string>;
  body: Buffer | null;
  pinnedAddress: string | null;
  errorMessage: string | null;
};

export type PinnedHttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

export type PinnedHttpExecutor = (input: {
  url: URL;
  pinnedAddress: ResolvedAddress;
  method: "GET" | "HEAD";
  timeoutMs: number;
  maxResponseBytes: number;
}) => Promise<PinnedHttpResponse>;

export type SafeHttpFetchOptions = {
  url: string;
  method?: "GET" | "HEAD";
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
  lookup?: DnsLookupFn;
  executePinnedRequest?: PinnedHttpExecutor;
};

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

function sanitizeErrorMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 300);
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const raw = headers[name.toLowerCase()];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw) && raw[0]) {
    return raw[0];
  }
  return null;
}

function normalizeResponseHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      normalized[key.toLowerCase()] = value;
    } else if (Array.isArray(value) && value[0]) {
      normalized[key.toLowerCase()] = value[0];
    }
  }
  return normalized;
}

function readBodyWithLimit(
  stream: http.IncomingMessage,
  maxBytes: number,
): Promise<{ ok: true; body: Buffer } | { ok: false; reason: "response_too_large" }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    stream.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        stream.destroy();
        resolve({ ok: false, reason: "response_too_large" });
        return;
      }
      chunks.push(chunk);
    });
    stream.on("error", (error) => reject(error));
    stream.on("end", () => {
      resolve({ ok: true, body: Buffer.concat(chunks) });
    });
  });
}

export function createDefaultDnsLookup(): DnsLookupFn {
  return async (hostname: string) => {
    const { lookup } = await import("node:dns/promises");
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => ({
      address: record.address,
      family: record.family === 6 ? 6 : 4,
    }));
  };
}

/**
 * Performs one HTTP(S) request connected to a pre-validated IP (connection pinning).
 * TLS SNI / Host header use the original hostname for certificate validation.
 */
export function createDefaultPinnedExecutor(): PinnedHttpExecutor {
  return (input) =>
    new Promise((resolve, reject) => {
      const isHttps = input.url.protocol === "https:";
      const port =
        input.url.port !== ""
          ? Number.parseInt(input.url.port, 10)
          : isHttps
            ? 443
            : 80;
      const path = `${input.url.pathname}${input.url.search}`;

      const requestOptions: https.RequestOptions = {
        host: input.pinnedAddress.address,
        port,
        path,
        method: input.method,
        headers: {
          Host: input.url.hostname,
          "User-Agent": NEXUS_WEBSITE_FETCH_USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
        servername: input.url.hostname,
        family: input.pinnedAddress.family,
        timeout: input.timeoutMs,
      };

      const request = isHttps
        ? https.request(requestOptions, onResponse)
        : http.request(requestOptions, onResponse);

      function onResponse(response: http.IncomingMessage) {
        void (async () => {
          try {
            if (!response.statusCode) {
              reject(new Error("Missing HTTP status code."));
              return;
            }
            const bodyResult = await readBodyWithLimit(
              response,
              input.maxResponseBytes,
            );
            if (!bodyResult.ok) {
              reject(new Error("response_too_large"));
              return;
            }
            resolve({
              statusCode: response.statusCode,
              headers: response.headers as Record<string, string | string[] | undefined>,
              body: bodyResult.body,
            });
          } catch (error) {
            reject(error);
          }
        })();
      }

      request.on("timeout", () => {
        request.destroy(new Error("timeout"));
      });
      request.on("error", (error) => reject(error));
      request.end();
    });
}

function resolveRedirectUrl(current: URL, location: string): URL | null {
  try {
    return new URL(location, current);
  } catch {
    return null;
  }
}

/**
 * Fetch a public URL with SSRF controls:
 * - URL allowlist (scheme, port, host patterns)
 * - DNS resolution with public-IP filtering before connect
 * - Connection pinned to validated IP (not ambient fetch/redirect following)
 * - Redirect targets re-validated and re-resolved independently
 */
export async function safeHttpFetch(
  options: SafeHttpFetchOptions,
): Promise<SafeHttpFetchResult> {
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const lookup = options.lookup ?? createDefaultDnsLookup();
  const executePinnedRequest =
    options.executePinnedRequest ?? createDefaultPinnedExecutor();

  const redirectChain: string[] = [];
  let currentUrl = options.url.trim();
  let pinnedAddress: string | null = null;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const urlCheck = validateExternalResearchUrl(currentUrl);
    if (!urlCheck.ok || !urlCheck.normalizedUrl) {
      return {
        status: hop === 0 ? "blocked_url" : "blocked_redirect",
        requestedUrl: options.url,
        finalUrl: null,
        httpStatus: null,
        redirectChain,
        headers: {},
        body: null,
        pinnedAddress,
        errorMessage: urlCheck.reason,
      };
    }

    const parsed = new URL(urlCheck.normalizedUrl);
    redirectChain.push(parsed.toString());

    const resolved = await resolvePublicAddresses(parsed.hostname, lookup);
    if (!resolved.ok) {
      return {
        status: "blocked_dns",
        requestedUrl: options.url,
        finalUrl: null,
        httpStatus: null,
        redirectChain,
        headers: {},
        body: null,
        pinnedAddress,
        errorMessage: resolved.reason,
      };
    }

    const address = resolved.addresses[0];
    if (!address) {
      return {
        status: "blocked_dns",
        requestedUrl: options.url,
        finalUrl: null,
        httpStatus: null,
        redirectChain,
        headers: {},
        body: null,
        pinnedAddress,
        errorMessage: "No usable public address after DNS filtering.",
      };
    }

    pinnedAddress = address.address;

    let response: PinnedHttpResponse;
    try {
      response = await executePinnedRequest({
        url: parsed,
        pinnedAddress: address,
        method,
        timeoutMs,
        maxResponseBytes,
      });
      if (response.body.length > maxResponseBytes) {
        return {
          status: "response_too_large",
          requestedUrl: options.url,
          finalUrl: parsed.toString(),
          httpStatus: response.statusCode,
          redirectChain,
          headers: normalizeResponseHeaders(response.headers),
          body: null,
          pinnedAddress,
          errorMessage: "Response exceeded configured size limit.",
        };
      }
    } catch (error) {
      const message =
        error instanceof Error ? sanitizeErrorMessage(error.message) : "Network error.";
      if (message.includes("timeout")) {
        return {
          status: "timeout",
          requestedUrl: options.url,
          finalUrl: parsed.toString(),
          httpStatus: null,
          redirectChain,
          headers: {},
          body: null,
          pinnedAddress,
          errorMessage: message,
        };
      }
      if (message.includes("response_too_large")) {
        return {
          status: "response_too_large",
          requestedUrl: options.url,
          finalUrl: parsed.toString(),
          httpStatus: null,
          redirectChain,
          headers: {},
          body: null,
          pinnedAddress,
          errorMessage: "Response exceeded configured size limit.",
        };
      }
      return {
        status: "network_error",
        requestedUrl: options.url,
        finalUrl: parsed.toString(),
        httpStatus: null,
        redirectChain,
        headers: {},
        body: null,
        pinnedAddress,
        errorMessage: message,
      };
    }

    if (REDIRECT_STATUS.has(response.statusCode)) {
      if (hop >= maxRedirects) {
        return {
          status: "too_many_redirects",
          requestedUrl: options.url,
          finalUrl: parsed.toString(),
          httpStatus: response.statusCode,
          redirectChain,
          headers: normalizeResponseHeaders(response.headers),
          body: null,
          pinnedAddress,
          errorMessage: `Exceeded maximum redirect count (${maxRedirects}).`,
        };
      }

      const location = headerValue(response.headers, "location");
      if (!location) {
        return {
          status: "network_error",
          requestedUrl: options.url,
          finalUrl: parsed.toString(),
          httpStatus: response.statusCode,
          redirectChain,
          headers: normalizeResponseHeaders(response.headers),
          body: null,
          pinnedAddress,
          errorMessage: "Redirect response missing Location header.",
        };
      }

      const nextUrl = resolveRedirectUrl(parsed, location);
      if (!nextUrl) {
        return {
          status: "blocked_redirect",
          requestedUrl: options.url,
          finalUrl: parsed.toString(),
          httpStatus: response.statusCode,
          redirectChain,
          headers: normalizeResponseHeaders(response.headers),
          body: null,
          pinnedAddress,
          errorMessage: "Invalid redirect Location URL.",
        };
      }

      currentUrl = nextUrl.toString();
      continue;
    }

    return {
      status: "success",
      requestedUrl: options.url,
      finalUrl: parsed.toString(),
      httpStatus: response.statusCode,
      redirectChain,
      headers: normalizeResponseHeaders(response.headers),
      body: response.body,
      pinnedAddress,
      errorMessage: null,
    };
  }

  return {
    status: "too_many_redirects",
    requestedUrl: options.url,
    finalUrl: null,
    httpStatus: null,
    redirectChain,
    headers: {},
    body: null,
    pinnedAddress,
    errorMessage: `Exceeded maximum redirect count (${maxRedirects}).`,
  };
}
