// Blocos partilhados do centro de comando — tooltips, mini-barras, chips e células KPI.
// Mantêm a UI densa em informação mas visualmente leve e consistente.

export const Tip = ({ tip, side = "top", align = "center", block = false, className = "", children }) => {
  if (!tip) return children;
  return (
    <span
      className={`lus-tip ${block ? "block" : "inline-flex"} ${className}`}
      data-tip={tip}
      data-side={side}
      data-align={align}
    >
      {children}
    </span>
  );
};

export const MiniBar = ({ value, color, className = "", height = "h-1" }) => (
  <div className={`${height} w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
    <div
      className="h-full rounded-full transition-all duration-500"
      style={{ width: `${Math.min(100, Math.max(0, value || 0))}%`, background: color }}
    />
  </div>
);

export const Chip = ({ icon: Icon, label, value, color = "#A1A1AA", valueColor = "#FFFFFF", tip, side = "top", testId }) => (
  <Tip tip={tip} side={side}>
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-zinc-400"
    >
      {Icon && <Icon size={9} style={{ color }} />}
      {label && <span className="uppercase tracking-wider text-zinc-500">{label}</span>}
      {value != null && <span className="font-bold" style={{ color: valueColor }}>{value}</span>}
    </span>
  </Tip>
);

export const Kpi = ({ icon: Icon, label, value, sub, color = "#FFFFFF", subColor = "#71717A", tip, side = "top", bar, barColor, testId }) => (
  <Tip tip={tip} side={side} block>
    <div data-testid={testId} className="h-full rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <p className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-zinc-500">
        {Icon && <Icon size={9} style={{ color }} />} <span className="truncate">{label}</span>
      </p>
      <p className="mt-0.5 truncate font-mono text-[11px] font-bold leading-tight" style={{ color }}>{value}</p>
      {sub != null && <p className="truncate font-mono text-[9px] leading-tight" style={{ color: subColor }}>{sub}</p>}
      {bar != null && <MiniBar value={bar} color={barColor || color} className="mt-1" height="h-0.5" />}
    </div>
  </Tip>
);

export const SummaryStrip = ({ cols = 4, children, testId, className = "" }) => (
  <div
    data-testid={testId}
    className={`grid gap-1.5 ${className}`}
    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
  >
    {children}
  </div>
);
