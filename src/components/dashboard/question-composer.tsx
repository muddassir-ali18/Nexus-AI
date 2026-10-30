"use client";

import { type ChangeEvent, type FormEvent, useId, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Square,
  X,
} from "lucide-react";
import { useSpeechRecognition } from "@/components/dashboard/use-speech-recognition";

const SEO_SUGGESTED_PROMPTS = [
  {
    label: "Audit my website’s technical SEO",
    hint: "Records Website & SEO boundary — crawling not implemented",
  },
  {
    label: "Analyze an SEO performance CSV",
    hint: "Attach a .csv for Data & Finance analysis",
  },
  {
    label: "Research competitors and prepare a keyword strategy",
    hint: "May use web research when Tavily is configured",
  },
  {
    label: "Prioritize the biggest organic-growth opportunities",
    hint: "General investigation; evidence depends on available inputs",
  },
] as const;

type QuestionComposerProps = {
  isSubmitting: boolean;
  investigationAttachment: File | null;
  onInvestigationAttachmentChange: (file: File | null) => void;
  onInvestigate: (question: string) => Promise<void>;
};

export function QuestionComposer({
  isSubmitting,
  investigationAttachment,
  onInvestigationAttachmentChange,
  onInvestigate,
}: QuestionComposerProps) {
  const inputId = useId();
  const attachmentInputId = useId();
  const speechStatusId = useId();
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const speech = useSpeechRecognition({
    onFinalTranscript: (text) => {
      setQuestion((current) => {
        const trimmedCurrent = current.trim();
        return trimmedCurrent ? `${trimmedCurrent} ${text}` : text;
      });
    },
  });

  function handleAttachmentPick(event: ChangeEvent<HTMLInputElement>) {
    setValidationError(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setValidationError(
        "Only .csv files are supported for investigations. PDF, DOCX, and website URLs are not accepted by the current API.",
      );
      event.target.value = "";
      return;
    }

    onInvestigationAttachmentChange(file);
  }

  function handleRemoveAttachment() {
    onInvestigationAttachmentChange(null);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    speech.stopListening();

    const trimmed = question.trim();
    if (!trimmed) {
      setValidationError("Enter a goal or question before investigating.");
      return;
    }

    await onInvestigate(trimmed);
  }

  return (
    <section
      id="investigations"
      className="scroll-mt-28 rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-6 shadow-[0_0_0_1px_rgba(45,212,191,0.04)] sm:p-8"
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-teal-300/80">
        Investigations
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
        Describe your SEO or business goal
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
        Type, attach a sales CSV, or use the microphone. Everything submits through
        the same <span className="text-zinc-300">/api/investigate</span> pipeline.
      </p>

      {investigationAttachment ? (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-teal-900/40 bg-teal-950/15 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-300/80">
              Attached context
            </p>
            <p className="mt-1 text-sm text-zinc-100">
              {investigationAttachment.name}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Sent as multipart form data with your next investigation.
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleRemoveAttachment}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="size-4" aria-hidden="true" />
            Remove
          </button>
        </div>
      ) : null}

      <form className="mt-6" onSubmit={handleSubmit}>
        <label htmlFor={inputId} className="sr-only">
          Investigation goal
        </label>
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 focus-within:border-teal-800/60">
          <textarea
            id={inputId}
            name="question"
            rows={4}
            value={question}
            disabled={isSubmitting}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Example: Analyze my attached CSV for net revenue trends and recommend organic growth priorities…"
            className="w-full resize-y bg-transparent px-2 py-2 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
          />

          {speech.interimTranscript ? (
            <p className="px-2 text-xs text-teal-200/90" id={speechStatusId}>
              Recognizing: {speech.interimTranscript}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={attachmentInputRef}
                id={attachmentInputId}
                type="file"
                accept=".csv,text/csv"
                disabled={isSubmitting}
                onChange={handleAttachmentPick}
                className="sr-only"
              />
              <label
                htmlFor={attachmentInputId}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 ${
                  isSubmitting ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <Paperclip className="size-4" aria-hidden="true" />
                {investigationAttachment ? "Replace CSV" : "Attach CSV"}
              </label>

              {speech.uiState === "unsupported" ? (
                <span className="text-xs text-zinc-500">
                  Speech input unavailable in this browser
                </span>
              ) : (
                <>
                  {speech.uiState === "listening" ? (
                    <button
                      type="button"
                      onClick={speech.stopListening}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200"
                    >
                      <Square className="size-4" aria-hidden="true" />
                      Stop listening
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={speech.startListening}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-teal-800 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-describedby={
                        speech.interimTranscript ? speechStatusId : undefined
                      }
                    >
                      <Mic className="size-4" aria-hidden="true" />
                      Speak
                    </button>
                  )}
                  {speech.uiState === "listening" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-teal-300">
                      <MicOff className="size-3.5" aria-hidden="true" />
                      Listening… edit transcript before submitting
                    </span>
                  ) : null}
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-700/60 bg-teal-400/90 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  Investigating…
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                </>
              ) : (
                <>
                  Run investigation
                  <ArrowUp className="size-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {validationError ? (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {validationError}
        </p>
      ) : null}

      {speech.errorMessage ? (
        <p className="mt-3 text-sm text-amber-200/90" role="status">
          {speech.errorMessage}
        </p>
      ) : null}

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Suggested SEO prompts
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Suggestions only — capabilities depend on CSV attachment, Tavily, and
          implemented tools.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {SEO_SUGGESTED_PROMPTS.map((prompt) => (
            <li key={prompt.label}>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setQuestion(prompt.label)}
                className="h-full w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-left transition-colors hover:border-teal-900/50 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm text-zinc-200">{prompt.label}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{prompt.hint}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
