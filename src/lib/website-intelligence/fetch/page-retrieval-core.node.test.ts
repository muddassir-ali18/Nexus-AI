import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createPageRetrievalInvestigationState,
  retrievePublicPage,
} from "./page-retrieval-core";
import type { PinnedHttpExecutor } from "./safe-http-client";

const lookup = async () => [{ address: "93.184.216.34", family: 4 as const }];

function withPageHandler(
  pageHandler: PinnedHttpExecutor,
  robotsBody = "User-agent: *\nAllow: /\n",
): PinnedHttpExecutor {
  return async (input) => {
    if (input.url.pathname === "/robots.txt") {
      return {
        statusCode: 200,
        headers: { "content-type": "text/plain" },
        body: Buffer.from(robotsBody),
      };
    }
    return pageHandler(input);
  };
}

describe("page retrieval core", () => {
  it("retrieves a successful HTML page", async () => {
    const state = createPageRetrievalInvestigationState();
    const result = await retrievePublicPage({
      url: "https://example.com/welcome",
      state,
      deps: {
        lookup,
        executePinnedRequest: withPageHandler(async () => ({
          statusCode: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
          body: Buffer.from("<html><body>Hello</body></html>"),
        })),
      },
    });
    assert.equal(result.status, "success");
    assert.equal(result.robotsAllowed, true);
    assert.ok(result.body?.includes("Hello"));
  });

  it("accepts application/xhtml+xml", async () => {
    const state = createPageRetrievalInvestigationState();
    const result = await retrievePublicPage({
      url: "https://example.com/x",
      state,
      deps: {
        lookup,
        executePinnedRequest: withPageHandler(async () => ({
          statusCode: 200,
          headers: { "content-type": "application/xhtml+xml" },
          body: Buffer.from("<html/>"),
        })),
      },
    });
    assert.equal(result.status, "success");
  });

  it("rejects unsupported content types", async () => {
    const state = createPageRetrievalInvestigationState();
    const result = await retrievePublicPage({
      url: "https://example.com/data.json",
      state,
      deps: {
        lookup,
        executePinnedRequest: withPageHandler(async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: Buffer.from("{}"),
        })),
      },
    });
    assert.equal(result.status, "unsupported_content_type");
  });

  it("reports 401/403/404/429/500 honestly", async () => {
    const cases = [
      { code: 401, status: "http_error" as const },
      { code: 403, status: "http_error" as const },
      { code: 404, status: "http_error" as const },
      { code: 429, status: "rate_limited" as const },
      { code: 500, status: "http_error" as const },
    ];

    for (const testCase of cases) {
      const state = createPageRetrievalInvestigationState();
      const result = await retrievePublicPage({
        url: `https://example.com/status-${testCase.code}`,
        state,
        deps: {
          lookup,
          executePinnedRequest: withPageHandler(async () => ({
            statusCode: testCase.code,
            headers: { "content-type": "text/html" },
            body: Buffer.from("err"),
          })),
        },
      });
      assert.equal(result.status, testCase.status);
      assert.equal(result.httpStatus, testCase.code);
    }
  });

  it("maps transport timeout to retrieval timeout status", async () => {
    const state = createPageRetrievalInvestigationState();
    const result = await retrievePublicPage({
      url: "https://example.com/slow",
      state,
      deps: {
        lookup,
        executePinnedRequest: withPageHandler(async () => {
          throw new Error("timeout");
        }),
      },
    });
    assert.equal(result.status, "timeout");
  });

  it("maps oversized responses to response_too_large", async () => {
    const state = createPageRetrievalInvestigationState();
    const result = await retrievePublicPage({
      url: "https://example.com/large",
      state,
      maxResponseBytes: 16,
      deps: {
        lookup,
        executePinnedRequest: withPageHandler(async () => ({
          statusCode: 200,
          headers: { "content-type": "text/html" },
          body: Buffer.alloc(64, "a"),
        })),
      },
    });
    assert.equal(result.status, "response_too_large");
  });

  it("records redirect chains from the safe HTTP client", async () => {
    const state = createPageRetrievalInvestigationState();
    const result = await retrievePublicPage({
      url: "https://example.com/a",
      state,
      deps: {
        lookup,
        executePinnedRequest: withPageHandler(async (input) => {
          if (input.url.pathname === "/a") {
            return {
              statusCode: 301,
              headers: { location: "/b" },
              body: Buffer.alloc(0),
            };
          }
          return {
            statusCode: 200,
            headers: { "content-type": "text/html" },
            body: Buffer.from("<html/>"),
          };
        }),
      },
    });
    assert.equal(result.status, "success");
    assert.deepEqual(result.redirectChain, [
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("blocks page retrieval when redirect targets a private host", async () => {
    const state = createPageRetrievalInvestigationState();
    const result = await retrievePublicPage({
      url: "https://example.com/redirect-private",
      state,
      deps: {
        lookup,
        executePinnedRequest: withPageHandler(async () => ({
          statusCode: 302,
          headers: { location: "http://127.0.0.1/private" },
          body: Buffer.alloc(0),
        })),
      },
    });
    assert.equal(result.status, "redirect_blocked");
  });

  it("blocks pages denied by robots.txt", async () => {
    const state = createPageRetrievalInvestigationState();
    const result = await retrievePublicPage({
      url: "https://example.com/secret",
      state,
      deps: {
        lookup,
        executePinnedRequest: withPageHandler(
          async () => ({
            statusCode: 200,
            headers: { "content-type": "text/html" },
            body: Buffer.from("<html/>"),
          }),
          "User-agent: *\nDisallow: /secret\nAllow: /\n",
        ),
      },
    });
    assert.equal(result.status, "blocked_robots");
    assert.equal(result.robotsAllowed, false);
  });

  it("sanitizes error messages without internal IP literals", async () => {
    const state = createPageRetrievalInvestigationState();
    const result = await retrievePublicPage({
      url: "https://example.com/policy",
      state,
      deps: {
        lookup,
        executePinnedRequest: async (input) => {
          if (input.url.pathname === "/robots.txt") {
            return {
              statusCode: 200,
              headers: { "content-type": "text/plain" },
              body: Buffer.from("User-agent: *\nAllow: /\n"),
            };
          }
          throw new Error("connect ECONNREFUSED 127.0.0.1:443");
        },
      },
    });
    assert.equal(result.status, "network_error");
    assert.doesNotMatch(result.errorMessage ?? "", /127\.0\.0\.1/);
  });

  it("prevents duplicate retrieval of the same URL", async () => {
    const state = createPageRetrievalInvestigationState();
    const executor = withPageHandler(async () => ({
      statusCode: 200,
      headers: { "content-type": "text/html" },
      body: Buffer.from("<html/>"),
    }));
    const deps = { lookup, executePinnedRequest: executor };
    const first = await retrievePublicPage({
      url: "https://example.com/once",
      state,
      deps,
    });
    assert.equal(first.status, "success");
    const second = await retrievePublicPage({
      url: "https://example.com/once",
      state,
      deps,
    });
    assert.equal(second.status, "duplicate_url");
  });

  it("enforces per-domain page limits after successful HTML retrievals", async () => {
    const state = createPageRetrievalInvestigationState();
    const deps = {
      lookup,
      executePinnedRequest: withPageHandler(async (input) => ({
        statusCode: 200,
        headers: { "content-type": "text/html" },
        body: Buffer.from(`<html>${input.url.pathname}</html>`),
      })),
    };

    for (let index = 0; index < 3; index += 1) {
      const result = await retrievePublicPage({
        url: `https://example.com/page-${index}`,
        state,
        maxPagesPerDomain: 3,
        deps,
      });
      assert.equal(result.status, "success");
    }

    const blocked = await retrievePublicPage({
      url: "https://example.com/page-3",
      state,
      maxPagesPerDomain: 3,
      deps,
    });
    assert.equal(blocked.status, "domain_page_limit");
  });
});
