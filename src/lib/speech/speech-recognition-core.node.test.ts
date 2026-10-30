import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapSpeechRecognitionError,
  shouldIgnoreSpeechErrorAfterUserStop,
  mergeSpeechTranscript,
  resolveDefaultSpeechLanguage,
  shouldIgnoreSpeechError,
} from "./speech-recognition-core";

describe("speech recognition core", () => {
  it("merges transcripts without duplicating existing text", () => {
    assert.equal(
      mergeSpeechTranscript("Analyze SEO trends", "for retail"),
      "Analyze SEO trends for retail",
    );
    assert.equal(
      mergeSpeechTranscript("Analyze SEO trends", "Analyze SEO trends"),
      "Analyze SEO trends",
    );
    assert.equal(mergeSpeechTranscript("", "Hello world"), "Hello world");
  });

  it("resolves language from navigator fallback", () => {
    assert.equal(resolveDefaultSpeechLanguage(undefined, "en-GB"), "en-GB");
    assert.equal(resolveDefaultSpeechLanguage("fr-FR", "en-GB"), "fr-FR");
  });

  it("maps permission and no-speech errors", () => {
    assert.match(mapSpeechRecognitionError("not-allowed"), /permission/i);
    assert.match(mapSpeechRecognitionError("no-speech"), /No speech/i);
    assert.equal(shouldIgnoreSpeechError("aborted"), true);
    assert.equal(
      shouldIgnoreSpeechErrorAfterUserStop("network", true),
      true,
    );
    assert.equal(
      shouldIgnoreSpeechErrorAfterUserStop("network", false),
      false,
    );
  });
});
