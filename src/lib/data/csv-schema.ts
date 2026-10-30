import type { ColumnMapping } from "@/lib/data/analysis-types";

const DATE_ALIASES = ["date", "order_date", "created_at"] as const;
const REVENUE_ALIASES = [
  "revenue",
  "sales",
  "amount",
  "total",
  "order_total",
] as const;
const ORDER_ID_ALIASES = ["order_id", "orderid"] as const;
const CUSTOMER_ID_ALIASES = [
  "customer_id",
  "customerid",
  "customer",
  "buyer_id",
  "user_id",
] as const;
const DISCOUNT_ALIASES = [
  "discount",
  "discount_amount",
  "discount_total",
  "promo_discount",
] as const;
const PROMOTION_ALIASES = [
  "promotion",
  "promo_code",
  "promo",
  "campaign",
  "coupon",
] as const;
const PRODUCT_ALIASES = ["product", "product_name", "item", "item_name"] as const;
const CATEGORY_ALIASES = ["category", "product_category"] as const;
const REGION_ALIASES = ["region", "country", "territory"] as const;

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function findColumn(
  headers: string[],
  aliases: readonly string[],
): string | undefined {
  const normalized = headers.map((header) => ({
    original: header,
    key: normalizeHeader(header),
  }));

  for (const alias of aliases) {
    const match = normalized.find((entry) => entry.key === alias);
    if (match) {
      return match.original;
    }
  }

  return undefined;
}

export type SchemaResolution =
  | { ok: true; mapping: ColumnMapping }
  | { ok: false; missing: ("date" | "revenue")[]; headers: string[] };

export function resolveSalesSchema(headers: string[]): SchemaResolution {
  const date = findColumn(headers, DATE_ALIASES);
  const revenue = findColumn(headers, REVENUE_ALIASES);

  const missing: ("date" | "revenue")[] = [];
  if (!date) {
    missing.push("date");
  }
  if (!revenue) {
    missing.push("revenue");
  }

  if (missing.length > 0) {
    return { ok: false, missing, headers };
  }

  const mapping: ColumnMapping = {
    date: date!,
    revenue: revenue!,
    orderId: findColumn(headers, ORDER_ID_ALIASES),
    customerId: findColumn(headers, CUSTOMER_ID_ALIASES),
    product: findColumn(headers, PRODUCT_ALIASES),
    category: findColumn(headers, CATEGORY_ALIASES),
    region: findColumn(headers, REGION_ALIASES),
    discount: findColumn(headers, DISCOUNT_ALIASES),
    promotion: findColumn(headers, PROMOTION_ALIASES),
  };

  return { ok: true, mapping };
}

export function formatMissingColumnsMessage(missing: ("date" | "revenue")[]): string {
  const labels = missing.map((field) => {
    if (field === "date") {
      return "date (accepted aliases: date, order_date, created_at)";
    }
    return "revenue (accepted aliases: revenue, sales, amount, total, order_total)";
  });

  return `Missing required column(s): ${labels.join("; ")}.`;
}
