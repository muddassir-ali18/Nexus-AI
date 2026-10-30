import type { InvestigateApiSuccess } from "@/lib/agents/types";

export type ChatUserMessage = {
  id: string;
  role: "user";
  content: string;
  attachmentName: string | null;
  createdAt: string;
};

export type ChatAssistantMessage = {
  id: string;
  role: "assistant";
  status: "loading" | "complete" | "error";
  createdAt: string;
  error: string | null;
  payload: InvestigateApiSuccess | null;
};

export type ChatMessage = ChatUserMessage | ChatAssistantMessage;

export type StoredConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export const INVESTIGATION_HISTORY_STORAGE_KEY = "nexus-investigation-history-v1";
export const MAX_STORED_CONVERSATIONS = 30;
