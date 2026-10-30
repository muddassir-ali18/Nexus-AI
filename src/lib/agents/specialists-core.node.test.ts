import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listSpecialistDefinitions,
  resolveSpecialistForTool,
  selectSpecialistForStep,
  specialistPermitsTool,
} from "./specialists-core";

describe("specialists registry", () => {
  it("defines four specialists with permitted tools", () => {
    const specialists = listSpecialistDefinitions();
    assert.equal(specialists.length, 4);

    const research = specialists.find((item) => item.id === "research");
    assert.deepEqual(research?.permittedTools, ["web_research"]);

    const dataFinance = specialists.find((item) => item.id === "data_finance");
    assert.ok(dataFinance?.permittedTools.includes("data_analysis"));
    assert.ok(dataFinance?.permittedTools.includes("financial_analysis"));
    assert.ok(dataFinance?.permittedTools.includes("calculator"));

    const customer = specialists.find((item) => item.id === "customer");
    assert.deepEqual(customer?.permittedTools, ["customer_analysis"]);

    const website = specialists.find((item) => item.id === "website_seo");
    assert.deepEqual(website?.permittedTools, []);
    assert.match(website?.capabilityNote ?? "", /not implemented/i);
    assert.match(website?.capabilityNote ?? "", /Tavily/i);
  });

  it("maps registered tools to the correct specialist", () => {
    assert.equal(resolveSpecialistForTool("web_research")?.id, "research");
    assert.equal(
      resolveSpecialistForTool("financial_analysis")?.id,
      "data_finance",
    );
    assert.equal(
      resolveSpecialistForTool("customer_analysis")?.id,
      "customer",
    );
    assert.equal(specialistPermitsTool("customer", "customer_analysis"), true);
    assert.equal(specialistPermitsTool("customer", "calculator"), false);
  });

  it("flags missing CSV prerequisites for data specialists", () => {
    const selection = selectSpecialistForStep(
      {
        id: "step-1",
        description: "Analyze CSV revenue",
        reason: "Need net revenue.",
        toolName: "data_analysis",
      },
      { csvAttached: false, webResearchConfigured: true },
    );

    assert.equal(selection?.specialist.id, "data_finance");
    assert.equal(selection?.assignmentStatus, "pending_prerequisites");
  });

  it("records website SEO audit/crawl steps as unsupported", () => {
    const selection = selectSpecialistForStep(
      {
        id: "step-seo",
        description: "Run a full website SEO audit",
        reason: "Need crawl coverage.",
      },
      { csvAttached: true, webResearchConfigured: true },
    );

    assert.equal(selection?.specialist.id, "website_seo");
    assert.equal(selection?.assignmentStatus, "unsupported");
  });

  it("routes SEO research steps to the research specialist", () => {
    const selection = selectSpecialistForStep(
      {
        id: "step-seo-research",
        description: "Research competitor SEO content positioning",
        reason: "Need external sources.",
        toolName: "web_research",
        toolInput: { query: "competitor SEO content SaaS" },
      },
      { csvAttached: false, webResearchConfigured: true },
    );

    assert.equal(selection?.specialist.id, "research");
    assert.equal(selection?.assignmentStatus, "assigned");
    assert.equal(selection?.taskType, "external_research");
  });
});
