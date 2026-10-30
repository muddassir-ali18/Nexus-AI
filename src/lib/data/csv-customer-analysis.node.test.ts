import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeCustomerCsv } from "./csv-customer-analysis";
import { parseSalesCsv } from "./csv-parse";

function csvBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe("analyzeCustomerCsv", () => {
  it("segments customers when customer_id and order_id are present", () => {
    const csv = `order_id,order_date,customer_id,revenue
O1,2026-01-01,C1,100
O2,2026-01-02,C1,50
O3,2026-01-03,C2,200
O4,2026-01-04,C3,10
`;
    const parsed = parseSalesCsv("customers.csv", csvBuffer(csv));
    const result = analyzeCustomerCsv(parsed);

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.distinctCustomers, 3);
    assert.equal(result.distinctOrders, 4);
    assert.equal(result.segmentCounts.oneTimeCustomers, 2);
    assert.equal(result.segmentCounts.repeatCustomers, 1);
    assert.ok(result.evidence.length >= 5);
    assert.match(result.segmentationRule, /median/i);
  });

  it("explains when customer_id is missing", () => {
    const csv = `order_id,order_date,revenue
O1,2026-01-01,100
`;
    const parsed = parseSalesCsv("no-customer.csv", csvBuffer(csv));
    const result = analyzeCustomerCsv(parsed);

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.match(result.reason, /customer_id/i);
  });
});
