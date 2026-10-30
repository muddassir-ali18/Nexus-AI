import type { StoredConversation } from "@/lib/chat/types";

export {
  INVESTIGATION_HISTORY_CHANGED_EVENT,
  INVESTIGATION_HISTORY_SERVER_SNAPSHOT,
  createConversationId,
  createConversationTitle,
  getInvestigationHistoryClientSnapshot,
  getInvestigationHistoryServerSnapshot,
  resetInvestigationHistoryStoreForTests,
  saveStoredConversations,
  subscribeInvestigationHistory,
} from "@/lib/chat/investigation-history-store";

import {
  getInvestigationHistoryClientSnapshot,
  resetInvestigationHistoryStoreForTests,
} from "@/lib/chat/investigation-history-store";

/** @deprecated Prefer getInvestigationHistoryClientSnapshot for useSyncExternalStore. */
export function getInvestigationHistorySnapshot(): StoredConversation[] {
  return getInvestigationHistoryClientSnapshot();
}

export function loadStoredConversations(): StoredConversation[] {
  return getInvestigationHistoryClientSnapshot();
}

/** @deprecated Use resetInvestigationHistoryStoreForTests */
export function resetInvestigationHistoryCacheForTests(): void {
  resetInvestigationHistoryStoreForTests();
}
