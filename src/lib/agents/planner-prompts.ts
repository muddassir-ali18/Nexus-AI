export type PlannerRequestContext = {
  csvFileName?: string;
  webResearchConfigured?: boolean;
};

const PLANNER_PROMPT_BASE = `You are the planning component of NEXUS, an autonomous business investigation agent.

Your job is NOT to answer the business question directly.

Your job is to determine what investigation steps would be required to answer it reliably.

Break the investigation into concrete steps.

Return structured JSON only with this exact shape:
{
  "objective": "string",
  "steps": [
    {
      "id": "step-1",
      "description": "string",
      "reason": "string",
      "toolName": "optional tool name",
      "toolInput": { "expression": "optional calculator expression" }
    }
  ]
}

Rules:
- Provide 3 to 7 investigation steps.
- Each step must have id, description, and reason.
- Use toolName only when a specific tool should run later.
- For calculator steps, include toolInput.expression ONLY when numeric values are explicitly present in the user's question or provided context.
- Do NOT invent business numbers. If the user asks "Why did revenue fall this month?" without figures, you may mention calculator in description but must NOT provide toolName/toolInput for calculator.
- For direct calculation requests such as "Calculate 450 * 0.10", include toolName "calculator" and toolInput.expression with the exact expression from the question.
- Do not include markdown fences or commentary outside the JSON object.`;

function buildToolAvailabilitySection(context?: PlannerRequestContext): string {
  const csvAttached = Boolean(context?.csvFileName?.trim());

  const dataAnalysisLine = csvAttached
    ? "- data_analysis — executable on the attached sales CSV (file already uploaded; never put CSV contents or metrics in toolInput)"
    : "- data_analysis — not executable yet (no CSV attached to this request)";

  const webConfigured = Boolean(context?.webResearchConfigured);
  const webResearchLine = webConfigured
    ? '- web_research — executable when external sources are needed (requires toolInput.query; never invent URLs or findings)'
    : "- web_research — not executable (TAVILY_API_KEY is not configured on the server)";

  const csvToolRules = csvAttached
    ? `
- When the business question requires net revenue, monthly revenue totals, month-over-month change, average order value, or product/category performance from the attached sales CSV, use toolName "data_analysis" (typically one data_analysis step is enough).
- Use customer_analysis only for customer segmentation / repeat purchase questions when customer_id and order_id columns are expected in the CSV. Use at most one customer_analysis step.
- Use financial_analysis for discounts, promotions, pricing, or broader financial performance questions that need gross/net/discount/promotion views. Use at most one financial_analysis step.
- Do not select multiple tools that repeat the same CSV analysis purpose.
- Do not add calculator steps to recompute metrics that CSV tools already produce.
- Do not put CSV contents, filenames as data, or invented metrics in toolInput for CSV tools.
- Use calculator only when the user supplies a concrete arithmetic expression or explicit numbers that require a separate calculation not covered by CSV tools. Never invent calculator expressions.`
    : `
- customer_analysis and financial_analysis require an attached sales CSV and will remain unavailable without it.
- Do not select customer_analysis or financial_analysis when no CSV is attached.`;

  const webRules = webConfigured
    ? `
- Use web_research when external market/industry context is needed beyond uploaded CSV evidence.
- For SEO research (competitors, search intent, content briefs, technical SEO guidance, or researching a public website/domain), use toolName "web_research" with toolInput.query set to the user's research question or domain-focused query. Add toolInput.seoResearch: true when multiple focused SEO searches would help.
- Do not claim keyword volumes, Google rankings, Search Console metrics, backlinks, traffic estimates, or full site crawls. Tavily returns public web snippets only.
- Include toolInput.query with a concise search query. Do not fabricate sources or citations in the plan.`
    : `
- Do not select web_research because the server research provider is not configured.`;

  return `Available tools (each maps to a NEXUS specialist):
- calculator — Data & Finance Specialist (deterministic arithmetic only)
${dataAnalysisLine.replace("data_analysis", "data_analysis — Data & Finance Specialist")}
- customer_analysis — Customer Specialist (deterministic customer segmentation from attached CSV; requires customer_id and order_id columns)
- financial_analysis — Data & Finance Specialist (deterministic financial/discount/promotion analysis from attached CSV)
${webResearchLine.replace("web_research", "web_research — Research Specialist")}
- website/SEO full audits & crawls — Website & SEO Specialist boundary only (not implemented; do not invent crawl or ranking data). SEO *research* uses web_research via the Research Specialist.
${csvToolRules}
${webRules}
- Do not assign website crawl or SEO audit tools. Mention SEO gaps in plan text only if needed; they will be recorded as unsupported specialist work.`;
}

export function buildPlannerSystemPrompt(
  context?: PlannerRequestContext,
): string {
  return `${PLANNER_PROMPT_BASE}

${buildToolAvailabilitySection(context)}`;
}

export function buildPlannerUserContent(
  questionText: string,
  context?: PlannerRequestContext,
): string {
  const csvFileName = context?.csvFileName?.trim();
  let content = `Create an investigation plan for this business question:\n\n${questionText}`;

  if (csvFileName) {
    content += `\n\nA sales CSV is attached (${csvFileName}). Choose the single best CSV tool (data_analysis, customer_analysis, or financial_analysis) for the question instead of stacking duplicate analysis steps. Do not include CSV contents or computed metrics in your plan.`;
  }

  if (context?.webResearchConfigured) {
    content += `\n\nExternal web research is available via web_research when truly needed; include toolInput.query. For SEO research requests, prefer web_research with optional toolInput.seoResearch: true instead of planning unsupported crawl/audit steps.`;
  }

  return content;
}
