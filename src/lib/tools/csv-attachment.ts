import type { CsvAttachment, ToolContext } from "@/lib/tools/types";

export class CsvAttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvAttachmentError";
  }
}

export function getCsvAttachment(context: ToolContext): CsvAttachment {
  const attachment = context.attachments?.csv;
  if (!attachment) {
    throw new CsvAttachmentError(
      "Sales CSV attachment is required in request context. Attach a CSV file to run this tool.",
    );
  }

  if (typeof attachment.fileName !== "string" || !attachment.fileName.trim()) {
    throw new CsvAttachmentError("CSV attachment filename is missing.");
  }

  if (!(attachment.buffer instanceof ArrayBuffer)) {
    throw new CsvAttachmentError("CSV attachment buffer is invalid.");
  }

  if (attachment.buffer.byteLength === 0) {
    throw new CsvAttachmentError("The attached CSV file is empty.");
  }

  return {
    fileName: attachment.fileName.trim(),
    buffer: attachment.buffer,
  };
}
