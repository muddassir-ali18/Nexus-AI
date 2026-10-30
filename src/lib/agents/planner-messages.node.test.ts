import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPlannerSystemPrompt,
  buildPlannerUserContent,
} from "./planner-prompts";

describe("planner attachment messaging", () => {
  it("marks data_analysis executable when a CSV is attached", () => {
    const prompt = buildPlannerSystemPrompt({
      csvFileName: "sales.csv",
    });

    assert.match(
      prompt,
      /data_analysis — Data & Finance Specialist — executable on the attached sales CSV/,
    );
    assert.doesNotMatch(prompt, /not executable yet \(no CSV attached/);
  });

  it("keeps data_analysis unavailable without an attachment", () => {
    const prompt = buildPlannerSystemPrompt();

    assert.match(
      prompt,
      /data_analysis — Data & Finance Specialist — not executable yet/,
    );
  });

  it("marks web_research executable when configured", () => {
    const prompt = buildPlannerSystemPrompt({
      webResearchConfigured: true,
    });
    assert.match(prompt, /web_research — Research Specialist — executable/);
  });

  it("marks web_research unavailable without provider configuration", () => {
    const prompt = buildPlannerSystemPrompt({
      webResearchConfigured: false,
    });
    assert.match(prompt, /TAVILY_API_KEY is not configured/);
  });

  it("adds a concise attachment hint to the user message without CSV contents", () => {
    const content = buildPlannerUserContent("What is net revenue?", {
      csvFileName: "sales.csv",
    });

    assert.match(content, /A sales CSV is attached \(sales\.csv\)/);
    assert.match(content, /Choose the single best CSV tool/);
    assert.match(content, /customer_analysis/);
    assert.doesNotMatch(content, /SYN-1001/);
    assert.doesNotMatch(content, /3143/);
  });
});
