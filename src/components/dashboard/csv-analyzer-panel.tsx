"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import type { CsvAnalyzeResponse } from "@/lib/data/analysis-types";

type UploadStatus = "idle" | "uploading" | "success" | "error";

type CsvAnalyzerPanelProps = {
  investigationAttachmentName?: string | null;
  onAttachToInvestigation?: (file: File) => void;
};

export function CsvAnalyzerPanel({
  investigationAttachmentName,
  onAttachToInvestigation,
}: CsvAnalyzerPanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<
    CsvAnalyzeResponse,
    { success: true }
  > | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Select a CSV file before analyzing.");
      setStatus("error");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are supported.");
      setStatus("error");
      return;
    }

    setFileName(file.name);
    setStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze-csv", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as CsvAnalyzeResponse;

      if (!response.ok || !payload.success) {
        setError(payload.success ? "CSV analysis failed." : payload.error);
        setStatus("error");
        return;
      }

      setResult(payload);
      setStatus("success");
    } catch {
      setError("Unable to reach the CSV analysis service.");
      setStatus("error");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-6 sm:p-8">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
        Business data
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">
        CSV Business Data Analyzer
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
        Upload synthetic or real sales CSV data to calculate deterministic
        metrics, generate evidence, and request a Nemotron interpretation.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor={inputId}
            className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500"
          >
            CSV file
          </label>
          <div className="mt-2 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <input
              ref={inputRef}
              id={inputId}
              name="file"
              type="file"
              accept=".csv,text/csv"
              disabled={status === "uploading"}
              className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-800"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              {onAttachToInvestigation ? (
                <button
                  type="button"
                  disabled={status === "uploading"}
                  onClick={() => {
                    const file = inputRef.current?.files?.[0];
                    if (!file) {
                      setError("Select a CSV file before attaching to an investigation.");
                      setStatus("error");
                      return;
                    }
                    if (!file.name.toLowerCase().endsWith(".csv")) {
                      setError("Only .csv files are supported.");
                      setStatus("error");
                      return;
                    }
                    setError(null);
                    onAttachToInvestigation(file);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Attach to investigation
                </button>
              ) : null}
              <button
                type="submit"
                disabled={status === "uploading"}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "uploading" ? (
                  <>
                    Analyzing…
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Analyze CSV
                    <Upload className="size-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {fileName ? (
          <p className="text-sm text-zinc-400">
            Selected file: <span className="text-zinc-200">{fileName}</span>
          </p>
        ) : null}

        {investigationAttachmentName ? (
          <p className="text-sm text-emerald-300/80">
            Attached for investigation:{" "}
            <span className="text-zinc-100">{investigationAttachmentName}</span>
          </p>
        ) : null}

        <p className="text-xs leading-5 text-zinc-600">
          Demo sample:{" "}
          <a
            href="/samples/nexus-synthetic-sales-demo.csv"
            className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
          >
            nexus-synthetic-sales-demo.csv
          </a>{" "}
          (clearly synthetic data)
        </p>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {status === "idle" && !result ? (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
          No CSV has been analyzed yet. Metrics and AI interpretation will
          appear here after a successful upload.
        </div>
      ) : null}

      {result ? (
        <div className="mt-8 space-y-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              Validation
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Rows read"
                value={String(result.validation.totalRowsRead)}
              />
              <MetricCard
                label="Included"
                value={String(result.validation.includedRows)}
              />
              <MetricCard
                label="Excluded"
                value={String(result.validation.excludedRows)}
              />
            </div>
            {(result.warnings.length > 0 || result.validation.warnings.length > 0) ? (
              <ul className="mt-3 space-y-2 text-sm text-amber-300/90">
                {[...result.validation.warnings, ...result.warnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              Business metrics
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                label="Gross positive sales"
                value={formatCurrency(result.metrics.grossPositiveRevenue)}
              />
              <MetricCard
                label="Negative adjustments"
                value={formatCurrency(result.metrics.negativeAdjustmentsTotal)}
              />
              <MetricCard
                label="Net revenue"
                value={formatCurrency(result.metrics.netRevenue)}
              />
              <MetricCard
                label="Valid records"
                value={String(result.metrics.validRecordCount)}
              />
              <MetricCard
                label="Average order value"
                value={
                  result.metrics.averageOrderValue === null
                    ? "N/A"
                    : formatCurrency(result.metrics.averageOrderValue)
                }
                detail={
                  result.metrics.averageOrderValueMethod
                    ? `${result.metrics.averageOrderValueMethod}${
                        result.metrics.averageOrderValueExcludedRowCount > 0
                          ? ` Excluded ${result.metrics.averageOrderValueExcludedRowCount} row(s) (${formatCurrency(result.metrics.averageOrderValueExcludedRevenue)} net revenue).`
                          : ""
                      }`
                    : undefined
                }
              />
              <MetricCard
                label="Months covered"
                value={String(result.metrics.revenueByMonth.length)}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              Monthly net revenue trend
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Calendar-month buckets may represent partial months and include
              negative adjustments in net totals.
            </p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-900/60 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Month bucket</th>
                    <th className="px-4 py-3 font-medium">Net revenue</th>
                    <th className="px-4 py-3 font-medium">Distinct orders</th>
                  </tr>
                </thead>
                <tbody>
                  {result.metrics.revenueByMonth.map((point) => (
                    <tr key={point.month} className="border-t border-zinc-800">
                      <td className="px-4 py-3 text-zinc-200">{point.month}</td>
                      <td className="px-4 py-3 text-zinc-300">
                        {formatCurrency(point.revenue)}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {point.orderCount}
                        {point.unassignedRowCount > 0
                          ? ` (${point.unassignedRowCount} row(s) without order_id excluded from order count)`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              Deterministic evidence
            </p>
            <ul className="mt-3 space-y-3">
              {result.evidence.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <p className="text-sm text-zinc-100">{item.claim}</p>
                  <p className="mt-2 text-xs text-zinc-500">{item.methodology}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              AI-generated interpretation
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Generated by Nemotron from aggregated metrics and evidence. This
              is not a substitute for the deterministic evidence above.
            </p>
            {result.interpretation ? (
              <div className="mt-3 space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-300/80">
                  AI summary
                </p>
                <p className="text-sm leading-6 text-zinc-200">
                  {result.interpretation.summary}
                </p>
                <InterpretationList
                  title="AI-stated measured facts (verify against evidence)"
                  items={result.interpretation.measuredFacts}
                />
                <InterpretationList
                  title="Possible explanations (hypotheses)"
                  items={result.interpretation.possibleExplanations}
                />
                <InterpretationList
                  title="Additional information needed"
                  items={result.interpretation.additionalInformationNeeded}
                />
                <InterpretationList
                  title="Recommended next steps"
                  items={result.interpretation.recommendedNextSteps}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                {result.interpretationError ??
                  "Deterministic metrics are available, but Nemotron interpretation was not returned."}
              </p>
            )}
          </div>

          {result.limitations.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                Limitations
              </p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-500">
                {result.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "uploading" ? (
        <div className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-400">
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          Parsing CSV, calculating metrics, and requesting interpretation…
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-100">{value}</p>
      {detail ? (
        <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p>
      ) : null}
    </div>
  );
}

function InterpretationList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
