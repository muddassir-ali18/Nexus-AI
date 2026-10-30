import { getNebiusModel } from "@/lib/ai/models";
import { isNebiusConfigured, NEBIUS_BASE_URL } from "@/lib/ai/nebius";
import { isWebResearchConfigured } from "@/lib/research/web-research-core";

export async function GET() {
  const nebiusConfigured = isNebiusConfigured();
  return Response.json({
    status: "ok",
    service: "nexus",
    nebius: {
      configured: nebiusConfigured,
      endpoint: NEBIUS_BASE_URL,
      model: nebiusConfigured ? getNebiusModel() : null,
    },
    tavily: {
      configured: isWebResearchConfigured(),
    },
  });
}
