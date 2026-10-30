import type { StoredConversation } from "@/lib/chat/types";
import {
  INVESTIGATION_HISTORY_STORAGE_KEY,
  MAX_STORED_CONVERSATIONS,
} from "@/lib/chat/types";

export const INVESTIGATION_HISTORY_CHANGED_EVENT =
  "nexus-investigation-history-changed";

/**
 * Single frozen empty snapshot for SSR and empty client state.
 * Server and client empty reads must return this exact reference.
 */
export const INVESTIGATION_HISTORY_SERVER_SNAPSHOT: StoredConversation[] = [];
Object.freeze(INVESTIGATION_HISTORY_SERVER_SNAPSHOT);

const UNINITIALIZED = Symbol("investigation-history-uninitialized");

let clientSnapshot: StoredConversation[] = INVESTIGATION_HISTORY_SERVER_SNAPSHOT;
let cachedStorageRaw: string | null | typeof UNINITIALIZED = UNINITIALIZED;

function notifyInvestigationHistoryChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (typeof window.dispatchEvent !== "function") {
    return;
  }
  window.dispatchEvent(new Event(INVESTIGATION_HISTORY_CHANGED_EVENT));
}

export function subscribeInvestigationHistory(
  onStoreChange: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(INVESTIGATION_HISTORY_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(
      INVESTIGATION_HISTORY_CHANGED_EVENT,
      onStoreChange,
    );
    window.removeEventListener("storage", onStoreChange);
  };
}

function isStoredConversation(value: unknown): value is StoredConversation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as StoredConversation;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    Array.isArray(record.messages)
  );
}

function readStorageRaw(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(INVESTIGATION_HISTORY_STORAGE_KEY);
}

function materializeSnapshotFromRaw(raw: string | null): StoredConversation[] {
  if (!raw) {
    return INVESTIGATION_HISTORY_SERVER_SNAPSHOT;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return INVESTIGATION_HISTORY_SERVER_SNAPSHOT;
    }
    const conversations = parsed.filter(isStoredConversation);
    return conversations.length === 0
      ? INVESTIGATION_HISTORY_SERVER_SNAPSHOT
      : conversations;
  } catch {
    return INVESTIGATION_HISTORY_SERVER_SNAPSHOT;
  }
}

function syncClientSnapshotFromStorageIfNeeded(): StoredConversation[] {
  const raw = readStorageRaw();
  if (cachedStorageRaw !== UNINITIALIZED && raw === cachedStorageRaw) {
    return clientSnapshot;
  }
  cachedStorageRaw = raw;
  clientSnapshot = materializeSnapshotFromRaw(raw);
  return clientSnapshot;
}

/** SSR + hydration server snapshot (referentially stable). */
export function getInvestigationHistoryServerSnapshot(): StoredConversation[] {
  return INVESTIGATION_HISTORY_SERVER_SNAPSHOT;
}

/** Client snapshot; stable until localStorage raw value changes. */
export function getInvestigationHistoryClientSnapshot(): StoredConversation[] {
  if (typeof window === "undefined") {
    return INVESTIGATION_HISTORY_SERVER_SNAPSHOT;
  }
  return syncClientSnapshotFromStorageIfNeeded();
}

export function saveStoredConversations(conversations: StoredConversation[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const trimmed = conversations.slice(0, MAX_STORED_CONVERSATIONS);
  const raw = JSON.stringify(trimmed);

  window.localStorage.setItem(INVESTIGATION_HISTORY_STORAGE_KEY, raw);
  cachedStorageRaw = raw;
  clientSnapshot =
    trimmed.length === 0
      ? INVESTIGATION_HISTORY_SERVER_SNAPSHOT
      : trimmed;
  notifyInvestigationHistoryChanged();
}

export function createConversationTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  if (!trimmed) {
    return "New investigation";
  }
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
}

export function createConversationId(): string {
  return crypto.randomUUID();
}

/** @internal Resets in-memory cache (for unit tests only). */
export function resetInvestigationHistoryStoreForTests(): void {
  clientSnapshot = INVESTIGATION_HISTORY_SERVER_SNAPSHOT;
  cachedStorageRaw = UNINITIALIZED;
}
