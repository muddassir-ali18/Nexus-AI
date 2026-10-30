import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type PinnedHttpExecutor,
  safeHttpFetch,
} from "./safe-http-client";

describe("safe HTTP client", () => {
  it("pins requests to validated lookup addresses", async () => {
    const seenHosts: string[] = [];
    const executor: PinnedHttpExecutor = async (input) => {
      seenHosts.push(input.pinnedAddress.address);
      return {
        statusCode: 200,
        headers: { "content-type": "text/html" },
        body: Buffer.from("<html></html>"),
      };
    };

    const result = await safeHttpFetch({
      url: "https://example.com/",
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      executePinnedRequest: executor,
    });

    assert.equal(result.status, "success");
    assert.deepEqual(seenHosts, ["93.184.216.34"]);
    assert.equal(result.pinnedAddress, "93.184.216.34");
  });

  it("blocks when DNS resolves to private addresses (DNS rebinding defense)", async () => {
    const executor: PinnedHttpExecutor = async () => ({
      statusCode: 200,
      headers: {},
      body: Buffer.alloc(0),
    });

    const result = await safeHttpFetch({
      url: "https://rebind.example/",
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
      executePinnedRequest: executor,
    });

    assert.equal(result.status, "blocked_dns");
    assert.match(result.errorMessage ?? "", /private or reserved/i);
  });

  it("re-validates every redirect hop and blocks redirect to private hosts", async () => {
    let calls = 0;
    const executor: PinnedHttpExecutor = async (input) => {
      calls += 1;
      if (input.url.hostname === "example.com") {
        return {
          statusCode: 302,
          headers: { location: "http://127.0.0.1/private" },
          body: Buffer.alloc(0),
        };
      }
      return {
        statusCode: 200,
        headers: {},
        body: Buffer.alloc(0),
      };
    };

    const result = await safeHttpFetch({
      url: "https://example.com/start",
      lookup: async (hostname) => {
        if (hostname === "example.com") {
          return [{ address: "93.184.216.34", family: 4 }];
        }
        return [{ address: "127.0.0.1", family: 4 }];
      },
      executePinnedRequest: executor,
    });

    assert.equal(result.status, "blocked_redirect");
    assert.equal(calls, 1);
    assert.deepEqual(result.redirectChain, ["https://example.com/start"]);
  });

  it("re-resolves DNS on redirect and blocks rebinding on later hops", async () => {
    const lookupCalls: string[] = [];
    let requests = 0;
    const executor: PinnedHttpExecutor = async (input) => {
      requests += 1;
      if (input.url.hostname === "first.example") {
        return {
          statusCode: 302,
          headers: { location: "https://second.example/next" },
          body: Buffer.alloc(0),
        };
      }
      return {
        statusCode: 200,
        headers: {},
        body: Buffer.from("ok"),
      };
    };

    const result = await safeHttpFetch({
      url: "https://first.example/",
      lookup: async (hostname) => {
        lookupCalls.push(hostname);
        if (hostname === "first.example") {
          return [{ address: "93.184.216.34", family: 4 }];
        }
        return [{ address: "127.0.0.1", family: 4 }];
      },
      executePinnedRequest: executor,
    });

    assert.equal(result.status, "blocked_dns");
    assert.equal(requests, 1);
    assert.deepEqual(lookupCalls, ["first.example", "second.example"]);
  });

  it("follows safe redirects and records the redirect chain", async () => {
    const executor: PinnedHttpExecutor = async (input) => {
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
        body: Buffer.from("<html>ok</html>"),
      };
    };

    const result = await safeHttpFetch({
      url: "https://example.com/a",
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      executePinnedRequest: executor,
    });

    assert.equal(result.status, "success");
    assert.equal(result.finalUrl, "https://example.com/b");
    assert.deepEqual(result.redirectChain, [
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("enforces response size limits", async () => {
    const executor: PinnedHttpExecutor = async () => ({
      statusCode: 200,
      headers: {},
      body: Buffer.alloc(32),
    });

    const result = await safeHttpFetch({
      url: "https://example.com/large",
      maxResponseBytes: 8,
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      executePinnedRequest: executor,
    });

    assert.equal(result.status, "response_too_large");
  });
});
