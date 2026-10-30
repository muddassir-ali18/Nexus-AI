import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPublicIpAddress,
  resolvePublicAddresses,
  validateExternalResearchUrl,
} from "./url-safety";

describe("url safety", () => {
  it("allows public https URLs on port 443", () => {
    const result = validateExternalResearchUrl("https://example.com/path");
    assert.equal(result.ok, true);
    assert.equal(result.normalizedUrl, "https://example.com/path");
  });

  it("rejects non-http schemes and embedded credentials", () => {
    assert.equal(validateExternalResearchUrl("file:///etc/passwd").ok, false);
    assert.equal(
      validateExternalResearchUrl("https://user:pass@example.com/").ok,
      false,
    );
  });

  it("rejects unsafe ports", () => {
    const result = validateExternalResearchUrl("http://example.com:8080/");
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /8080/);
  });

  it("rejects metadata and loopback hostnames", () => {
    assert.equal(
      validateExternalResearchUrl("http://metadata.google.internal/").ok,
      false,
    );
    assert.equal(validateExternalResearchUrl("http://127.0.0.1/").ok, false);
    assert.equal(validateExternalResearchUrl("http://169.254.169.254/").ok, false);
  });

  it("rejects private, link-local, and ULA IP literals", () => {
    assert.equal(assertPublicIpAddress("10.0.0.1").ok, false);
    assert.equal(assertPublicIpAddress("192.168.1.4").ok, false);
    assert.equal(assertPublicIpAddress("169.254.100.2").ok, false);
    assert.equal(assertPublicIpAddress("8.8.8.8").ok, true);
    assert.equal(assertPublicIpAddress("::1").ok, false);
    assert.equal(assertPublicIpAddress("fe80::1").ok, false);
    assert.equal(assertPublicIpAddress("fd12:3456:789a:1::1").ok, false);
    assert.equal(assertPublicIpAddress("2001:4860:4860::8888").ok, true);
    assert.equal(assertPublicIpAddress("::ffff:127.0.0.1").ok, false);
  });

  it("filters DNS results to public addresses only", async () => {
    const lookup = async () => [
      { address: "127.0.0.1", family: 4 as const },
      { address: "93.184.216.34", family: 4 as const },
    ];
    const resolved = await resolvePublicAddresses("example.com", lookup);
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.deepEqual(resolved.addresses, [
        { address: "93.184.216.34", family: 4 },
      ]);
    }
  });

  it("blocks DNS that resolves only to private addresses", async () => {
    const lookup = async () => [{ address: "10.0.0.55", family: 4 as const }];
    const resolved = await resolvePublicAddresses("internal.example", lookup);
    assert.equal(resolved.ok, false);
    assert.match(resolved.reason ?? "", /private or reserved/i);
  });
});
