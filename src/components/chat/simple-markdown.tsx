import type { ReactNode } from "react";
import { isEvidenceSourceUrl } from "@/components/dashboard/investigation-ui";

type SimpleMarkdownProps = {
  content: string;
};

function renderInline(text: string, keyPrefix: string) {
  const parts: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`${keyPrefix}-link-${match.index}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal-300 underline underline-offset-2 hover:text-teal-200"
      >
        {match[1]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    parts.push(...renderBoldInline(tail, `${keyPrefix}-tail`));
  }

  return parts;
}

function renderBoldInline(text: string, keyPrefix: string): ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-zinc-100">
          {segment.slice(2, -2)}
        </strong>
      );
    }

    const urlMatch = segment.match(/(https?:\/\/[^\s]+)/g);
    if (!urlMatch) {
      return segment;
    }

    let cursor = 0;
    const nodes: ReactNode[] = [];
    for (const url of urlMatch) {
      const start = segment.indexOf(url, cursor);
      if (start > cursor) {
        nodes.push(segment.slice(cursor, start));
      }
      if (isEvidenceSourceUrl(url)) {
        nodes.push(
          <a
            key={`${keyPrefix}-u-${index}-${start}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-teal-300 underline underline-offset-2 hover:text-teal-200"
          >
            {url}
          </a>,
        );
      } else {
        nodes.push(url);
      }
      cursor = start + url.length;
    }
    if (cursor < segment.length) {
      nodes.push(segment.slice(cursor));
    }
    return <span key={`${keyPrefix}-s-${index}`}>{nodes}</span>;
  });
}

export function SimpleMarkdown({ content }: SimpleMarkdownProps) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      blocks.push(<div key={`sp-${index}`} className="h-2" />);
      return;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4 key={`h3-${index}`} className="mt-3 text-sm font-semibold text-zinc-100">
          {trimmed.slice(4)}
        </h4>,
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3 key={`h2-${index}`} className="mt-4 text-base font-semibold text-zinc-50">
          {trimmed.slice(3)}
        </h3>,
      );
      return;
    }

    if (trimmed.startsWith("- ")) {
      blocks.push(
        <li key={`li-${index}`} className="ml-4 list-disc text-sm leading-6 text-zinc-300">
          {renderInline(trimmed.slice(2), `li-${index}`)}
        </li>,
      );
      return;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      blocks.push(
        <code
          key={`table-${index}`}
          className="block overflow-x-auto rounded-md bg-zinc-900/80 px-2 py-1 text-xs text-zinc-300"
        >
          {trimmed}
        </code>,
      );
      return;
    }

    blocks.push(
      <p key={`p-${index}`} className="text-sm leading-7 text-zinc-300">
        {renderInline(trimmed, `p-${index}`)}
      </p>,
    );
  });

  return <div className="space-y-1">{blocks}</div>;
}
