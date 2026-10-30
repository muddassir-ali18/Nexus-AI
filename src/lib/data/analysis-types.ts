export const CSV_MAX_BYTES = 5 * 1024 * 1024;
export const CSV_MAX_ROWS = 10_000;

export type ColumnMapping = {
  date: string;
  revenue: string;
  orderId?: string;
  customerId?: string;
  product?: string;
  category?: string;
  region?: string;
  discount?: string;
  promotion?: string;
};

export type ExcludedRow = {
  rowNumber: number;
  reason: string;
};

export type CsvValidationSummary = {
  totalRowsRead: number;
  includedRows: number;
  excludedRows: number;
  duplicateRowsExcluded: number;
  excludedSample: ExcludedRow[];
  detectedColumns: ColumnMapping;
  warnings: string[];
};

export type MonthlyRevenuePoint = {
  month: string;
  /** Net revenue for the calendar-month bucket (includes negative adjustments). */
  revenue: number;
  orderCount: number;
  unassignedRowCount: number;
};

export type SegmentRevenue = {
  segment: string;
  revenue: number;
  recordCount: number;
};

export type MonthOverMonthChange = {
  previousMonth: string;
  currentMonth: string;
  previousRevenue: number;
  currentRevenue: number;
  absoluteChange: number;
  percentChange: number | null;
  method: string;
};

export type CsvBusinessMetrics = {
  fileLabel: string;
  /** Net revenue across all included rows. */
  totalRevenue: number;
  grossPositiveRevenue: number;
  negativeAdjustmentsTotal: number;
  netRevenue: number;
  validRecordCount: number;
  revenueColumn: string;
  dateColumn: string;
  revenueByMonth: MonthlyRevenuePoint[];
  monthOverMonth: MonthOverMonthChange | null;
  averageOrderValue: number | null;
  averageOrderValueMethod: string | null;
  averageOrderValueOrderCount: number;
  averageOrderValueExcludedRowCount: number;
  averageOrderValueExcludedRevenue: number;
  revenueByProduct: SegmentRevenue[];
  revenueByCategory: SegmentRevenue[];
  revenueByRegion: SegmentRevenue[];
  duplicateRowsExcluded: number;
  adjustmentRowCount: number;
  /** @deprecated Use adjustmentRowCount. */
  refundRowCount: number;
};

export type AnalysisEvidence = {
  id: string;
  source: string;
  column?: string;
  claim: string;
  value?: unknown;
  methodology: string;
  period?: string;
  segment?: string;
};

export type CsvInterpretation = {
  summary: string;
  measuredFacts: string[];
  possibleExplanations: string[];
  additionalInformationNeeded: string[];
  recommendedNextSteps: string[];
};

export type CsvAnalyzeSuccess = {
  success: true;
  fileName: string;
  validation: CsvValidationSummary;
  metrics: CsvBusinessMetrics;
  evidence: AnalysisEvidence[];
  interpretation: CsvInterpretation | null;
  interpretationError: string | null;
  limitations: string[];
  warnings: string[];
};

export type CsvAnalyzeFailure = {
  success: false;
  error: string;
  validation?: Partial<CsvValidationSummary>;
};

export type CsvAnalyzeResponse = CsvAnalyzeSuccess | CsvAnalyzeFailure;
