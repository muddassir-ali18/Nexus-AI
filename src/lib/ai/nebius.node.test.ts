import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_NEBIUS_MODEL,
  isNebiusConfigured,
  NEBIUS_BASE_URL,
  NEBIUS_CONFIG_ERROR_MESSAGE,
  resolveNebiusModel,
} from "./nebius-config-core";
import {
  getErrorStatusCode,
  getSafeErrorMessage,
  NexusConfigurationError,
} from "@/lib/utils/errors";

describe("nebius configuration", () => {
  it("uses Nebius Token Factory endpoint (not api.studio.nebius.com)", () => {
    assert.equal(NEBIUS_BASE_URL, "https://api.tokenfactory.nebius.com/v1/");
    assert.doesNotMatch(NEBIUS_BASE_URL, /api\.studio\.nebius\.com/);
  });

  it("reports unconfigured when NEBIUS_API_KEY is absent", () => {
    assert.equal(isNebiusConfigured({}), false);
    assert.equal(isNebiusConfigured({ NEBIUS_API_KEY: "   " }), false);
    assert.equal(isNebiusConfigured({ NEBIUS_API_KEY: "key" }), true);
  });

  it("returns configuration errors safely without echoing secrets", () => {
    const error = new NexusConfigurationError(NEBIUS_CONFIG_ERROR_MESSAGE);
    assert.equal(getErrorStatusCode(error), 503);
    const message = getSafeErrorMessage(error);
    assert.match(message, /NEBIUS_API_KEY/);
    assert.doesNotMatch(message, /Bearer/);
  });

  it("defaults Nemotron model when NEBIUS_MODEL is unset", () => {
    assert.equal(resolveNebiusModel({}), DEFAULT_NEBIUS_MODEL);
    assert.equal(
      resolveNebiusModel({ NEBIUS_MODEL: "custom/model" }),
      "custom/model",
    );
  });
});
