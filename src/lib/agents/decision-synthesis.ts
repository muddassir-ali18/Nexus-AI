import "server-only";

import {
  buildSynthesisModelPayload,
  createInsufficientEvidenceDecision,
  extractJsonObject,
  hasUsableInvestigationEvidence,
  parseDecisionSynthesisResult,
  validateDecisionSynthesis,
  type SynthesisModelInput,
} from "@/lib/agents/decision-synthesis-core";
import type { DecisionSynthesisOutcome } from "@/lib/agents/decision-synthesis-types";
import { createNebiusClient, isNebiusConfigured } from "@/lib/ai/nebius";
import { NexusProviderError } from "@/lib/utils/errors";

const DECISION_SYNTHESIS_SYSTEM_PROMPT = `You are the decision synthesis component of NEXUS, an autonomous business investigation agent.

You receive a business question, tool execution summaries, and deterministic evidence collected during an investigation.

Your job:
1. Answer the user's question concisely using ONLY the supplied evidence and tool results.
2. Explain your reasoning with evidence-grounded statements.
3. State limitations, uncertainty, and missing information honestly.
4. Recommend a small number of practical next actions.

Rules:
- Never invent revenue figures, percentages, dates, row counts, calculations, sources, or tool outcomes.
- Use evidence values exactly as provided. Do not recalculate or contradict deterministic tool results.
- Distinguish measured facts (from evidence) from hypotheses. Label hypotheses explicitly in recommended action basis when evidence is incomplete.
- Lower confidence when evidence is partial, pending tools exist, or failed tools exist.
- Do not claim NEXUS or the user has already executed recommended actions (no emails sent, purchases made, or systems changed).
- Reference evidence by id when citing a specific item.
- Keep output concise: at most 5 recommended actions.
- For SEO competitor research: use seoResearchReports verification labels (verified = fully verified with official site + explicit geography from search snippets; partially verified / unverified otherwise). Respect per-competitor flags officialWebsiteIdentified, chennaiPresenceSupported, servicesPubliclyDocumented, and evidenceLimitations. Never claim all requested competitors are fully verified unless seoResearchReports.verifiedCount supports it. Directory listings are discovery-only and do not prove official sites. Never invent traffic, rankings, keyword volumes, backlinks, legal entity confirmation, or technical audit results. Label hypotheses explicitly when not directly supported by evidence.

Return structured JSON only:
{
  "decision": {
    "summary": "string",
    "reasoning": ["string"],
    "confidence": "high | medium | low",
    "limitations": ["string"]
  },
  "recommendedActions": [
    {
      "title": "string",
      "description": "string",
      "priority": "high | medium | low",
      "basis": "string"
    }
  ]
}`;

export async function synthesizeInvestigationDecision(
  input: SynthesisModelInput,
): Promise<DecisionSynthesisOutcome> {
  if (!hasUsableInvestigationEvidence(input.evidence)) {
    return {
      synthesis: createInsufficientEvidenceDecision(
        input.question,
        input.pendingTools,
      ),
      error: null,
    };
  }

  if (!isNebiusConfigured()) {
    return {
      synthesis: null,
      error:
        "Decision synthesis is unavailable because NEBIUS_API_KEY is not configured.",
    };
  }

  try {
    const client = createNebiusClient();
    const response = await client.chat({
      messages: [
        { role: "system", content: DECISION_SYNTHESIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Synthesize an evidence-grounded decision for this investigation:\n\n${buildSynthesisModelPayload(input)}`,
        },
      ],
      temperature: 0.2,
    });

    const parsed = parseDecisionSynthesisResult(
      extractJsonObject(response.content),
    );
    if (!parsed) {
      return {
        synthesis: null,
        error: "Nemotron returned an invalid decision synthesis structure.",
      };
    }

    const validationError = validateDecisionSynthesis(parsed, input.evidence);
    if (validationError) {
      return {
        synthesis: null,
        error: validationError,
      };
    }

    return { synthesis: parsed, error: null };
  } catch (error) {
    if (error instanceof NexusProviderError) {
      return { synthesis: null, error: error.message };
    }
    if (error instanceof Error) {
      return { synthesis: null, error: error.message };
    }
    return {
      synthesis: null,
      error: "Decision synthesis failed.",
    };
  }
}
