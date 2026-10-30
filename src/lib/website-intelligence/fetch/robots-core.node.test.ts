import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createRobotsInvestigationCache,
  evaluateRobotsPermission,
  loadRobotsPolicyForOrigin,
  parseRobotsTxt,
  pathMatchesRule,
  resolveRobotsPathPermission,
} from "./robots-core";
import type { PinnedHttpExecutor } from "./safe-http-client";

function mockExecutor(
  routes: Record<string, { status: number; body: string; headers?: Record<string, string> }>,
): PinnedHttpExecutor {
  return async (input) => {
    const key = input.url.pathname === "/robots.txt" ? `${input.url.origin}/robots.txt` : input.url.toString();
    const route = routes[key] ?? routes[input.url.toString()] ?? routes[`${input.url.origin}/robots.txt`];
    if (!route) {
      throw new Error(`Unexpected URL ${input.url.toString()}`);
    }
    return {
      statusCode: route.status,
      headers: route.headers ?? { "content-type": "text/plain" },
      body: Buffer.from(route.body),
    };
  };
}

describe("robots core", () => {
  it("parses allow and disallow rules for user-agent groups", () => {
    const groups = parseRobotsTxt(`
User-agent: *
Disallow: /private/
Allow: /private/public
`);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.rules.length, 2);
  });

  it("applies longest-match precedence between allow and disallow", () => {
    const resolved = resolveRobotsPathPermission({
      path: "/private/public/page",
      rules: [
        { type: "disallow", path: "/private/" },
        { type: "allow", path: "/private/public" },
      ],
    });
    assert.equal(resolved.allowed, true);
    assert.match(resolved.matchedRule ?? "", /allow/i);
  });

  it("supports wildcard patterns", () => {
    assert.equal(pathMatchesRule("/secret/*.pdf", "/secret/a.pdf"), true);
    assert.equal(pathMatchesRule("/secret/*.pdf", "/secret/a.txt"), false);
  });

  it("supports end-anchor patterns", () => {
    assert.equal(pathMatchesRule("/*.pdf$", "/reports/q1.pdf"), true);
    assert.equal(pathMatchesRule("/*.pdf$", "/reports/q1.pdf/extra"), false);
  });

  it("permits explicitly allowed paths", async () => {
    const cache = createRobotsInvestigationCache();
    const decision = await evaluateRobotsPermission({
      pageUrl: "https://example.com/public/page",
      cache,
      deps: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        executePinnedRequest: mockExecutor({
          "https://example.com/robots.txt": {
            status: 200,
            body: "User-agent: *\nAllow: /public/\nDisallow: /\n",
          },
        }),
      },
    });
    assert.equal(decision.allowed, true);
    assert.match(decision.reason, /Allow/i);
  });

  it("denies explicitly disallowed paths", async () => {
    const cache = createRobotsInvestigationCache();
    const decision = await evaluateRobotsPermission({
      pageUrl: "https://example.com/admin",
      cache,
      deps: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        executePinnedRequest: mockExecutor({
          "https://example.com/robots.txt": {
            status: 200,
            body: "User-agent: *\nDisallow: /admin\nAllow: /\n",
          },
        }),
      },
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /Disallow/i);
  });

  it("denies crawling when robots.txt is missing (404)", async () => {
    const cache = createRobotsInvestigationCache();
    const decision = await evaluateRobotsPermission({
      pageUrl: "https://example.com/page",
      cache,
      deps: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        executePinnedRequest: mockExecutor({
          "https://example.com/robots.txt": { status: 404, body: "" },
        }),
      },
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /missing/i);
  });

  it("denies crawling when robots.txt is unreachable", async () => {
    const cache = createRobotsInvestigationCache();
    const executor: PinnedHttpExecutor = async () => {
      throw new Error("timeout");
    };
    const decision = await evaluateRobotsPermission({
      pageUrl: "https://example.com/page",
      cache,
      deps: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        executePinnedRequest: executor,
      },
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /unreachable/i);
  });

  it("denies crawling when robots.txt is invalid", async () => {
    const cache = createRobotsInvestigationCache();
    const decision = await evaluateRobotsPermission({
      pageUrl: "https://example.com/page",
      cache,
      deps: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        executePinnedRequest: mockExecutor({
          "https://example.com/robots.txt": { status: 200, body: "   \n" },
        }),
      },
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /empty or invalid/i);
  });

  it("does not treat HTTP 500 on robots.txt as permission to crawl", async () => {
    const cache = createRobotsInvestigationCache();
    const decision = await evaluateRobotsPermission({
      pageUrl: "https://example.com/page",
      cache,
      deps: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        executePinnedRequest: mockExecutor({
          "https://example.com/robots.txt": { status: 500, body: "error" },
        }),
      },
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /HTTP 500/i);
  });

  it("denies when robots.txt fetch hits an unsafe redirect", async () => {
    const cache = createRobotsInvestigationCache();
    const executor: PinnedHttpExecutor = async (input) => {
      if (input.url.pathname === "/robots.txt") {
        return {
          statusCode: 302,
          headers: { location: "http://127.0.0.1/robots.txt" },
          body: Buffer.alloc(0),
        };
      }
      throw new Error("unexpected");
    };
    const decision = await evaluateRobotsPermission({
      pageUrl: "https://example.com/page",
      cache,
      deps: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        executePinnedRequest: executor,
      },
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /could not be retrieved safely/i);
  });

  it("caches robots policies per origin within the investigation", async () => {
    const cache = createRobotsInvestigationCache();
    let calls = 0;
    const executor: PinnedHttpExecutor = async (input) => {
      if (input.url.pathname === "/robots.txt") {
        calls += 1;
        return {
          statusCode: 200,
          headers: { "content-type": "text/plain" },
          body: Buffer.from("User-agent: *\nAllow: /\n"),
        };
      }
      throw new Error("unexpected");
    };

    await loadRobotsPolicyForOrigin("https://example.com", cache, {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      executePinnedRequest: executor,
    });
    await evaluateRobotsPermission({
      pageUrl: "https://example.com/a",
      cache,
      deps: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        executePinnedRequest: executor,
      },
    });
    await evaluateRobotsPermission({
      pageUrl: "https://example.com/b",
      cache,
      deps: {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        executePinnedRequest: executor,
      },
    });
    assert.equal(calls, 1);
  });
});
