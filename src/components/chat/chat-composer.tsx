"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Loader2, Mic, Paperclip, Send, Square, X } from "lucide-react";
import { useSpeechRecognition } from "@/components/dashboard/use-speech-recognition";

type ChatComposerProps = {
  disabled: boolean;
  attachment: File | null;
  onAttachmentChange: (file: File | null) => void;
  onSubmit: (message: string) => Promise<void>;
  draft: string;
  onDraftChange: (value: string) => void;
};

export function ChatComposer({
  disabled,
  attachment,
  onAttachmentChange,
  onSubmit,
  draft,
  onDraftChange,
}: ChatComposerProps) {
  const textareaId = useId();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const speech = useSpeechRecognition({
    getDraft: () => draftRef.current,
    onFinalTranscript: (mergedDraft) => {
      onDraftChange(mergedDraft);
    },
  });

  function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    setValidationError(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setValidationError(
        "Only .csv files are supported for investigations.",
      );
      event.target.value = "";
      return;
    }
    onAttachmentChange(file);
  }

  async function submitCurrentDraft() {
    if (disabled) {
      return;
    }
    setValidationError(null);
    speech.stopListening();
    const trimmed = draft.trim();
    if (!trimmed) {
      setValidationError("Enter a message before sending.");
      return;
    }
    await onSubmit(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitCurrentDraft();
    }
  }

  return (
    <div className="border-t border-zinc-800/80 bg-zinc-950/95 px-3 py-3 backdrop-blur-md sm:px-4">
      <div className="mx-auto max-w-3xl">
        {attachment ? (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-teal-900/40 bg-teal-950/20 px-3 py-2">
            <p className="truncate text-xs text-teal-100">
              Attached: {attachment.name}
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onAttachmentChange(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100"
            >
              <X className="size-3.5" aria-hidden="true" />
              Remove
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2 focus-within:border-teal-800/60">
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={disabled}
            onChange={handleFilePick}
          />
          <label
            htmlFor={fileInputId}
            className={`inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 ${
              disabled ? "pointer-events-none opacity-50" : ""
            }`}
            aria-label="Attach CSV"
          >
            <Paperclip className="size-4" aria-hidden="true" />
          </label>

          {speech.uiState !== "unsupported" ? (
            speech.uiState === "listening" || speech.uiState === "processing" ? (
              <button
                type="button"
                onClick={speech.stopListening}
                disabled={speech.uiState === "processing"}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/30 text-red-200 disabled:opacity-60"
                aria-label="Stop listening"
              >
                <Square className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={speech.startListening}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:border-teal-800 hover:text-teal-200 disabled:opacity-50"
                aria-label="Speak your request"
              >
                <Mic className="size-4" aria-hidden="true" />
              </button>
            )
          ) : null}

          <label htmlFor={textareaId} className="sr-only">
            Investigation message
          </label>
          <textarea
            id={textareaId}
            rows={1}
            value={draft}
            disabled={disabled}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message NEXUS… (Enter to send, Shift+Enter for newline)"
            className="max-h-40 min-h-[44px] flex-1 resize-y bg-transparent px-2 py-2.5 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-60"
          />

          <button
            type="button"
            disabled={disabled}
            onClick={() => void submitCurrentDraft()}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-400/90 text-zinc-950 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {speech.uiState === "listening" ? (
          <p className="mt-2 text-xs text-teal-200/90" role="status">
            Listening… speak now, then edit the transcript before sending.
          </p>
        ) : null}
        {speech.uiState === "processing" ? (
          <p className="mt-2 text-xs text-zinc-400" role="status">
            Processing speech…
          </p>
        ) : null}
        {speech.interimTranscript ? (
          <p className="mt-1 text-xs text-teal-200/80">
            Preview: {speech.interimTranscript}
          </p>
        ) : null}
        {speech.errorMessage ? (
          <p className="mt-2 text-xs text-amber-200/90">{speech.errorMessage}</p>
        ) : null}
        {validationError ? (
          <p className="mt-2 text-xs text-red-400" role="alert">
            {validationError}
          </p>
        ) : null}
        <p className="mt-2 text-[0.65rem] text-zinc-600">
          CSV attachments only · Voice depends on browser support · Proposed actions are not auto-executed
        </p>
      </div>
    </div>
  );
}
