export type DecisionConfidenceLevel = "high" | "medium" | "low";

export type InvestigationDecision = {
  summary: string;
  reasoning: string[];
  confidence: DecisionConfidenceLevel;
  limitations: string[];
};

export type SynthesizedRecommendedAction = {
  title: string;
  description: string;
  priority: DecisionConfidenceLevel;
  basis: string;
};

export type DecisionSynthesisResult = {
  decision: InvestigationDecision;
  recommendedActions: SynthesizedRecommendedAction[];
};

export type DecisionSynthesisOutcome = {
  synthesis: DecisionSynthesisResult | null;
  error: string | null;
};
