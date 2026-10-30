import type { HTMLElement } from "node-html-parser";

import type {
  CanonicalUrlStatus,
  ExtractedPage,
  ExtractionMethod,
  PageEvidenceRecord,
  PageEvidenceType,
  PageRetrievalRecord,
} from "@/lib/website-intelligence/types";
import { assessCanonicalUrl } from "@/lib/website-intelligence/extract/canonical-url-core";
import { extractMainVisibleText } from "@/lib/website-intelligence/extract/boilerplate-heuristics";
import {
  elementTextContent,
  normalizeWhitespace,
  parseHtmlDocument,
} from "@/lib/website-intelligence/extract/html-parse-core";

const SERVICE_PATTERN =
  /\b(local seo|technical seo|on-page seo|link building|content marketing|seo audit|keyword research|seo consulting|digital marketing|ppc|google ads)\b/gi;

const VALUE_PROP_PATTERN =
  /\b(we help|we partner|leading provider|trusted by|our mission is to|specializ(e|ing) in)\b[^.!?]{0,120}/gi;

const GEO_CITIES = [
  "Chennai",
  "Mumbai",
  "Bengaluru",
  "Bangalore",
  "Delhi",
  "Hyderabad",
  "Pune",
  "Kolkata",
  "India",
];

function newEvidence(input: {
  requestedPageUrl: string;
  finalPageUrl: string;
  canonicalUrl: string | null;
  canonicalUrlStatus: CanonicalUrlStatus | null;
  retrievalStatus: PageRetrievalRecord["status"];
  evidenceType: PageEvidenceType;
  extractionMethod: ExtractionMethod;
  value: string;
  context: string | null;
}): PageEvidenceRecord {
  return {
    id: crypto.randomUUID(),
    requestedPageUrl: input.requestedPageUrl,
    finalPageUrl: input.finalPageUrl,
    canonicalUrl: input.canonicalUrl,
    canonicalUrlStatus: input.canonicalUrlStatus,
    evidenceType: input.evidenceType,
    extractionMethod: input.extractionMethod,
    value: input.value,
    context: input.context,
    retrievalStatus: input.retrievalStatus,
  };
}

function resolveLink(baseUrl: string, href: string): string | null {
  try {
    return new URL(href.trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

function classifyLink(baseUrl: string, absoluteUrl: string): "internal_link" | "external_link" {
  try {
    return new URL(absoluteUrl).origin === new URL(baseUrl).origin
      ? "internal_link"
      : "external_link";
  } catch {
    return "external_link";
  }
}

function extractHeadings(root: HTMLElement): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  for (let level = 1; level <= 6; level += 1) {
    for (const node of root.querySelectorAll(`h${level}`)) {
      const text = elementTextContent(node as HTMLElement);
      if (text) {
        headings.push({ level, text });
      }
    }
  }
  return headings;
}

function extractMetaContent(root: HTMLElement, selector: string): string | null {
  const node = root.querySelector(selector);
  const content = node?.getAttribute("content")?.trim();
  return content ? content : null;
}

function extractCanonicalRaw(root: HTMLElement): string | null {
  const links = root.querySelectorAll('link[rel="canonical"]');
  for (const link of links) {
    const href = link.getAttribute("href")?.trim();
    if (href) {
      return href;
    }
  }
  return null;
}

function extractServiceMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(SERVICE_PATTERN)) {
    const value = match[0]?.trim();
    if (value) {
      found.add(value);
    }
  }
  return [...found];
}

function extractLocationMentions(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const city of GEO_CITIES) {
    if (lower.includes(city.toLowerCase())) {
      found.push(city);
    }
  }
  return [...new Set(found)];
}

function extractValuePropositions(text: string): string[] {
  const results: string[] = [];
  for (const match of text.matchAll(VALUE_PROP_PATTERN)) {
    const value = normalizeWhitespace(match[0] ?? "");
    if (value.length >= 12) {
      results.push(value.slice(0, 240));
    }
  }
  return results.slice(0, 5);
}

function extractBlogMetadata(root: HTMLElement): string[] {
  const values: string[] = [];
  const ogType = extractMetaContent(root, 'meta[property="og:type"]');
  if (ogType) {
    values.push(`og:type=${ogType}`);
  }
  const published =
    extractMetaContent(root, 'meta[property="article:published_time"]') ??
    root.querySelector("time[datetime]")?.getAttribute("datetime");
  if (published) {
    values.push(`published=${published}`);
  }
  return values;
}

function extractContentCategories(root: HTMLElement): string[] {
  const categories = new Set<string>();
  const sectionMeta = extractMetaContent(root, 'meta[property="article:section"]');
  if (sectionMeta) {
    categories.add(sectionMeta);
  }
  for (const node of root.querySelectorAll("[class*='category'], [rel='category tag'], .cat-links a")) {
    const text = elementTextContent(node as HTMLElement);
    if (text) {
      categories.add(text);
    }
  }
  return [...categories].slice(0, 10);
}

export function extractPageFromRetrieval(input: {
  retrieval: PageRetrievalRecord;
  html?: string;
}): ExtractedPage {
  const limitations: string[] = [
    "Extracted fields come from server-side HTML parsing only; JavaScript-rendered content is not executed or loaded.",
    "Page-level evidence is distinct from Tavily search snippets and must be cited separately.",
  ];

  const requestedUrl = input.retrieval.requestedUrl;
  const finalPageUrl = input.retrieval.finalUrl ?? input.retrieval.requestedUrl;

  if (input.retrieval.status !== "success") {
    return {
      requestedUrl,
      finalPageUrl,
      canonicalUrl: null,
      canonicalUrlStatus: "missing",
      canonicalUrlNote: null,
      retrievalStatus: input.retrieval.status,
      evidence: [],
      limitations: [
        ...limitations,
        "HTML extraction skipped because page retrieval did not succeed.",
      ],
      boilerplateNotes: [],
      rawVisibleText: "",
      mainVisibleText: "",
    };
  }

  const html =
    input.html ??
    (input.retrieval.body ? input.retrieval.body.toString("utf8") : "");
  const { root, isEmpty } = parseHtmlDocument(html);
  if (isEmpty) {
    limitations.push("Document contained no visible text after parsing.");
  }

  const canonicalRaw = extractCanonicalRaw(root);
  const canonicalAssessment = assessCanonicalUrl(finalPageUrl, canonicalRaw);
  const canonicalForEvidence =
    canonicalAssessment.status === "invalid_unsafe"
      ? null
      : canonicalAssessment.normalized;

  const evidence: PageEvidenceRecord[] = [];
  const baseEvidence = {
    requestedPageUrl: requestedUrl,
    finalPageUrl,
    canonicalUrl: canonicalForEvidence,
    canonicalUrlStatus: canonicalAssessment.status,
    retrievalStatus: input.retrieval.status,
  };

  const titleNode = root.querySelector("title");
  const title = titleNode ? elementTextContent(titleNode as HTMLElement) : "";
  if (title) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "page_title",
        extractionMethod: "html_parser",
        value: title,
        context: "document title",
      }),
    );
  }

  const ogSiteName = extractMetaContent(root, 'meta[property="og:site_name"]');
  if (ogSiteName) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "og_site_name",
        extractionMethod: "meta_tag",
        value: ogSiteName,
        context: 'meta[property="og:site_name"]',
      }),
    );
  }

  const description =
    extractMetaContent(root, 'meta[name="description"]') ??
    extractMetaContent(root, 'meta[property="og:description"]');
  if (description) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "meta_description",
        extractionMethod: "meta_tag",
        value: description,
        context: 'meta[name="description"] or og:description',
      }),
    );
  }

  if (canonicalRaw) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "canonical",
        extractionMethod: "link_href",
        value: canonicalRaw,
        context: canonicalAssessment.note,
      }),
    );
  }

  const robotsMeta = extractMetaContent(root, 'meta[name="robots"]');
  if (robotsMeta) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "robots_meta",
        extractionMethod: "meta_tag",
        value: robotsMeta,
        context: 'meta[name="robots"]',
      }),
    );
  }

  const lang = root.querySelector("html")?.getAttribute("lang")?.trim();
  if (lang) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "html_lang",
        extractionMethod: "html_parser",
        value: lang,
        context: "html[lang]",
      }),
    );
  }

  for (const heading of extractHeadings(root)) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "heading",
        extractionMethod: "html_parser",
        value: heading.text,
        context: `h${heading.level}`,
      }),
    );
  }

  const seenLinks = new Set<string>();
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href")?.trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
      continue;
    }
    const absolute = resolveLink(finalPageUrl, href);
    if (!absolute) {
      continue;
    }
    const key = absolute.toLowerCase();
    if (seenLinks.has(key)) {
      continue;
    }
    seenLinks.add(key);
    const anchorText = elementTextContent(anchor as HTMLElement);
    const type = classifyLink(finalPageUrl, absolute);
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: type,
        extractionMethod: "link_href",
        value: absolute,
        context: anchorText ? `anchor: ${anchorText}` : "anchor text empty",
      }),
    );
  }

  const { rawVisibleText, mainVisibleText, boilerplate } = extractMainVisibleText(root);
  if (rawVisibleText) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "visible_text",
        extractionMethod: "html_parser",
        value: rawVisibleText.slice(0, 4000),
        context: "full document visible text (pre-boilerplate removal)",
      }),
    );
  }
  if (mainVisibleText) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "visible_text",
        extractionMethod: "heuristic_main_content",
        value: mainVisibleText.slice(0, 4000),
        context: "main content after boilerplate heuristics",
      }),
    );
  }

  for (const service of extractServiceMentions(mainVisibleText)) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "service_mention",
        extractionMethod: "heuristic_main_content",
        value: service,
        context: "matched in main visible text",
      }),
    );
  }

  for (const location of extractLocationMentions(mainVisibleText)) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "location_mention",
        extractionMethod: "heuristic_main_content",
        value: location,
        context: "matched in main visible text",
      }),
    );
  }

  for (const proposition of extractValuePropositions(mainVisibleText)) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "value_proposition",
        extractionMethod: "heuristic_main_content",
        value: proposition,
        context: "matched phrasing in main visible text",
      }),
    );
  }

  for (const item of extractBlogMetadata(root)) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "blog_metadata",
        extractionMethod: "meta_tag",
        value: item,
        context: "article/open graph metadata",
      }),
    );
  }

  for (const category of extractContentCategories(root)) {
    evidence.push(
      newEvidence({
        ...baseEvidence,
        evidenceType: "content_category",
        extractionMethod: "html_parser",
        value: category,
        context: "category metadata or tag link text",
      }),
    );
  }

  return {
    requestedUrl,
    finalPageUrl,
    canonicalUrl: canonicalForEvidence,
    canonicalUrlStatus: canonicalAssessment.status,
    canonicalUrlNote: canonicalAssessment.note,
    retrievalStatus: input.retrieval.status,
    evidence,
    limitations,
    boilerplateNotes: [
      ...boilerplate.notes,
      ...boilerplate.removedRegions.map((region) => `Boilerplate region removed from main-content heuristic: ${region}`),
    ],
    rawVisibleText,
    mainVisibleText,
  };
}
