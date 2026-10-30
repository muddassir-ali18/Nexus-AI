import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInvestigateFetchRequest,
  validateClientCsvSelection,
} from "./investigate-client";

describe("buildInvestigateFetchRequest", () => {
  it("uses JSON when no CSV attachment is provided", () => {
    const built = buildInvestigateFetchRequest({
      question: "Calculate 450 * 0.10",
    });

    assert.equal(built.mode, "json");
    assert.equal(built.init.method, "POST");
    assert.deepEqual(built.init.headers, {
      "Content-Type": "application/json",
    });
    assert.equal(
      built.init.body,
      JSON.stringify({ question: "Calculate 450 * 0.10" }),
    );
  });

  it("uses the replaced CSV file when attachment changes", () => {
    const replaced = new File(["b,c\n1,2"], "replacement.csv", {
      type: "text/csv",
    });
    const built = buildInvestigateFetchRequest({
      question: "What changed?",
      csvFile: replaced,
    });

    const formData = built.init.body as FormData;
    const file = formData.get("file");
    assert.ok(file instanceof File);
    assert.equal(file.name, "replacement.csv");
  });

  it("uses multipart form data when a CSV file is attached", () => {
    const csvFile = new File(["a,b\n1,2"], "demo.csv", { type: "text/csv" });
    const built = buildInvestigateFetchRequest({
      question: "What is net revenue?",
      csvFile,
    });

    assert.equal(built.mode, "multipart");
    assert.equal(built.init.method, "POST");
    assert.equal(built.init.headers, undefined);
    assert.ok(built.init.body instanceof FormData);

    const formData = built.init.body as FormData;
    assert.equal(formData.get("question"), "What is net revenue?");
    assert.ok(formData.get("file") instanceof File);
  });
});

describe("validateClientCsvSelection", () => {
  it("accepts .csv files", () => {
    const file = new File(["x"], "sales.csv", { type: "text/csv" });
    assert.equal(validateClientCsvSelection(file), null);
  });

  it("rejects missing and non-csv files", () => {
    assert.match(validateClientCsvSelection(null) ?? "", /Select a CSV/);
    assert.match(
      validateClientCsvSelection(new File(["x"], "data.txt", { type: "text/plain" })) ?? "",
      /Only \.csv files/,
    );
  });
});
