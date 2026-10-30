import type {
  AnalysisEvidence,
  CsvBusinessMetrics,
} from "@/lib/data/analysis-types";

export function buildCsvAnalysisEvidence(
  metrics: CsvBusinessMetrics,
): AnalysisEvidence[] {
  const source = metrics.fileLabel;
  const evidence: AnalysisEvidence[] = [];

  evidence.push({
    id: crypto.randomUUID(),
    source,
    column: metrics.revenueColumn,
    claim: `Gross positive sales total ${metrics.grossPositiveRevenue}.`,
    value: metrics.grossPositiveRevenue,
    methodology: "Sum of included rows with revenue greater than zero.",
  });

  if (metrics.adjustmentRowCount > 0) {
    evidence.push({
      id: crypto.randomUUID(),
      source,
      column: metrics.revenueColumn,
      claim: `Negative revenue adjustments total ${metrics.negativeAdjustmentsTotal}.`,
      value: metrics.negativeAdjustmentsTotal,
      methodology:
        "Sum of included rows with revenue less than zero. These rows are treated as adjustments/refunds, not ordinary product sales.",
    });
  }

  evidence.push({
    id: crypto.randomUUID(),
    source,
    column: metrics.revenueColumn,
    claim: `Net revenue across valid records is ${metrics.netRevenue}.`,
    value: metrics.netRevenue,
    methodology:
      "Gross positive sales plus negative adjustments/refunds from included rows.",
  });

  evidence.push({
    id: crypto.randomUUID(),
    source,
    column: metrics.dateColumn,
    claim: `${metrics.validRecordCount} valid sales records were included in the analysis.`,
    value: metrics.validRecordCount,
    methodology:
      "Count of rows that passed date and revenue validation and were not excluded as duplicates.",
  });

  for (const point of metrics.revenueByMonth) {
    evidence.push({
      id: crypto.randomUUID(),
      source,
      column: metrics.revenueColumn,
      claim: `Net revenue in calendar-month bucket ${point.month} was ${point.revenue}.`,
      value: point.revenue,
      methodology:
        "Sum of row-level net revenue grouped by UTC calendar month. Buckets may represent partial months.",
      period: point.month,
    });
  }

  if (metrics.monthOverMonth && metrics.monthOverMonth.percentChange !== null) {
    const mom = metrics.monthOverMonth;
    evidence.push({
      id: crypto.randomUUID(),
      source,
      column: metrics.revenueColumn,
      claim: `Net revenue changed by ${mom.percentChange}% between calendar-month buckets ${mom.previousMonth} and ${mom.currentMonth}.`,
      value: mom.percentChange,
      methodology: mom.method,
      period: `${mom.previousMonth} → ${mom.currentMonth}`,
    });
  } else if (metrics.monthOverMonth && metrics.monthOverMonth.percentChange === null) {
    const mom = metrics.monthOverMonth;
    evidence.push({
      id: crypto.randomUUID(),
      source,
      column: metrics.revenueColumn,
      claim: `Net revenue changed by ${mom.absoluteChange} between calendar-month buckets ${mom.previousMonth} and ${mom.currentMonth}, but prior bucket net revenue was zero so no percentage change is reported.`,
      value: mom.absoluteChange,
      methodology:
        "Absolute net month-over-month difference only; percentage omitted when prior bucket net revenue is zero.",
      period: `${mom.previousMonth} → ${mom.currentMonth}`,
    });
  }

  if (metrics.averageOrderValue !== null && metrics.averageOrderValueMethod) {
    evidence.push({
      id: crypto.randomUUID(),
      source,
      column: metrics.revenueColumn,
      claim: `Average order value is ${metrics.averageOrderValue} across ${metrics.averageOrderValueOrderCount} distinct orders.`,
      value: metrics.averageOrderValue,
      methodology: metrics.averageOrderValueMethod,
    });

    if (metrics.averageOrderValueExcludedRowCount > 0) {
      evidence.push({
        id: crypto.randomUUID(),
        source,
        column: metrics.revenueColumn,
        claim: `${metrics.averageOrderValueExcludedRowCount} row(s) with blank order_id (${metrics.averageOrderValueExcludedRevenue} net revenue) were excluded from order-based AOV.`,
        value: metrics.averageOrderValueExcludedRevenue,
        methodology:
          "Rows without order_id remain in net revenue totals but are excluded from order-based AOV calculations.",
      });
    }
  }

  for (const segment of metrics.revenueByProduct.slice(0, 5)) {
    evidence.push({
      id: crypto.randomUUID(),
      source,
      column: "product",
      claim: `Product "${segment.segment}" generated ${segment.revenue} in gross positive sales.`,
      value: segment.revenue,
      methodology:
        "Sum of positive row-level revenue grouped by product. Negative adjustments are excluded.",
      segment: segment.segment,
    });
  }

  for (const segment of metrics.revenueByCategory.slice(0, 5)) {
    evidence.push({
      id: crypto.randomUUID(),
      source,
      column: "category",
      claim: `Category "${segment.segment}" generated ${segment.revenue} in gross positive sales.`,
      value: segment.revenue,
      methodology:
        "Sum of positive row-level revenue grouped by category. Negative adjustments are excluded.",
      segment: segment.segment,
    });
  }

  for (const segment of metrics.revenueByRegion.slice(0, 5)) {
    evidence.push({
      id: crypto.randomUUID(),
      source,
      column: "region",
      claim: `Region "${segment.segment}" generated ${segment.revenue} in net revenue.`,
      value: segment.revenue,
      methodology: "Sum of row-level net revenue grouped by region.",
      segment: segment.segment,
    });
  }

  return evidence;
}
