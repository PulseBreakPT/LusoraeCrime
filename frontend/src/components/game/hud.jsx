// Blocos partilhados do centro de comando — tooltips, mini-barras, chips e células KPI.
// Mantêm a UI densa em informação mas visualmente leve e consistente.

import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X, Star } from "lucide-react";

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

// Nome de um item (veículo/funcionário/propriedade) com um lápis ao lado que troca
// para um input inline + guardar/cancelar. Substitui o <p>{item.name}</p> estático.
export const InlineRename = ({ value, onSave, testId, maxLength = 40, textClassName = "" }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    const save = () => {
      const trimmed = draft.trim();
      if (trimmed && trimmed !== value) onSave(trimmed);
      setEditing(false);
    };
    return (
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <input
          data-testid={testId && `${testId}-input`}
          autoFocus
          value={draft}
          maxLength={maxLength}
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={save}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") save();
            if (ev.key === "Escape") setEditing(false);
          }}
          className="w-full min-w-0 rounded border border-white/10 bg-black/60 px-1.5 py-0.5 font-mono text-xs text-white"
        />
        <button
          data-testid={testId && `${testId}-save`}
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={save}
          className="shrink-0 text-emerald-400 transition-colors hover:text-emerald-300"
        >
          <Check size={14} />
        </button>
        <button
          data-testid={testId && `${testId}-cancel`}
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={() => setEditing(false)}
          className="shrink-0 text-zinc-500 transition-colors hover:text-white"
        >
          <X size={14} />
        </button>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className={`truncate ${textClassName}`}>{value}</span>
      <Tip tip="Renomear">
        <button
          data-testid={testId && `${testId}-edit`}
          onClick={() => { setDraft(value); setEditing(true); }}
          className="shrink-0 text-zinc-600 transition-colors hover:text-white"
        >
          <Pencil size={11} />
        </button>
      </Tip>
    </span>
  );
};

// Estrela de favorito — puramente local (não passa pelo servidor). Equipas,
// funcionários e veículos favoritos ficam sempre fixos no topo da respetiva lista.
export const FavoriteStar = ({ active, onToggle, testId, size = 13 }) => (
  <Tip tip={active ? "Remover dos favoritos" : "Marcar como favorito — fica sempre no topo da lista"}>
    <button
      data-testid={testId}
      onClick={(ev) => { ev.stopPropagation(); onToggle(); }}
      className={`shrink-0 rounded p-0.5 transition-colors ${active ? "text-amber-400 hover:text-amber-300" : "text-zinc-600 hover:text-white"}`}
    >
      <Star size={size} fill={active ? "currentColor" : "none"} />
    </button>
  </Tip>
);

// Botão de confirmação em dois passos para ações irreversíveis (despedir, vender,
// abater) — sem modais: o primeiro clique arma um curto período de confirmação,
// o segundo clique dentro desse período executa a ação.
export const ConfirmButton = ({
  testId, icon: Icon, label, confirmLabel = "Confirmar?", color = "text-red-400",
  onConfirm, disabled, className = "", armMs = 3000, tip,
}) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), armMs);
    return () => clearTimeout(id);
  }, [armed, armMs]);
  return (
    <Tip tip={armed ? "Clica outra vez para confirmar — ação irreversível." : tip} block className={className}>
      <button
        data-testid={testId}
        onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
        disabled={disabled}
        className={`flex w-full items-center justify-center gap-1 rounded border px-2 py-1.5 font-mono text-[10px] transition-colors disabled:opacity-40 ${
          armed ? "border-red-500/60 bg-red-500/20 text-red-300" : `border-white/10 ${color} hover:bg-white/5`
        }`}
      >
        {Icon && <Icon size={11} />} {armed ? confirmLabel : label}
      </button>
    </Tip>
  );
};

// Pisca brevemente quando um valor observado muda (ex.: uma equipa que acabou
// de regressar, uma missão que ficou pronta) — chama a atenção sem depender de texto.
export const useFlash = (value, ms = 2500) => {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return flash;
};

// Número que anima suavemente entre o valor anterior e o novo, em vez de saltar
// instantaneamente — usado no dinheiro e respeito na barra de recursos.
export const AnimatedNumber = ({ value, format = (v) => Math.round(v).toString(), duration = 600, className = "" }) => {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (Math.abs(to - from) < 0.01) {
      setDisplay(to);
      displayRef.current = to;
      return;
    }
    let raf;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      displayRef.current = next;
      if (t < 1) raf = requestAnimationFrame(step);
      else displayRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => raf && cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
};
