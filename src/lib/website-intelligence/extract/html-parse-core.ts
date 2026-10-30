import { parse, type HTMLElement } from "node-html-parser";

const STRIP_TAG_NAMES = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "template",
]);

export type ParsedHtmlDocument = {
  root: HTMLElement;
  isEmpty: boolean;
};

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function parseHtmlDocument(html: string): ParsedHtmlDocument {
  const trimmed = html.trim();
  if (!trimmed) {
    const root = parse("<html><body></body></html>");
    return { root, isEmpty: true };
  }

  const root = parse(trimmed, {
    lowerCaseTagName: true,
    comment: false,
    blockTextElements: {
      script: true,
      noscript: true,
      style: true,
      pre: true,
    },
  });

  stripNonContentSubtrees(root);
  const body = (root.querySelector("body") ?? root) as HTMLElement;
  return {
    root,
    isEmpty: normalizeWhitespace(body.text ?? "").length === 0,
  };
}

function stripNonContentSubtrees(node: HTMLElement): void {
  const children = [...node.childNodes];
  for (const child of children) {
    if (child.nodeType !== 1) {
      continue;
    }
    const element = child as HTMLElement;
    const tag = element.tagName?.toLowerCase() ?? "";
    if (STRIP_TAG_NAMES.has(tag)) {
      element.remove();
      continue;
    }
    stripNonContentSubtrees(element);
  }
}

export function elementTextContent(element: HTMLElement): string {
  return normalizeWhitespace(element.text);
}

export function isHiddenElement(element: HTMLElement): boolean {
  if (element.hasAttribute("hidden")) {
    return true;
  }
  if (element.getAttribute("aria-hidden")?.toLowerCase() === "true") {
    return true;
  }
  const style = element.getAttribute("style")?.toLowerCase() ?? "";
  if (/\bdisplay\s*:\s*none\b/.test(style) || /\bvisibility\s*:\s*hidden\b/.test(style)) {
    return true;
  }
  const type = element.getAttribute("type")?.toLowerCase();
  if (element.tagName?.toLowerCase() === "input" && type === "hidden") {
    return true;
  }
  return false;
}

function textFromNode(node: { rawText?: string; text?: string }): string {
  return normalizeWhitespace(String(node.rawText ?? node.text ?? ""));
}

function visibleTextRoot(element: HTMLElement): HTMLElement {
  const tag = element.tagName?.toLowerCase();
  if (tag === "html") {
    return (element.querySelector("body") ?? element) as HTMLElement;
  }
  if (!tag) {
    const body = element.querySelector("body");
    if (body) {
      return body as HTMLElement;
    }
    const html = element.querySelector("html");
    if (html) {
      return (html.querySelector("body") ?? html) as HTMLElement;
    }
  }
  return element;
}

export function collectVisibleText(element: HTMLElement): string {
  const target = visibleTextRoot(element);

  if (isHiddenElement(target)) {
    return "";
  }

  const parts: string[] = [];

  function walk(node: HTMLElement) {
    if (isHiddenElement(node)) {
      return;
    }
    const tag = node.tagName?.toLowerCase() ?? "";
    if (STRIP_TAG_NAMES.has(tag)) {
      return;
    }
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const text = textFromNode(child as { rawText?: string; text?: string });
        if (text) {
          parts.push(text);
        }
      } else if (child.nodeType === 1) {
        walk(child as HTMLElement);
      }
    }
  }

  walk(target);
  const joined = normalizeWhitespace(parts.join(" "));
  if (joined) {
    return joined;
  }
  return normalizeWhitespace(target.text ?? "");
}
