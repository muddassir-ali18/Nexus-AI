import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeFinancialCsv } from "./csv-financial-analysis";

function csvBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe("analyzeFinancialCsv", () => {
  it("includes discount and promotion evidence when columns exist", () => {
    const csv = `order_id,order_date,revenue,discount,promotion
O1,2026-01-01,100,10,SALE10
O2,2026-01-02,50,5,SALE10
O3,2026-01-03,-20,0,
`;
    const result = analyzeFinancialCsv("financial.csv", csvBuffer(csv));

    assert.equal(result.netRevenue, 130);
    assert.equal(result.discountColumnPresent, true);
    assert.equal(result.promotionColumnPresent, true);
    assert.equal(result.totalRecordedDiscounts, 15);
    assert.equal(result.promotionSummaries.length, 1);
    assert.ok(
      result.evidence.some((item) => item.claim.includes("discount")),
    );
    assert.ok(
      result.evidence.some((item) =>
        item.methodology?.includes("Association does not prove"),
      ),
    );
  });

  it("documents missing discount and promotion columns", () => {
    const csv = `order_id,order_date,revenue
O1,2026-01-01,100
`;
    const result = analyzeFinancialCsv("basic.csv", csvBuffer(csv));

    assert.equal(result.discountColumnPresent, false);
    assert.equal(result.promotionColumnPresent, false);
    assert.equal(result.totalRecordedDiscounts, null);
    assert.ok(
      result.limitations.some((item) => item.includes("discount column")),
    );
    assert.ok(
      result.limitations.some((item) => item.includes("promotion column")),
    );
  });
});
