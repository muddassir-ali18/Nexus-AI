import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  eyebrow: string;
  description?: string;
  children?: ReactNode;
};

export function Panel({ title, eyebrow, description, children }: PanelProps) {
  return (
    <section className="flex min-h-[11rem] flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-sm font-medium text-zinc-100">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
