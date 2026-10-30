import type {
  ColumnMapping,
  CsvBusinessMetrics,
  CsvValidationSummary,
  MonthOverMonthChange,
  MonthlyRevenuePoint,
  SegmentRevenue,
} from "@/lib/data/analysis-types";

export type SalesRecord = {
  rowNumber: number;
  date: Date;
  revenue: number;
  orderId?: string;
  product?: string;
  category?: string;
  region?: string;
};

export type AverageOrderValueResult = {
  value: number | null;
  method: string | null;
  orderCount: number;
  excludedRowCount: number;
  excludedRevenue: number;
};

export const MOM_COMPARISON_NOTE =
  "Compares net revenue between the last two available calendar-month buckets in the dataset. Buckets may include partial months and are not normalized to complete months.";

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isAdjustmentRow(record: SalesRecord): boolean {
  return record.revenue < 0;
}

function aggregatePositiveSegments(
  records: SalesRecord[],
  selector: (record: SalesRecord) => string | undefined,
): SegmentRevenue[] {
  const totals = new Map<string, { revenue: number; count: number }>();

  for (const record of records) {
    if (record.revenue <= 0) {
      continue;
    }

    const raw = selector(record)?.trim();
    if (!raw) {
      continue;
    }

    const current = totals.get(raw) ?? { revenue: 0, count: 0 };
    current.revenue += record.revenue;
    current.count += 1;
    totals.set(raw, current);
  }

  return Array.from(totals.entries())
    .map(([segment, value]) => ({
      segment,
      revenue: roundCurrency(value.revenue),
      recordCount: value.count,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function computeMonthlyRevenue(
  records: SalesRecord[],
  mapping: ColumnMapping,
): MonthlyRevenuePoint[] {
  const hasOrderIdColumn = Boolean(mapping.orderId);
  const monthly = new Map<
    string,
    { revenue: number; orders: Set<string>; unassignedRows: number }
  >();

  for (const record of records) {
    const month = monthKey(record.date);
    const bucket = monthly.get(month) ?? {
      revenue: 0,
      orders: new Set<string>(),
      unassignedRows: 0,
    };
    bucket.revenue += record.revenue;

    if (hasOrderIdColumn) {
      if (record.orderId) {
        bucket.orders.add(record.orderId);
      } else {
        bucket.unassignedRows += 1;
      }
    } else {
      bucket.orders.add(`row-${record.rowNumber}`);
    }

    monthly.set(month, bucket);
  }

  return Array.from(monthly.entries())
    .map(([month, value]) => ({
      month,
      revenue: roundCurrency(value.revenue),
      orderCount: value.orders.size,
      unassignedRowCount: hasOrderIdColumn ? value.unassignedRows : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function computeMonthOverMonth(
  monthly: MonthlyRevenuePoint[],
): MonthOverMonthChange | null {
  if (monthly.length < 2) {
    return null;
  }

  const previous = monthly[monthly.length - 2];
  const current = monthly[monthly.length - 1];
  const absoluteChange = roundCurrency(current.revenue - previous.revenue);
  const percentChange =
    previous.revenue === 0
      ? null
      : roundCurrency((absoluteChange / previous.revenue) * 100);

  return {
    previousMonth: previous.month,
    currentMonth: current.month,
    previousRevenue: previous.revenue,
    currentRevenue: current.revenue,
    absoluteChange,
    percentChange,
    method: `Net revenue change between the last two calendar-month buckets (${previous.month} → ${current.month}). Formula: (current net revenue - previous net revenue) / previous net revenue × 100. ${MOM_COMPARISON_NOTE}`,
  };
}

export function computeAverageOrderValue(
  records: SalesRecord[],
  mapping: ColumnMapping,
): AverageOrderValueResult {
  if (!mapping.orderId) {
    const total = records.reduce((sum, record) => sum + record.revenue, 0);
    return {
      value: records.length > 0 ? roundCurrency(total / records.length) : null,
      method:
        "Each row is treated as one transaction because no order_id column was detected.",
      orderCount: records.length,
      excludedRowCount: 0,
      excludedRevenue: 0,
    };
  }

  const orderTotals = new Map<string, number>();
  let excludedRowCount = 0;
  let excludedRevenue = 0;

  for (const record of records) {
    if (!record.orderId) {
      excludedRowCount += 1;
      excludedRevenue += record.revenue;
      continue;
    }

    orderTotals.set(
      record.orderId,
      (orderTotals.get(record.orderId) ?? 0) + record.revenue,
    );
  }

  if (orderTotals.size === 0) {
    return {
      value: null,
      method:
        "No rows with a valid order_id were available for order-based average order value.",
      orderCount: 0,
      excludedRowCount,
      excludedRevenue: roundCurrency(excludedRevenue),
    };
  }

  const orderRevenueTotal = Array.from(orderTotals.values()).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    value: roundCurrency(orderRevenueTotal / orderTotals.size),
    method:
      "Order-based AOV uses distinct non-empty order_id values only. Rows with blank order_id remain in net revenue totals but are excluded from this metric.",
    orderCount: orderTotals.size,
    excludedRowCount,
    excludedRevenue: roundCurrency(excludedRevenue),
  };
}

export function analyzeSalesRecords(input: {
  fileLabel: string;
  mapping: ColumnMapping;
  records: SalesRecord[];
  validation: CsvValidationSummary;
}): { metrics: CsvBusinessMetrics; limitations: string[]; warnings: string[] } {
  const { fileLabel, mapping, records, validation } = input;
  const limitations: string[] = [];
  const warnings = [...validation.warnings];

  const grossPositiveRevenue = roundCurrency(
    records
      .filter((record) => record.revenue > 0)
      .reduce((sum, record) => sum + record.revenue, 0),
  );
  const negativeAdjustmentsTotal = roundCurrency(
    records
      .filter((record) => record.revenue < 0)
      .reduce((sum, record) => sum + record.revenue, 0),
  );
  const netRevenue = roundCurrency(
    records.reduce((sum, record) => sum + record.revenue, 0),
  );
  const adjustmentRowCount = records.filter(isAdjustmentRow).length;

  if (adjustmentRowCount > 0) {
    warnings.push(
      `${adjustmentRowCount} row(s) contain negative revenue values and are counted as adjustments in net totals.`,
    );
  }

  const revenueByMonth = computeMonthlyRevenue(records, mapping);
  const monthOverMonth = computeMonthOverMonth(revenueByMonth);
  const aov = computeAverageOrderValue(records, mapping);

  if (mapping.orderId && aov.excludedRowCount > 0) {
    warnings.push(
      `${aov.excludedRowCount} row(s) with blank order_id (${formatCurrency(aov.excludedRevenue)} net revenue) were excluded from order-based AOV and monthly order counts.`,
    );
  }

  if (revenueByMonth.length < 2) {
    limitations.push(
      "Only one month of revenue is available, so month-over-month change was not calculated.",
    );
  }

  if (monthOverMonth) {
    limitations.push(MOM_COMPARISON_NOTE);
  }

  if (monthOverMonth && monthOverMonth.previousRevenue === 0) {
    limitations.push(
      "Previous-month net revenue was zero, so a percentage month-over-month change is not reported.",
    );
  }

  const metrics: CsvBusinessMetrics = {
    fileLabel,
    totalRevenue: netRevenue,
    grossPositiveRevenue,
    negativeAdjustmentsTotal,
    netRevenue,
    validRecordCount: records.length,
    revenueColumn: mapping.revenue,
    dateColumn: mapping.date,
    revenueByMonth,
    monthOverMonth:
      monthOverMonth && monthOverMonth.previousRevenue !== 0
        ? monthOverMonth
        : monthOverMonth && monthOverMonth.previousRevenue === 0
          ? {
              ...monthOverMonth,
              percentChange: null,
            }
          : null,
    averageOrderValue: aov.value,
    averageOrderValueMethod: aov.method,
    averageOrderValueOrderCount: aov.orderCount,
    averageOrderValueExcludedRowCount: aov.excludedRowCount,
    averageOrderValueExcludedRevenue: aov.excludedRevenue,
    revenueByProduct: mapping.product
      ? aggregatePositiveSegments(records, (record) => record.product)
      : [],
    revenueByCategory: mapping.category
      ? aggregatePositiveSegments(records, (record) => record.category)
      : [],
    revenueByRegion: mapping.region
      ? aggregatePositiveSegments(records, (record) => record.region)
      : [],
    duplicateRowsExcluded: validation.duplicateRowsExcluded,
    adjustmentRowCount,
    refundRowCount: adjustmentRowCount,
  };

  if (!mapping.product) {
    limitations.push("Product breakdown skipped because no product column was detected.");
  } else {
    limitations.push(
      "Product and category rankings include positive revenue rows only; negative adjustments are excluded from segment rankings.",
    );
  }
  if (!mapping.category) {
    limitations.push(
      "Category breakdown skipped because no category column was detected.",
    );
  }
  if (!mapping.region) {
    limitations.push("Region breakdown skipped because no region column was detected.");
  }

  return { metrics, limitations, warnings };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
