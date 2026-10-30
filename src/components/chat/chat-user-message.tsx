import type { ChatUserMessage } from "@/lib/chat/types";
import { Paperclip } from "lucide-react";

type ChatUserMessageProps = {
  message: ChatUserMessage;
};

export function ChatUserMessageBlock({ message }: ChatUserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-3xl rounded-2xl border border-teal-900/30 bg-teal-950/20 px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-100">
          {message.content}
        </p>
        {message.attachmentName ? (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-teal-200/90">
            <Paperclip className="size-3.5" aria-hidden="true" />
            {message.attachmentName}
          </p>
        ) : null}
      </div>
    </div>
  );
}
