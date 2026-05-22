type SectionNumberProps = {
  children: React.ReactNode;
  label?: string;
};

export function SectionNumber({ children, label }: SectionNumberProps) {
  return (
    <div className="flex items-baseline gap-3 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet">
      <span>{children}</span>
      {label ? <span>—&nbsp;{label}</span> : null}
    </div>
  );
}
