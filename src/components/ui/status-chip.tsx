type StatusChipProps = {
  label: string;
};

export function StatusChip({ label }: StatusChipProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium tracking-wide text-zinc-400">
      {label}
    </span>
  );
}
