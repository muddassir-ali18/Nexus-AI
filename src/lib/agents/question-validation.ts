import { MAX_QUESTION_LENGTH } from "@/lib/agents/types";
import { NexusValidationError } from "@/lib/utils/errors";

export function validateBusinessQuestionText(question: unknown): string {
  if (typeof question !== "string") {
    throw new NexusValidationError("Question must be a string.");
  }

  const trimmed = question.trim();
  if (!trimmed) {
    throw new NexusValidationError("Question is required.");
  }

  if (trimmed.length > MAX_QUESTION_LENGTH) {
    throw new NexusValidationError(
      `Question must be at most ${MAX_QUESTION_LENGTH} characters.`,
    );
  }

  return trimmed;
}
