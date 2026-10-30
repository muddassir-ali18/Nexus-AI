import { validateExternalResearchUrl } from "@/lib/research/url-safety";
import type { CanonicalUrlStatus } from "@/lib/website-intelligence/types";

export type CanonicalUrlAssessment = {
  raw: string | null;
  normalized: string | null;
  status: CanonicalUrlStatus;
  sameOrigin: boolean;
  note: string;
};

function resolveCanonicalHref(baseUrl: string, href: string): string | null {
  try {
    return new URL(href.trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

export function assessCanonicalUrl(
  pageUrl: string,
  rawCanonical: string | null,
): CanonicalUrlAssessment {
  if (!rawCanonical?.trim()) {
    return {
      raw: null,
      normalized: null,
      status: "missing",
      sameOrigin: false,
      note: "No canonical URL declared in page metadata.",
    };
  }

  const resolved = resolveCanonicalHref(pageUrl, rawCanonical);
  if (!resolved) {
    return {
      raw: rawCanonical,
      normalized: null,
      status: "invalid_unsafe",
      sameOrigin: false,
      note: "Canonical href could not be resolved.",
    };
  }

  const safety = validateExternalResearchUrl(resolved);
  if (!safety.ok || !safety.normalizedUrl) {
    return {
      raw: rawCanonical,
      normalized: null,
      status: "invalid_unsafe",
      sameOrigin: false,
      note: safety.reason ?? "Canonical URL failed safety validation.",
    };
  }

  let sameOrigin = false;
  try {
    sameOrigin = new URL(safety.normalizedUrl).origin === new URL(pageUrl).origin;
  } catch {
    sameOrigin = false;
  }

  if (sameOrigin) {
    return {
      raw: rawCanonical,
      normalized: safety.normalizedUrl,
      status: "valid_same_origin",
      sameOrigin: true,
      note: "Canonical URL recorded as metadata; retrieved page URL preserved independently.",
    };
  }

  return {
    raw: rawCanonical,
    normalized: safety.normalizedUrl,
    status: "valid_cross_origin",
    sameOrigin: false,
    note:
      "Cross-domain canonical reference recorded as metadata only; NEXUS did not fetch the canonical destination.",
  };
}
