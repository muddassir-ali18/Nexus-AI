import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { CSV_MAX_BYTES } from "@/lib/data/analysis-types";
import { parseInvestigateRequest } from "./investigate-request";

const sampleCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/samples/nexus-synthetic-sales-demo.csv",
);

function loadSampleCsvBuffer(): Buffer {
  return readFileSync(sampleCsvPath);
}

describe("parseInvestigateRequest", () => {
  it("parses JSON calculator-style requests without attachments", async () => {
    const request = new Request("http://localhost/api/investigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Calculate 450 * 0.10" }),
    });

    const parsed = await parseInvestigateRequest(request);

    assert.equal(parsed.question, "Calculate 450 * 0.10");
    assert.equal(parsed.attachments, undefined);
  });

  it("parses multipart question with a valid sample CSV attachment", async () => {
    const formData = new FormData();
    formData.append("question", "What is net revenue in the uploaded sales data?");
    formData.append(
      "file",
      new Blob([loadSampleCsvBuffer() as BlobPart], { type: "text/csv" }),
      "nexus-synthetic-sales-demo.csv",
    );

    const request = new Request("http://localhost/api/investigate", {
      method: "POST",
      body: formData,
    });

    const parsed = await parseInvestigateRequest(request);

    assert.equal(
      parsed.question,
      "What is net revenue in the uploaded sales data?",
    );
    assert.ok(parsed.attachments?.csv);
    assert.equal(
      parsed.attachments.csv.fileName,
      "nexus-synthetic-sales-demo.csv",
    );
    assert.ok(parsed.attachments.csv.buffer.byteLength > 0);
  });

  it("rejects multipart requests without a question", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([loadSampleCsvBuffer() as BlobPart], { type: "text/csv" }),
      "demo.csv",
    );

    const request = new Request("http://localhost/api/investigate", {
      method: "POST",
      body: formData,
    });

    await assert.rejects(
      () => parseInvestigateRequest(request),
      /Question is required/,
    );
  });

  it("rejects invalid file extensions", async () => {
    const formData = new FormData();
    formData.append("question", "Analyze revenue");
    formData.append(
      "file",
      new Blob(["a,b\n1,2"], { type: "text/plain" }),
      "data.txt",
    );

    const request = new Request("http://localhost/api/investigate", {
      method: "POST",
      body: formData,
    });

    await assert.rejects(
      () => parseInvestigateRequest(request),
      /Only \.csv files are supported/,
    );
  });

  it("rejects oversized CSV uploads", async () => {
    const oversized = new Uint8Array(CSV_MAX_BYTES + 1);
    const formData = new FormData();
    formData.append("question", "Analyze revenue");
    formData.append(
      "file",
      new Blob([oversized], { type: "text/csv" }),
      "large.csv",
    );

    const request = new Request("http://localhost/api/investigate", {
      method: "POST",
      body: formData,
    });

    await assert.rejects(
      () => parseInvestigateRequest(request),
      /5 MB upload limit/,
    );
  });

  it("rejects malformed CSV content", async () => {
    const formData = new FormData();
    formData.append("question", "Analyze revenue");
    formData.append(
      "file",
      new Blob(["not,a,valid,sales,csv\n"], { type: "text/csv" }),
      "broken.csv",
    );

    const request = new Request("http://localhost/api/investigate", {
      method: "POST",
      body: formData,
    });

    await assert.rejects(() => parseInvestigateRequest(request));
  });

  it("allows multipart requests without a file field", async () => {
    const formData = new FormData();
    formData.append("question", "Why did revenue fall this month?");

    const request = new Request("http://localhost/api/investigate", {
      method: "POST",
      body: formData,
    });

    const parsed = await parseInvestigateRequest(request);

    assert.equal(parsed.question, "Why did revenue fall this month?");
    assert.equal(parsed.attachments, undefined);
  });

  it("rejects unsupported content types", async () => {
    const request = new Request("http://localhost/api/investigate", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "question=hello",
    });

    await assert.rejects(
      () => parseInvestigateRequest(request),
      /Unsupported Content-Type/,
    );
  });
});
