/**
 * Guards externally retrieved URLs and resolved IP addresses (SSRF prevention).
 * Used by Tavily result filtering and the pinned website-intelligence HTTP client.
 */

import { isIPv4, isIPv6 } from "node:net";

import { ALLOWED_HTTP_PORTS } from "@/lib/website-intelligence/fetch/fetch-policy";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.goog",
  "169.254.169.254",
]);

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost"];

export type UrlSafetyResult = {
  ok: boolean;
  normalizedUrl: string | null;
  reason: string | null;
};

export type IpSafetyResult = {
  ok: boolean;
  reason: string | null;
};

function parseIpv4Octets(ip: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) {
    return null;
  }
  const octets = match.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (octets.some((value) => value > 255)) {
    return null;
  }
  return octets;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const octets = parseIpv4Octets(ip);
  if (!octets) {
    return false;
  }
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true; // CGNAT carrier-grade
  }
  if (a === 169 && b === 254) {
    return true; // link-local / cloud metadata
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a >= 224) {
    return true; // multicast / reserved
  }
  return false;
}

function normalizeIpv6(ip: string): string {
  return ip.trim().toLowerCase();
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = normalizeIpv6(ip);
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") {
    return true;
  }
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]{0,2}:/i.test(normalized) || normalized.startsWith("fe80:")) {
    return true;
  }
  // Unique local fc00::/7
  if (/^f[cd][0-9a-f]{0,2}:/i.test(normalized)) {
    return true;
  }
  // IPv4-mapped IPv6
  const v4Mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (v4Mapped?.[1]) {
    return isPrivateOrReservedIpv4(v4Mapped[1]);
  }
  return false;
}

export function assertPublicIpAddress(address: string): IpSafetyResult {
  const trimmed = address.trim();
  if (!trimmed) {
    return { ok: false, reason: "Empty IP address." };
  }
  if (isIPv4(trimmed)) {
    if (isPrivateOrReservedIpv4(trimmed)) {
      return { ok: false, reason: "Private or reserved IPv4 address." };
    }
    return { ok: true, reason: null };
  }
  if (isIPv6(trimmed)) {
    if (isPrivateOrReservedIpv6(trimmed)) {
      return { ok: false, reason: "Private or reserved IPv6 address." };
    }
    return { ok: true, reason: null };
  }
  return { ok: false, reason: "Not a valid IP address." };
}

function isBlockedHostname(hostname: string): IpSafetyResult | null {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) {
    return { ok: false, reason: "Blocked hostname." };
  }
  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      return { ok: false, reason: "Internal hostname suffix is not allowed." };
    }
  }
  if (isIPv4(lower) || isIPv6(lower)) {
    return assertPublicIpAddress(lower);
  }
  if (isPrivateOrReservedIpv4(lower)) {
    return { ok: false, reason: "Private or loopback hosts are not allowed." };
  }
  return null;
}

function resolvePort(parsed: URL): number {
  if (parsed.port) {
    return Number.parseInt(parsed.port, 10);
  }
  return parsed.protocol === "https:" ? 443 : 80;
}

export function validateExternalResearchUrl(rawUrl: string): UrlSafetyResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, normalizedUrl: null, reason: "Empty URL." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, normalizedUrl: null, reason: "Malformed URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      normalizedUrl: null,
      reason: "Only http(s) URLs are allowed for external research.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      normalizedUrl: null,
      reason: "URLs with embedded credentials are not allowed.",
    };
  }

  const port = resolvePort(parsed);
  if (!ALLOWED_HTTP_PORTS.has(port)) {
    return {
      ok: false,
      normalizedUrl: null,
      reason: `Port ${port} is not allowed; only 80 and 443 are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const hostBlock = isBlockedHostname(hostname);
  if (hostBlock && !hostBlock.ok) {
    return {
      ok: false,
      normalizedUrl: null,
      reason: hostBlock.reason ?? "Host is not allowed.",
    };
  }

  return { ok: true, normalizedUrl: parsed.toString(), reason: null };
}

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type DnsLookupFn = (
  hostname: string,
) => Promise<ResolvedAddress[]>;

/**
 * Resolves a hostname and returns only addresses that pass public-IP checks.
 */
export async function resolvePublicAddresses(
  hostname: string,
  lookup: DnsLookupFn,
): Promise<{ ok: true; addresses: ResolvedAddress[] } | { ok: false; reason: string }> {
  const hostBlock = isBlockedHostname(hostname);
  if (hostBlock && !hostBlock.ok) {
    return { ok: false, reason: hostBlock.reason ?? "Host is not allowed." };
  }

  if (isIPv4(hostname) || isIPv6(hostname)) {
    const ipCheck = assertPublicIpAddress(hostname);
    if (!ipCheck.ok) {
      return { ok: false, reason: ipCheck.reason ?? "IP not allowed." };
    }
    return {
      ok: true,
      addresses: [{ address: hostname, family: isIPv4(hostname) ? 4 : 6 }],
    };
  }

  let records: ResolvedAddress[];
  try {
    records = await lookup(hostname);
  } catch {
    return { ok: false, reason: "DNS lookup failed." };
  }

  if (records.length === 0) {
    return { ok: false, reason: "DNS lookup returned no addresses." };
  }

  const publicAddresses: ResolvedAddress[] = [];
  for (const record of records) {
    const ipCheck = assertPublicIpAddress(record.address);
    if (ipCheck.ok) {
      publicAddresses.push(record);
    }
  }

  if (publicAddresses.length === 0) {
    return { ok: false, reason: "DNS resolved only to private or reserved addresses." };
  }

  return { ok: true, addresses: publicAddresses };
}
