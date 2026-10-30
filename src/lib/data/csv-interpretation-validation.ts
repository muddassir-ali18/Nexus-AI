import type { CsvInterpretation } from "@/lib/data/analysis-types";

const ROOT_CAUSE_CERTAINTY_PATTERN =
  /\b(proven|definitely caused|confirmed root cause|without doubt)\b/i;

export function validateCsvInterpretation(
  interpretation: CsvInterpretation,
): string | null {
  if (interpretation.summary.length > 2000) {
    return "AI interpretation summary exceeded the allowed length.";
  }

  if (ROOT_CAUSE_CERTAINTY_PATTERN.test(interpretation.summary)) {
    return "AI interpretation used unsupported certainty language.";
  }

  const normalizedFacts = new Set(
    interpretation.measuredFacts.map((item) => item.trim().toLowerCase()),
  );

  for (const explanation of interpretation.possibleExplanations) {
    if (normalizedFacts.has(explanation.trim().toLowerCase())) {
      return "AI interpretation duplicated a possible explanation as a measured fact.";
    }
    if (ROOT_CAUSE_CERTAINTY_PATTERN.test(explanation)) {
      return "AI interpretation used unsupported certainty language in possible explanations.";
    }
  }

  for (const fact of interpretation.measuredFacts) {
    if (ROOT_CAUSE_CERTAINTY_PATTERN.test(fact)) {
      return "AI interpretation used unsupported certainty language in measured facts.";
    }
  }

  return null;
}
