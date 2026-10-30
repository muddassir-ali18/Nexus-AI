import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessCanonicalUrl } from "./canonical-url-core";
import { extractPageFromRetrieval } from "./page-extract-core";
import type { PageRetrievalRecord } from "@/lib/website-intelligence/types";

function successRetrieval(html: string, finalUrl = "https://example.com/page"): PageRetrievalRecord {
  return {
    requestedUrl: finalUrl,
    finalUrl,
    canonicalUrl: null,
    status: "success",
    httpStatus: 200,
    contentType: "text/html",
    byteLength: Buffer.byteLength(html),
    redirectChain: [finalUrl],
    robotsChecked: true,
    robotsAllowed: true,
    retrievedAt: new Date().toISOString(),
    errorMessage: null,
    body: Buffer.from(html),
  };
}

describe("canonical url core", () => {
  it("rejects unsafe canonical destinations", () => {
    const result = assessCanonicalUrl(
      "https://example.com/page",
      "http://127.0.0.1/private",
    );
    assert.equal(result.status, "invalid_unsafe");
  });

  it("records cross-domain canonical without implying fetch", () => {
    const result = assessCanonicalUrl(
      "https://example.com/page",
      "https://other.example/blog/post",
    );
    assert.equal(result.status, "valid_cross_origin");
    assert.match(result.note, /did not fetch/i);
  });
});

describe("page extract core", () => {
  it("extracts metadata, headings, and provenance fields", () => {
    const html = `<!doctype html>
      <html lang="en"><head>
        <title>Agency Home</title>
        <meta name="description" content="Chennai SEO services" />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href="/canonical-path" />
      </head><body>
        <nav>Menu</nav>
        <main><h1>SEO Agency</h1><h2>Services</h2><p>We help Chennai businesses with local SEO.</p></main>
        <footer>Copyright</footer>
      </body></html>`;
    const extracted = extractPageFromRetrieval({
      retrieval: successRetrieval(html),
    });

    assert.equal(extracted.canonicalUrlStatus, "valid_same_origin");
    assert.ok(extracted.evidence.every((item) => item.requestedPageUrl.includes("example.com")));
    assert.ok(extracted.evidence.every((item) => item.finalPageUrl.includes("example.com")));
    assert.ok(extracted.evidence.some((item) => item.evidenceType === "page_title"));
    assert.ok(extracted.evidence.some((item) => item.evidenceType === "meta_description"));
    assert.ok(extracted.evidence.some((item) => item.context === "h1"));
    assert.ok(extracted.evidence.some((item) => item.evidenceType === "service_mention"));
    assert.ok(extracted.evidence.some((item) => item.evidenceType === "location_mention"));
    assert.ok(extracted.boilerplateNotes.some((note) => /Boilerplate region removed/i.test(note)));
  });

  it("handles missing title and description without inventing values", () => {
    const extracted = extractPageFromRetrieval({
      retrieval: successRetrieval("<html><body><p>Only body</p></body></html>"),
    });
    assert.equal(
      extracted.evidence.some((item) => item.evidenceType === "page_title"),
      false,
    );
    assert.equal(
      extracted.evidence.some((item) => item.evidenceType === "meta_description"),
      false,
    );
    assert.ok(extracted.evidence.some((item) => item.evidenceType === "visible_text"));
  });

  it("uses the first canonical tag and flags unsafe canonical references", () => {
    const extracted = extractPageFromRetrieval({
      retrieval: successRetrieval(`
        <html><head>
          <link rel="canonical" href="https://example.com/a" />
          <link rel="canonical" href="https://example.com/b" />
        </head><body></body></html>
      `),
    });
    const canonical = extracted.evidence.find((item) => item.evidenceType === "canonical");
    assert.equal(canonical?.value, "https://example.com/a");

    const unsafe = extractPageFromRetrieval({
      retrieval: successRetrieval(`
        <html><head><link rel="canonical" href="http://127.0.0.1/x" /></head><body></body></html>
      `),
    });
    assert.equal(unsafe.canonicalUrlStatus, "invalid_unsafe");
    assert.equal(unsafe.canonicalUrl, null);
  });

  it("classifies relative and absolute links and deduplicates destinations", () => {
    const extracted = extractPageFromRetrieval({
      retrieval: successRetrieval(`
        <html><body>
          <a href="/about">About</a>
          <a href="/about">About duplicate</a>
          <a href="https://external.example/out">External</a>
        </body></html>
      `),
    });
    const internal = extracted.evidence.filter((item) => item.evidenceType === "internal_link");
    const external = extracted.evidence.filter((item) => item.evidenceType === "external_link");
    assert.equal(internal.length, 1);
    assert.equal(external.length, 1);
    assert.match(internal[0]?.value ?? "", /example.com\/about/);
  });

  it("preserves retrieval status on every evidence record", () => {
    const extracted = extractPageFromRetrieval({
      retrieval: {
        ...successRetrieval("<html><body>x</body></html>"),
        status: "http_error",
        body: null,
      },
    });
    assert.equal(extracted.evidence.length, 0);
    assert.match(extracted.limitations.join(" "), /skipped/i);
  });

  it("extracts blog metadata and categories when present", () => {
    const extracted = extractPageFromRetrieval({
      retrieval: successRetrieval(`
        <html><head>
          <meta property="og:type" content="article" />
          <meta property="article:published_time" content="2026-01-01" />
          <meta property="article:section" content="SEO" />
        </head><body><div class="category">Local SEO</div></body></html>
      `),
    });
    assert.ok(extracted.evidence.some((item) => item.evidenceType === "blog_metadata"));
    assert.ok(extracted.evidence.some((item) => item.evidenceType === "content_category"));
  });
});
