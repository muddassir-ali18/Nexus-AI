import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isWebResearchConfigured,
  runWebResearchSearch,
  sanitizeWebResearchErrorMessage,
} from "./web-research-core";

describe("web research core", () => {
  it("reports unconfigured when TAVILY_API_KEY is absent", () => {
    assert.equal(isWebResearchConfigured(null), false);
    assert.equal(isWebResearchConfigured(""), false);
  });

  it("reports configured when an API key is present", () => {
    assert.equal(isWebResearchConfigured("tvly-test-key"), true);
  });

  it("returns findings from a mock provider response", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Example Market Report",
              url: "https://example.com/report",
              content: "Relevant excerpt about industry trends.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await runWebResearchSearch("retail promotion trends", {
      apiKey: "tvly-test",
      fetchImpl: mockFetch,
    });

    assert.equal(result.query, "retail promotion trends");
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0]?.url, "https://example.com/report");
  });

  it("fails honestly when no provider key is configured", async () => {
    await assert.rejects(
      () =>
        runWebResearchSearch("test query", {
          apiKey: null,
        }),
      /not configured/i,
    );
  });

  it("maps invalid credentials without leaking the API key", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({ error: "Invalid API key tvly-abc123secret" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );

    await assert.rejects(
      () =>
        runWebResearchSearch("seo trends", {
          apiKey: "tvly-abc123secret",
          fetchImpl: mockFetch,
        }),
      (error: Error) => {
        assert.match(error.message, /credentials|invalid api key/i);
        assert.doesNotMatch(error.message, /tvly-abc123secret/);
        return true;
      },
    );
  });

  it("handles rate limits and empty result sets", async () => {
    const rateLimited: typeof fetch = async () =>
      new Response(JSON.stringify({ error: "Rate limit" }), { status: 429 });

    await assert.rejects(
      () =>
        runWebResearchSearch("busy query", {
          apiKey: "tvly-test",
          fetchImpl: rateLimited,
        }),
      /rate limit/i,
    );

    const empty: typeof fetch = async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const emptyResult = await runWebResearchSearch("empty query", {
      apiKey: "tvly-test",
      fetchImpl: empty,
    });
    assert.equal(emptyResult.findings.length, 0);
  });

  it("drops unsafe URLs from provider results", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Safe result",
              url: "https://example.com/safe",
              content: "Public page.",
            },
            {
              title: "Internal host",
              url: "http://127.0.0.1/admin",
              content: "Should be filtered.",
            },
            {
              title: "File scheme",
              url: "file:///etc/passwd",
              content: "Should be filtered.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await runWebResearchSearch("ssrf guard test", {
      apiKey: "tvly-test",
      fetchImpl: mockFetch,
    });

    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0]?.url, "https://example.com/safe");
  });

  it("redacts keys in sanitized error messages", () => {
    const sanitized = sanitizeWebResearchErrorMessage(
      "Failure for api_key=tvly-live-key-xyz",
    );
    assert.doesNotMatch(sanitized, /tvly-live-key-xyz/);
    assert.match(sanitized, /redacted/i);
  });
});
