export type SpeechUiState =
  | "idle"
  | "listening"
  | "processing"
  | "unsupported"
  | "error";

export function resolveDefaultSpeechLanguage(
  preferred?: string,
  navigatorLanguage?: string,
): string {
  const candidate = preferred?.trim() || navigatorLanguage?.trim();
  if (!candidate) {
    return "en-US";
  }
  return candidate;
}

export function mergeSpeechTranscript(
  existingDraft: string,
  recognizedText: string,
): string {
  const base = existingDraft.trim();
  const addition = recognizedText.trim();
  if (!addition) {
    return base;
  }
  if (!base) {
    return addition;
  }
  if (base === addition || base.endsWith(addition)) {
    return base;
  }
  return `${base} ${addition}`;
}

export function mapSpeechRecognitionError(errorCode: string): string {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied. Allow microphone access to use speech input.";
    case "no-speech":
      return "No speech was detected. Try again or type your message.";
    case "audio-capture":
      return "No microphone was available. Check your device settings.";
    case "network":
      return "Speech recognition could not reach the browser’s online recognition service. Check your internet connection, try disabling VPN or ad blockers, then click the microphone again. You can still type your message.";
    case "aborted":
      return "";
    default:
      return "Speech recognition failed. You can still type your message.";
  }
}

export function shouldIgnoreSpeechError(errorCode: string): boolean {
  return errorCode === "aborted";
}

/** Chrome often reports `network` (not `aborted`) after an intentional stop/abort. */
export function shouldIgnoreSpeechErrorAfterUserStop(
  errorCode: string,
  userInitiatedStop: boolean,
): boolean {
  if (!userInitiatedStop) {
    return false;
  }
  return errorCode === "aborted" || errorCode === "network";
}
