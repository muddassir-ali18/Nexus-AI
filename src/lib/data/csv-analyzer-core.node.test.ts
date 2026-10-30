import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ColumnMapping, CsvValidationSummary } from "./analysis-types";
import {
  analyzeSalesRecords,
  computeAverageOrderValue,
  computeMonthOverMonth,
  type SalesRecord,
} from "./csv-analyzer-core";
import { validateCsvInterpretation } from "./csv-interpretation-validation";

const baseValidation: CsvValidationSummary = {
  totalRowsRead: 0,
  includedRows: 0,
  excludedRows: 0,
  duplicateRowsExcluded: 0,
  excludedSample: [],
  detectedColumns: {
    date: "date",
    revenue: "revenue",
    orderId: "order_id",
  },
  warnings: [],
};

function record(
  partial: Omit<SalesRecord, "rowNumber"> & { rowNumber?: number },
): SalesRecord {
  return {
    rowNumber: partial.rowNumber ?? 1,
    date: partial.date,
    revenue: partial.revenue,
    orderId: partial.orderId,
    product: partial.product,
    category: partial.category,
    region: partial.region,
  };
}

describe("csv analyzer core phase 1", () => {
  it("excludes blank order_id rows from AOV but keeps them in net revenue", () => {
    const mapping: ColumnMapping = {
      date: "date",
      revenue: "revenue",
      orderId: "order_id",
      product: "product",
    };
    const records = [
      record({ rowNumber: 1, date: new Date("2026-01-05"), revenue: 100, orderId: "A" }),
      record({ rowNumber: 2, date: new Date("2026-01-06"), revenue: 50, orderId: "A" }),
      record({ rowNumber: 3, date: new Date("2026-01-07"), revenue: 40, orderId: undefined }),
    ];

    const aov = computeAverageOrderValue(records, mapping);
    assert.equal(aov.value, 150);
    assert.equal(aov.orderCount, 1);
    assert.equal(aov.excludedRowCount, 1);
    assert.equal(aov.excludedRevenue, 40);

    const result = analyzeSalesRecords({
      fileLabel: "test.csv",
      mapping,
      records,
      validation: { ...baseValidation, includedRows: records.length },
    });

    assert.equal(result.metrics.netRevenue, 190);
    assert.equal(result.metrics.averageOrderValue, 150);
    assert.equal(result.metrics.averageOrderValueExcludedRowCount, 1);
  });

  it("aggregates repeated order IDs into one order for AOV", () => {
    const mapping: ColumnMapping = {
      date: "date",
      revenue: "revenue",
      orderId: "order_id",
    };
    const records = [
      record({ rowNumber: 1, date: new Date("2026-01-05"), revenue: 100, orderId: "A" }),
      record({ rowNumber: 2, date: new Date("2026-01-05"), revenue: 25, orderId: "A" }),
      record({ rowNumber: 3, date: new Date("2026-01-06"), revenue: 200, orderId: "B" }),
    ];

    const aov = computeAverageOrderValue(records, mapping);
    assert.equal(aov.value, 162.5);
    assert.equal(aov.orderCount, 2);
  });

  it("separates gross, adjustments, and net revenue and excludes negative rows from product ranking", () => {
    const mapping: ColumnMapping = {
      date: "date",
      revenue: "revenue",
      product: "product",
    };
    const records = [
      record({
        rowNumber: 1,
        date: new Date("2026-01-05"),
        revenue: 100,
        product: "Desk",
      }),
      record({
        rowNumber: 2,
        date: new Date("2026-01-06"),
        revenue: -20,
        product: "Refund Adjustment",
      }),
    ];

    const result = analyzeSalesRecords({
      fileLabel: "test.csv",
      mapping,
      records,
      validation: { ...baseValidation, includedRows: records.length },
    });

    assert.equal(result.metrics.grossPositiveRevenue, 100);
    assert.equal(result.metrics.negativeAdjustmentsTotal, -20);
    assert.equal(result.metrics.netRevenue, 80);
    assert.deepEqual(result.metrics.revenueByProduct.map((item) => item.segment), [
      "Desk",
    ]);
  });

  it("does not report percentage MoM when prior month net revenue is zero", () => {
    const mom = computeMonthOverMonth([
      { month: "2026-01", revenue: 0, orderCount: 0, unassignedRowCount: 0 },
      { month: "2026-02", revenue: 100, orderCount: 1, unassignedRowCount: 0 },
    ]);

    assert.ok(mom);
    assert.equal(mom?.percentChange, null);
  });

  it("rejects malformed AI interpretation certainty language", () => {
    const error = validateCsvInterpretation({
      summary: "This is the proven root cause of the decline.",
      measuredFacts: [],
      possibleExplanations: [],
      additionalInformationNeeded: [],
      recommendedNextSteps: [],
    });

    assert.ok(error);
  });
});
