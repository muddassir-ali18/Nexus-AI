"use client";

import type { StoredConversation } from "@/lib/chat/types";
import {
  Info,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
} from "lucide-react";

type ChatSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  conversations: StoredConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onOpenAbout: () => void;
  onOpenCapabilities: () => void;
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatSidebar({
  collapsed,
  onToggleCollapsed,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  mobileOpen,
  onMobileOpenChange,
  onOpenAbout,
  onOpenCapabilities,
}: ChatSidebarProps) {
  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-800/80 p-3">
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">NEXUS</p>
            <p className="truncate text-xs text-zinc-500">SEO Agent Workspace</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden size-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 md:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onMobileOpenChange(false)}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 md:hidden"
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            onNewConversation();
            onMobileOpenChange(false);
          }}
          className={`flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 ${
            collapsed ? "justify-center px-2" : ""
          }`}
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          {!collapsed ? <span>New investigation</span> : null}
        </button>
      </div>

      {!collapsed ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <p className="px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-zinc-600">
            Recent
          </p>
          {conversations.length === 0 ? (
            <p className="px-2 py-3 text-xs leading-5 text-zinc-500">
              No saved investigations yet. Completed chats are stored locally in
              this browser.
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conversation) => {
                const active = conversation.id === activeConversationId;
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectConversation(conversation.id);
                        onMobileOpenChange(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                        active
                          ? "bg-teal-950/40 text-teal-100"
                          : "text-zinc-300 hover:bg-zinc-900"
                      }`}
                    >
                      <p className="line-clamp-2 text-sm">{conversation.title}</p>
                      <p className="mt-1 text-[0.65rem] text-zinc-500">
                        {formatRelativeTime(conversation.updatedAt)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="space-y-1 border-t border-zinc-800/80 p-3">
        <button
          type="button"
          onClick={onOpenCapabilities}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Settings className="size-4" aria-hidden="true" />
          {!collapsed ? <span>Capabilities</span> : null}
        </button>
        <button
          type="button"
          onClick={onOpenAbout}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Info className="size-4" aria-hidden="true" />
          {!collapsed ? <span>About</span> : null}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => onMobileOpenChange(true)}
        className="fixed left-3 top-3 z-30 inline-flex size-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 md:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="size-4" aria-hidden="true" />
      </button>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar backdrop"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-zinc-800/80 bg-zinc-950 transition-transform md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-[4.5rem]" : "w-72"} md:flex`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
