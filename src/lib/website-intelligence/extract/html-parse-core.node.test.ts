import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectVisibleText,
  parseHtmlDocument,
} from "./html-parse-core";

describe("html parse core", () => {
  it("parses valid HTML and excludes script/style content", () => {
    const { root } = parseHtmlDocument(`
      <html><head><title>T</title></head>
      <body><h1>Hello</h1><script>alert(1)</script><style>.x{}</style></body></html>
    `);
    const text = collectVisibleText(root);
    assert.match(text, /Hello/);
    assert.doesNotMatch(text, /alert/);
  });

  it("parses XHTML-style documents", () => {
    const { root, isEmpty } = parseHtmlDocument(`
      <?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>XHTML</p></body></html>
    `);
    assert.equal(isEmpty, false);
    assert.match(collectVisibleText(root), /XHTML/);
  });

  it("handles malformed HTML gracefully", () => {
    const { root } = parseHtmlDocument("<html><body><p>Broken<div>Still text</body>");
    assert.match(collectVisibleText(root), /Still text/);
  });

  it("handles empty documents", () => {
    const { isEmpty } = parseHtmlDocument("   ");
    assert.equal(isEmpty, true);
  });

  it("excludes hidden elements from visible text", () => {
    const { root } = parseHtmlDocument(`
      <html><body><p>Visible</p><p hidden>Secret</p><p style="display:none">Ghost</p></body></html>
    `);
    const text = collectVisibleText(root);
    assert.match(text, /Visible/);
    assert.doesNotMatch(text, /Secret/);
    assert.doesNotMatch(text, /Ghost/);
  });
});
