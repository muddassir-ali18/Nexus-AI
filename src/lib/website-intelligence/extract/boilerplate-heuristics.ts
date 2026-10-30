import type { HTMLElement } from "node-html-parser";

import { normalizeWhitespace } from "./html-parse-core";

export type BoilerplateSplit = {
  mainRoot: HTMLElement;
  removedRegions: string[];
  notes: string[];
};

const BOILERPLATE_SELECTOR_HINTS = [
  "nav",
  "footer",
  "header[role='banner']",
  "aside",
  "[role='navigation']",
  "[role='contentinfo']",
  "[id*='cookie']",
  "[class*='cookie']",
  "[class*='sidebar']",
  "[id*='sidebar']",
];

function nodeContains(ancestor: HTMLElement, node: HTMLElement): boolean {
  let current: HTMLElement | null = node;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = (current.parentNode as HTMLElement | null) ?? null;
  }
  return false;
}

function describeElement(element: HTMLElement): string {
  const tag = element.tagName?.toLowerCase() ?? "element";
  const id = element.getAttribute("id");
  const className = element.getAttribute("class");
  if (id) {
    return `<${tag} id="${id}">`;
  }
  if (className) {
    return `<${tag} class="${className.split(/\s+/).slice(0, 2).join(" ")}">`;
  }
  return `<${tag}>`;
}

export function applyBoilerplateHeuristics(documentRoot: HTMLElement): BoilerplateSplit {
  const removedRegions: string[] = [];
  const notes: string[] = [
    "Boilerplate removal uses tag/role/class/id heuristics; excluded regions are documented and not silently dropped from the raw text snapshot.",
  ];

  const mainCandidate =
    documentRoot.querySelector("main") ??
    documentRoot.querySelector("[role='main']") ??
    documentRoot.querySelector("article") ??
    documentRoot;

  if (mainCandidate !== documentRoot) {
    notes.push("Primary content taken from main/article landmark when present.");
  }

  for (const selector of BOILERPLATE_SELECTOR_HINTS) {
    for (const element of documentRoot.querySelectorAll(selector)) {
      if (nodeContains(mainCandidate, element as HTMLElement) && mainCandidate !== element) {
        continue;
      }
      if (element === mainCandidate) {
        continue;
      }
      const label = describeElement(element as HTMLElement);
      if (!removedRegions.includes(label)) {
        removedRegions.push(label);
      }
      element.remove();
    }
  }

  return {
    mainRoot: mainCandidate as HTMLElement,
    removedRegions,
    notes,
  };
}

export function extractMainVisibleText(documentRoot: HTMLElement): {
  rawVisibleText: string;
  mainVisibleText: string;
  boilerplate: BoilerplateSplit;
} {
  const body = (documentRoot.querySelector("body") ?? documentRoot) as HTMLElement;
  const rawVisibleText = normalizeWhitespace(body.text ?? "");
  const boilerplate = applyBoilerplateHeuristics(body);
  const mainVisibleText = normalizeWhitespace(boilerplate.mainRoot.text ?? "");
  return { rawVisibleText, mainVisibleText, boilerplate };
}
