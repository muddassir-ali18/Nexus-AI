import type { InvestigationToolAttachments } from "@/lib/agents/execute-investigation-tools";
import { validateBusinessQuestionText } from "@/lib/agents/question-validation";
import { buildValidatedCsvAttachment } from "@/lib/data/csv-upload";
import { NexusValidationError } from "@/lib/utils/errors";

export type ParsedInvestigateRequest = {
  question: string;
  attachments?: InvestigationToolAttachments;
};

function readContentType(request: Request): string {
  return (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ??
    ""
  );
}

function parseJsonInvestigateBody(body: unknown): ParsedInvestigateRequest {
  if (!body || typeof body !== "object") {
    throw new NexusValidationError("Request body must be a JSON object.");
  }

  const question = validateBusinessQuestionText(
    (body as { question?: unknown }).question,
  );

  return { question };
}

async function readMultipartInvestigateRequest(
  request: Request,
): Promise<ParsedInvestigateRequest> {
  const formData = await request.formData();
  const questionField = formData.get("question");
  if (questionField === null) {
    throw new NexusValidationError("Question is required.");
  }
  const question = validateBusinessQuestionText(questionField);

  const fileEntry = formData.get("file");
  if (fileEntry === null) {
    return { question };
  }

  if (!(fileEntry instanceof File)) {
    throw new NexusValidationError(
      "When provided, the file field must be a CSV upload.",
    );
  }

  const fileName = fileEntry.name?.trim() || "upload.csv";
  const buffer = await fileEntry.arrayBuffer();
  const csv = buildValidatedCsvAttachment(fileName, buffer);

  return {
    question,
    attachments: { csv },
  };
}

export async function parseInvestigateRequest(
  request: Request,
): Promise<ParsedInvestigateRequest> {
  const contentType = readContentType(request);

  if (contentType === "application/json") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new NexusValidationError("Request body must be valid JSON.");
    }
    return parseJsonInvestigateBody(body);
  }

  if (contentType === "multipart/form-data") {
    return readMultipartInvestigateRequest(request);
  }

  throw new NexusValidationError(
    "Unsupported Content-Type. Use application/json or multipart/form-data.",
  );
}
