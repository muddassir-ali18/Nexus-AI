"use client";

import type { ReactNode } from "react";

type ChatInfoDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function ChatInfoDialog({
  open,
  title,
  onClose,
  children,
}: ChatInfoDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-info-title"
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="chat-info-title" className="text-lg font-semibold text-zinc-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-900"
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">{children}</div>
      </div>
    </div>
  );
}
