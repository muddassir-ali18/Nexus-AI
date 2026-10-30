"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  mapSpeechRecognitionError,
  mergeSpeechTranscript,
  resolveDefaultSpeechLanguage,
  shouldIgnoreSpeechError,
  shouldIgnoreSpeechErrorAfterUserStop,
  type SpeechUiState,
} from "@/lib/speech/speech-recognition-core";

export type SpeechRecognitionUiState = SpeechUiState;

type SpeechRecognitionCtor = new () => SpeechRecognition;

function subscribeNoop(onStoreChange: () => void): () => void {
  void onStoreChange;
  return () => {};
}

function useIsBrowserClient(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition ??
    null
  );
}

export function useSpeechRecognition(options?: {
  lang?: string;
  onFinalTranscript?: (text: string) => void;
  getDraft?: () => string;
}) {
  const isBrowserClient = useIsBrowserClient();
  const [uiState, setUiState] = useState<SpeechRecognitionUiState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const processedResultIndexRef = useRef(0);
  const userInitiatedStopRef = useRef(false);
  const onFinalTranscriptRef = useRef(options?.onFinalTranscript);
  const getDraftRef = useRef(options?.getDraft);
  const lang = resolveDefaultSpeechLanguage(
    options?.lang,
    typeof navigator !== "undefined" ? navigator.language : undefined,
  );
  const speechSupported =
    isBrowserClient && Boolean(getSpeechRecognitionCtor());
  const effectiveUiState =
    isBrowserClient && !speechSupported && uiState === "idle"
      ? "unsupported"
      : uiState;

  useEffect(() => {
    onFinalTranscriptRef.current = options?.onFinalTranscript;
    getDraftRef.current = options?.getDraft;
  }, [options?.onFinalTranscript, options?.getDraft]);

  const stopListening = useCallback(() => {
    userInitiatedStopRef.current = true;
    const active = recognitionRef.current;
    if (active) {
      try {
        active.stop();
      } catch {
        try {
          active.abort();
        } catch {
          // Recognition may already have ended.
        }
      }
    }
    recognitionRef.current = null;
    processedResultIndexRef.current = 0;
    setInterimTranscript("");
    setUiState((current) =>
      current === "listening" || current === "processing" ? "idle" : current,
    );
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      return;
    }

    setErrorMessage(null);
    setInterimTranscript("");
    processedResultIndexRef.current = 0;
    userInitiatedStopRef.current = false;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setUiState("unsupported");
      setErrorMessage(
        "Speech recognition is not supported in this browser. Type your message instead.",
      );
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        userInitiatedStopRef.current = false;
        setUiState("listening");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result) {
            continue;
          }

          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) {
            if (index >= processedResultIndexRef.current && transcript.trim()) {
              processedResultIndexRef.current = index + 1;
              const draft = getDraftRef.current?.() ?? "";
              const merged = mergeSpeechTranscript(draft, transcript);
              onFinalTranscriptRef.current?.(merged);
              setInterimTranscript("");
            }
          } else {
            interim += transcript;
          }
        }

        if (interim.trim()) {
          setInterimTranscript(interim.trim());
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        recognitionRef.current = null;
        processedResultIndexRef.current = 0;
        setInterimTranscript("");

        const userStopped = userInitiatedStopRef.current;
        userInitiatedStopRef.current = false;

        if (
          shouldIgnoreSpeechError(event.error) ||
          shouldIgnoreSpeechErrorAfterUserStop(event.error, userStopped)
        ) {
          setUiState("idle");
          return;
        }

        const message = mapSpeechRecognitionError(event.error);
        if (message) {
          setErrorMessage(message);
          setUiState("error");
        } else {
          setUiState("idle");
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        processedResultIndexRef.current = 0;
        setInterimTranscript("");
        setUiState((current) => {
          if (current === "listening") {
            return "processing";
          }
          return current === "processing" ? "idle" : current;
        });

        window.setTimeout(() => {
          setUiState((current) => (current === "processing" ? "idle" : current));
        }, 150);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setUiState("error");
      setErrorMessage("Unable to start speech recognition in this browser.");
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      userInitiatedStopRef.current = true;
      const active = recognitionRef.current;
      if (active) {
        try {
          active.stop();
        } catch {
          try {
            active.abort();
          } catch {
            // Ignore teardown errors.
          }
        }
      }
      recognitionRef.current = null;
    };
  }, []);

  return {
    uiState: effectiveUiState,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    isSupported: speechSupported,
  };
}
