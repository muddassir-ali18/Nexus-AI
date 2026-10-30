import type { AnalysisEvidence } from "@/lib/data/analysis-types";
import { runDeterministicSalesCsvAnalysis } from "@/lib/data/csv-analysis-pipeline";
import { parseSalesCsv, type CsvParseResult } from "@/lib/data/csv-parse";

export type FinancialAnalysisResult = {
  fileName: string;
  netRevenue: number;
  grossPositiveRevenue: number;
  negativeAdjustmentsTotal: number;
  averageOrderValue: number | null;
  discountColumnPresent: boolean;
  promotionColumnPresent: boolean;
  totalRecordedDiscounts: number | null;
  promotionSummaries: Array<{
    promotion: string;
    netRevenue: number;
    recordCount: number;
  }>;
  limitations: string[];
  evidence: AnalysisEvidence[];
};

function sumDiscounts(parsed: CsvParseResult): number | null {
  if (!parsed.mapping.discount) {
    return null;
  }

  let total = 0;
  let seen = false;
  for (const record of parsed.records) {
    if (record.discount === undefined) {
      continue;
    }
    seen = true;
    total += record.discount;
  }

  return seen ? total : 0;
}

function summarizePromotions(parsed: CsvParseResult) {
  if (!parsed.mapping.promotion) {
    return [];
  }

  const buckets = new Map<string, { netRevenue: number; recordCount: number }>();
  for (const record of parsed.records) {
    const promo = record.promotion?.trim();
    if (!promo) {
      continue;
    }
    const current = buckets.get(promo) ?? { netRevenue: 0, recordCount: 0 };
    current.netRevenue += record.revenue;
    current.recordCount += 1;
    buckets.set(promo, current);
  }

  return [...buckets.entries()]
    .map(([promotion, stats]) => ({ promotion, ...stats }))
    .sort((a, b) => b.netRevenue - a.netRevenue)
    .slice(0, 5);
}

export function analyzeFinancialCsv(
  fileName: string,
  buffer: ArrayBuffer,
): FinancialAnalysisResult {
  const parsed = parseSalesCsv(fileName, buffer);
  const base = runDeterministicSalesCsvAnalysis(fileName, buffer);
  const limitations = [...base.limitations];
  const evidence: AnalysisEvidence[] = [];

  evidence.push({
    id: crypto.randomUUID(),
    source: fileName,
    column: base.metrics.revenueColumn,
    claim: `Financial gross positive sales total ${base.metrics.grossPositiveRevenue}.`,
    value: base.metrics.grossPositiveRevenue,
    methodology:
      "Sum of included rows with revenue greater than zero (shared CSV pipeline).",
  });

  if (base.metrics.adjustmentRowCount > 0) {
    evidence.push({
      id: crypto.randomUUID(),
      source: fileName,
      column: base.metrics.revenueColumn,
      claim: `Financial negative adjustments total ${base.metrics.negativeAdjustmentsTotal}.`,
      value: base.metrics.negativeAdjustmentsTotal,
      methodology:
        "Sum of included rows with revenue less than zero (refunds/adjustments).",
    });
  }

  evidence.push({
    id: crypto.randomUUID(),
    source: fileName,
    column: base.metrics.revenueColumn,
    claim: `Financial net revenue is ${base.metrics.netRevenue}.`,
    value: base.metrics.netRevenue,
    methodology:
      "Gross positive sales plus negative adjustments from included rows.",
  });

  if (base.metrics.averageOrderValue !== null) {
    evidence.push({
      id: crypto.randomUUID(),
      source: fileName,
      column: base.metrics.revenueColumn,
      claim: `Financial average order value is ${base.metrics.averageOrderValue}.`,
      value: base.metrics.averageOrderValue,
      methodology:
        base.metrics.averageOrderValueMethod ??
        "Order-based AOV from distinct order_id values.",
    });
  } else {
    limitations.push(
      "Average order value was not calculated because order_id values were missing or insufficient.",
    );
  }

  const totalRecordedDiscounts = sumDiscounts(parsed);
  const promotionSummaries = summarizePromotions(parsed);

  if (parsed.mapping.discount) {
    evidence.push({
      id: crypto.randomUUID(),
      source: fileName,
      column: parsed.mapping.discount,
      claim: `Total recorded discount column values sum to ${totalRecordedDiscounts ?? 0}.`,
      value: totalRecordedDiscounts ?? 0,
      methodology:
        "Sum of numeric discount column values where present. This describes recorded discounts, not causal impact on sales.",
    });
  } else {
    limitations.push(
      "No discount column detected (accepted aliases: discount, discount_amount, promo_discount).",
    );
  }

  if (parsed.mapping.promotion) {
    for (const promo of promotionSummaries) {
      evidence.push({
        id: crypto.randomUUID(),
        source: fileName,
        column: parsed.mapping.promotion,
        claim: `Promotion "${promo.promotion}" is associated with ${promo.netRevenue} net revenue across ${promo.recordCount} included row(s).`,
        value: promo.netRevenue,
        methodology:
          "Observed net revenue grouped by promotion code. Association does not prove the promotion caused higher sales.",
        segment: promo.promotion,
      });
    }
    if (promotionSummaries.length === 0) {
      limitations.push(
        "Promotion column detected but no non-empty promotion values were found in included rows.",
      );
    }
  } else {
    limitations.push(
      "No promotion column detected (accepted aliases: promotion, promo_code, campaign, coupon).",
    );
  }

  return {
    fileName,
    netRevenue: base.metrics.netRevenue,
    grossPositiveRevenue: base.metrics.grossPositiveRevenue,
    negativeAdjustmentsTotal: base.metrics.negativeAdjustmentsTotal,
    averageOrderValue: base.metrics.averageOrderValue,
    discountColumnPresent: Boolean(parsed.mapping.discount),
    promotionColumnPresent: Boolean(parsed.mapping.promotion),
    totalRecordedDiscounts,
    promotionSummaries,
    limitations,
    evidence,
  };
}
