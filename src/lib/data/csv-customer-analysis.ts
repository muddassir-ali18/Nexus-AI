import type { AnalysisEvidence } from "@/lib/data/analysis-types";
import type { CsvParseResult } from "@/lib/data/csv-parse";

export const HIGH_VALUE_RULE =
  "High-value customers have net revenue strictly above the median net revenue across customers with a non-empty customer_id.";

export type CustomerSegmentCounts = {
  oneTimeCustomers: number;
  repeatCustomers: number;
  highValueCustomers: number;
};

export type CustomerAnalysisSuccess = {
  ok: true;
  fileName: string;
  distinctCustomers: number;
  distinctOrders: number;
  segmentCounts: CustomerSegmentCounts;
  segmentationRule: string;
  limitations: string[];
  evidence: AnalysisEvidence[];
};

export type CustomerAnalysisFailure = {
  ok: false;
  fileName: string;
  reason: string;
  limitations: string[];
};

export type CustomerAnalysisResult =
  | CustomerAnalysisSuccess
  | CustomerAnalysisFailure;

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function analyzeCustomerCsv(parsed: CsvParseResult): CustomerAnalysisResult {
  const fileName = parsed.fileLabel;
  const limitations: string[] = [];

  if (!parsed.mapping.customerId) {
    return {
      ok: false,
      fileName,
      reason:
        "Customer segmentation requires a customer_id column (accepted aliases: customer_id, customer, buyer_id, user_id).",
      limitations: [
        "No customer identifier column was detected in the uploaded CSV.",
      ],
    };
  }

  if (!parsed.mapping.orderId) {
    return {
      ok: false,
      fileName,
      reason:
        "Customer order-frequency segmentation requires an order_id column. Row counts cannot be treated as order counts.",
      limitations: [
        "Distinct order counts and one-time vs repeat customer segments are unavailable without order_id.",
      ],
    };
  }

  const customerOrders = new Map<string, Set<string>>();
  const customerNetRevenue = new Map<string, number>();

  for (const record of parsed.records) {
    const customer = record.customerId?.trim();
    if (!customer) {
      continue;
    }

    customerNetRevenue.set(
      customer,
      (customerNetRevenue.get(customer) ?? 0) + record.revenue,
    );

    const orderId = record.orderId?.trim();
    if (!orderId) {
      continue;
    }

    if (!customerOrders.has(customer)) {
      customerOrders.set(customer, new Set());
    }
    customerOrders.get(customer)!.add(orderId);
  }

  if (customerNetRevenue.size === 0) {
    return {
      ok: false,
      fileName,
      reason: "No rows with a non-empty customer identifier were found.",
      limitations,
    };
  }

  let oneTimeCustomers = 0;
  let repeatCustomers = 0;
  for (const customer of customerNetRevenue.keys()) {
    const orderCount = customerOrders.get(customer)?.size ?? 0;
    if (orderCount === 1) {
      oneTimeCustomers += 1;
    } else if (orderCount >= 2) {
      repeatCustomers += 1;
    }
  }

  const revenueValues = [...customerNetRevenue.values()];
  const medianRevenue = median(revenueValues);
  let highValueCustomers = 0;
  if (medianRevenue !== null) {
    for (const revenue of revenueValues) {
      if (revenue > medianRevenue) {
        highValueCustomers += 1;
      }
    }
  }

  const distinctOrders = new Set<string>();
  for (const orders of customerOrders.values()) {
    for (const orderId of orders) {
      distinctOrders.add(orderId);
    }
  }

  const evidence: AnalysisEvidence[] = [
    {
      id: crypto.randomUUID(),
      source: fileName,
      column: parsed.mapping.customerId,
      claim: `${customerNetRevenue.size} distinct customers with non-empty customer identifiers were observed.`,
      value: customerNetRevenue.size,
      methodology:
        "Count of unique non-empty customer_id values in included rows.",
    },
    {
      id: crypto.randomUUID(),
      source: fileName,
      column: parsed.mapping.orderId,
      claim: `${distinctOrders.size} distinct orders were linked to customers with order_id values.`,
      value: distinctOrders.size,
      methodology:
        "Count of unique non-empty order_id values for rows with customer_id.",
    },
    {
      id: crypto.randomUUID(),
      source: fileName,
      column: parsed.mapping.customerId,
      claim: `${oneTimeCustomers} customers placed exactly one distinct order.`,
      value: oneTimeCustomers,
      methodology:
        "Customers with exactly one distinct order_id in the uploaded data.",
    },
    {
      id: crypto.randomUUID(),
      source: fileName,
      column: parsed.mapping.customerId,
      claim: `${repeatCustomers} customers placed two or more distinct orders.`,
      value: repeatCustomers,
      methodology:
        "Customers with two or more distinct order_id values in the uploaded data.",
    },
    {
      id: crypto.randomUUID(),
      source: fileName,
      column: parsed.mapping.customerId,
      claim: `${highValueCustomers} customers exceed the median customer net revenue threshold.`,
      value: highValueCustomers,
      methodology: HIGH_VALUE_RULE,
    },
  ];

  limitations.push(
    "Customer demographics, retention, and lifetime value are not inferred beyond the uploaded CSV fields.",
  );

  return {
    ok: true,
    fileName,
    distinctCustomers: customerNetRevenue.size,
    distinctOrders: distinctOrders.size,
    segmentCounts: {
      oneTimeCustomers,
      repeatCustomers,
      highValueCustomers,
    },
    segmentationRule: HIGH_VALUE_RULE,
    limitations,
    evidence,
  };
}
