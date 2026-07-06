// Blocos partilhados do centro de comando — tooltips, mini-barras, chips e células KPI.
// Construídos sobre os primitivos shadcn/ui (Tooltip, Badge, Progress, Card) para que toda
// a plataforma partilhe a mesma base visual, mantendo a estética escura/mono do Lusorae.

import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X, Star } from "lucide-react";
import { getDisplayPrefs } from "../../lib/game";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";

const SIDE_ALIGN_OFFSET = { top: 6, bottom: 6, left: 6, right: 6 };

// Radix Tooltip só abre com hover/foco — em ecrãs táteis (sem hover) isso
// deixa os ícones/textos informativos sem forma de mostrar a explicação.
// Popover resolve isto: abre ao clicar/tocar (e continua a abrir com hover
// no ambiente secretário), fecha ao clicar fora — tal como funcionava antes.
export const Tip = ({ tip, side = "top", align = "center", block = false, className = "", children }) => {
  const [open, setOpen] = useState(false);
  if (!tip || getDisplayPrefs().showTooltips === false) return children;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={`${block ? "block" : "inline-flex"} ${className}`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={SIDE_ALIGN_OFFSET[side] ?? 6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-auto max-w-[16rem] border-white/10 bg-black/95 p-2 font-mono text-[11px] leading-snug text-zinc-200 shadow-2xl backdrop-blur-xl"
      >
        {tip}
      </PopoverContent>
    </Popover>
  );
};

export const MiniBar = ({ value, color, className = "", height = "h-1" }) => (
  <Progress
    value={Math.min(100, Math.max(0, value || 0))}
    className={cn(height, "w-full bg-white/10", className)}
    indicatorStyle={{ background: color }}
  />
);

export const Chip = ({ icon: Icon, label, value, color = "#A1A1AA", valueColor = "#FFFFFF", tip, side = "top", testId }) => (
  <Tip tip={tip} side={side}>
    <Badge
      data-testid={testId}
      variant="outline"
      className="gap-1 rounded border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-normal text-zinc-400"
    >
      {Icon && <Icon size={9} style={{ color }} />}
      {label && <span className="uppercase tracking-wider text-zinc-500">{label}</span>}
      {value != null && <span className="font-bold" style={{ color: valueColor }}>{value}</span>}
    </Badge>
  </Tip>
);

export const Kpi = ({ icon: Icon, label, value, sub, color = "#FFFFFF", subColor = "#71717A", tip, side = "top", bar, barColor, testId }) => (
  <Tip tip={tip} side={side} block>
    <Card data-testid={testId} className="h-full rounded-lg border-white/10 bg-card p-2 shadow-none">
      <p className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-zinc-500">
        {Icon && <Icon size={9} style={{ color }} />} <span className="truncate">{label}</span>
      </p>
      <p className="mt-0.5 truncate font-mono text-[11px] font-bold leading-tight" style={{ color }}>{value}</p>
      {sub != null && <p className="truncate font-mono text-[9px] leading-tight" style={{ color: subColor }}>{sub}</p>}
      {bar != null && <MiniBar value={bar} color={barColor || color} className="mt-1" height="h-0.5" />}
    </Card>
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

// Nome de um item (veículo/operacional/propriedade) com um lápis ao lado que troca
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
        <Input
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
          className="h-auto w-full min-w-0 border-input bg-black/60 px-1.5 py-0.5 font-mono text-xs text-white"
        />
        <button
          data-testid={testId && `${testId}-save`}
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={save}
          className="shrink-0 text-success transition-colors hover:brightness-125"
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
// operacionais e veículos favoritos ficam sempre fixos no topo da respetiva lista.
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
// o segundo clique dentro desse período executa a ação. Fica sobre bg-destructive
// quando armado, para deixar claro que o clique seguinte é definitivo.
export const ConfirmButton = ({
  testId, icon: Icon, label, confirmLabel = "Confirmar?", color = "text-red-400",
  onConfirm, disabled, className = "", armMs = 3000, tip,
}) => {
  const [armed, setArmed] = useState(false);
  const skipArm = getDisplayPrefs().confirmIrreversible === false;
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), armMs);
    return () => clearTimeout(id);
  }, [armed, armMs]);
  return (
    <Tip tip={armed ? "Clica outra vez para confirmar — ação irreversível." : tip} block className={className}>
      <button
        data-testid={testId}
        onClick={() => { if (skipArm) { onConfirm(); return; } if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[10px] transition-colors disabled:opacity-40",
          armed
            ? "border-destructive/60 bg-destructive/20 text-destructive"
            : disabled
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : `border-input ${color} hover:bg-accent`
        )}
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
