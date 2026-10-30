"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { InvestigateApiResponse } from "@/lib/agents/types";
import { buildInvestigateFetchRequest } from "@/lib/api/investigate-client";
import type {
  ChatAssistantMessage,
  ChatMessage,
  ChatUserMessage,
  StoredConversation,
} from "@/lib/chat/types";
import {
  createConversationId,
  createConversationTitle,
  getInvestigationHistoryClientSnapshot,
  getInvestigationHistoryServerSnapshot,
  loadStoredConversations,
  saveStoredConversations,
  subscribeInvestigationHistory,
} from "@/lib/chat/investigation-history";
import { ChatAssistantMessageBlock } from "@/components/chat/chat-assistant-message";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatInfoDialog } from "@/components/chat/chat-info-dialog";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatUserMessageBlock } from "@/components/chat/chat-user-message";
import { ChatWelcome } from "@/components/chat/chat-welcome";

export function InvestigationSession() {
  const conversations = useSyncExternalStore(
    subscribeInvestigationHistory,
    getInvestigationHistoryClientSnapshot,
    getInvestigationHistoryServerSnapshot,
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);
  const [lastFailedUserMessage, setLastFailedUserMessage] = useState<string | null>(
    null,
  );

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const messages = activeConversation?.messages ?? [];
  const hasMessages = messages.length > 0;

  const persistConversation = useCallback((conversation: StoredConversation) => {
    const current = loadStoredConversations();
    const without = current.filter((item) => item.id !== conversation.id);
    saveStoredConversations([conversation, ...without]);
  }, []);

  const startNewConversation = useCallback(() => {
    const id = createConversationId();
    const now = new Date().toISOString();
    const conversation: StoredConversation = {
      id,
      title: "New investigation",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    setActiveConversationId(id);
    setDraft("");
    setAttachment(null);
    setLastFailedUserMessage(null);
    persistConversation(conversation);
  }, [persistConversation]);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setDraft("");
    setAttachment(null);
    setLastFailedUserMessage(null);
  }, []);

  const submitMessage = useCallback(
    async (messageText: string) => {
      if (isSubmitting) {
        return;
      }

      let conversationId = activeConversationId;
      let conversation = activeConversation;

      if (!conversationId || !conversation) {
        conversationId = createConversationId();
        const now = new Date().toISOString();
        conversation = {
          id: conversationId,
          title: createConversationTitle(messageText),
          createdAt: now,
          updatedAt: now,
          messages: [],
        };
        setActiveConversationId(conversationId);
      }

      const now = new Date().toISOString();
      const userMessage: ChatUserMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageText,
        attachmentName: attachment?.name ?? null,
        createdAt: now,
      };
      const loadingAssistant: ChatAssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "loading",
        createdAt: now,
        error: null,
        payload: null,
      };

      const withUserMessages: StoredConversation = {
        ...conversation,
        title: createConversationTitle(messageText),
        updatedAt: now,
        messages: [...conversation.messages, userMessage, loadingAssistant],
      };

      persistConversation(withUserMessages);
      setDraft("");
      setIsSubmitting(true);
      setLastFailedUserMessage(null);

      try {
        const { init } = buildInvestigateFetchRequest({
          question: messageText,
          csvFile: attachment,
        });

        const response = await fetch("/api/investigate", init);
        const payload = (await response.json()) as InvestigateApiResponse;

        const completedAt = new Date().toISOString();

        if (!response.ok || !payload.success) {
          const errorMessage = payload.success
            ? "Investigation request failed."
            : payload.error;
          const errorAssistant: ChatAssistantMessage = {
            ...loadingAssistant,
            status: "error",
            createdAt: completedAt,
            error: errorMessage,
            payload: null,
          };
          persistConversation({
            ...withUserMessages,
            updatedAt: completedAt,
            messages: withUserMessages.messages.map((message) =>
              message.id === loadingAssistant.id ? errorAssistant : message,
            ),
          });
          setLastFailedUserMessage(messageText);
          return;
        }

        const successAssistant: ChatAssistantMessage = {
          ...loadingAssistant,
          status: "complete",
          createdAt: completedAt,
          error: null,
          payload,
        };

        persistConversation({
          ...withUserMessages,
          updatedAt: completedAt,
          messages: withUserMessages.messages.map((message) =>
            message.id === loadingAssistant.id ? successAssistant : message,
          ),
        });
      } catch {
        const completedAt = new Date().toISOString();
        const errorAssistant: ChatAssistantMessage = {
          ...loadingAssistant,
          status: "error",
          createdAt: completedAt,
          error: "Unable to reach the investigation service.",
          payload: null,
        };
        persistConversation({
          ...withUserMessages,
          updatedAt: completedAt,
          messages: withUserMessages.messages.map((message) =>
            message.id === loadingAssistant.id ? errorAssistant : message,
          ),
        });
        setLastFailedUserMessage(messageText);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeConversation,
      activeConversationId,
      attachment,
      isSubmitting,
      persistConversation,
    ],
  );

  const handleRetry = useCallback(async () => {
    if (!lastFailedUserMessage?.trim() || isSubmitting) {
      return;
    }
    await submitMessage(lastFailedUserMessage);
  }, [isSubmitting, lastFailedUserMessage, submitMessage]);

  return (
    <div className="flex h-dvh bg-zinc-950 text-zinc-100">
      <ChatSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewConversation={startNewConversation}
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
        onOpenAbout={() => setAboutOpen(true)}
        onOpenCapabilities={() => setCapabilitiesOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col md:pl-0">
        <header className="hidden border-b border-zinc-800/80 px-4 py-3 md:block">
          <p className="text-sm text-zinc-400">
            {activeConversation?.title ?? "NEXUS SEO Agent"}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto pb-4 pt-14 md:pt-4">
          {!hasMessages ? (
            <ChatWelcome
              disabled={isSubmitting}
              onSelectPrompt={(prompt) => setDraft(prompt)}
            />
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-3 py-4 sm:px-6">
              {messages.map((message: ChatMessage) =>
                message.role === "user" ? (
                  <ChatUserMessageBlock key={message.id} message={message} />
                ) : (
                  <ChatAssistantMessageBlock
                    key={message.id}
                    message={message}
                    onRetry={
                      message.status === "error" &&
                      message.id === messages[messages.length - 1]?.id
                        ? handleRetry
                        : undefined
                    }
                    isRetrying={isSubmitting}
                  />
                ),
              )}
            </div>
          )}
        </div>

        <ChatComposer
          disabled={isSubmitting}
          attachment={attachment}
          onAttachmentChange={setAttachment}
          onSubmit={submitMessage}
          draft={draft}
          onDraftChange={setDraft}
        />
      </div>

      <ChatInfoDialog open={aboutOpen} title="About NEXUS" onClose={() => setAboutOpen(false)}>
        <p>
          NEXUS is a multi-agent investigation workspace for SEO and business questions.
          It uses Nemotron for planning and synthesis, deterministic tools for CSV metrics,
          and optional Tavily-backed web research.
        </p>
        <p>
          Investigation history is stored locally in your browser. CSV file contents are
          not persisted—re-attach a CSV to rerun analysis.
        </p>
      </ChatInfoDialog>

      <ChatInfoDialog
        open={capabilitiesOpen}
        title="Capabilities & limitations"
        onClose={() => setCapabilitiesOpen(false)}
      >
        <ul className="list-disc space-y-2 pl-5">
          <li>Supported investigation attachment: CSV only.</li>
          <li>No live website crawl or technical SEO audit execution.</li>
          <li>No Google Search Console, rank tracking, or keyword volume APIs.</li>
          <li>Voice input depends on browser Web Speech API support.</li>
          <li>Proposed actions are approval-gated and are not auto-executed.</li>
          <li>NEXUS is not a fully autonomous SEO auditor.</li>
        </ul>
      </ChatInfoDialog>
    </div>
  );
}
