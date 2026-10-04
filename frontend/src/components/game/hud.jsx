// Blocos partilhados do centro de comando — tooltips, mini-barras, chips e células KPI.
// Construídos sobre os primitivos shadcn/ui (Tooltip, Badge, Progress, Card) para que toda
// a plataforma partilhe a mesma base visual, mantendo a estética escura/mono do SUBMUNDO.

import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X, Star, Loader2 } from "lucide-react";
import { getDisplayPrefs } from "../../lib/game";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";

const SIDE_ALIGN_OFFSET = { top: 6, bottom: 6, left: 6, right: 6 };

// Deteção de ambiente com rato real (hover + ponteiro fino). Em ecrãs táteis o
// browser emula mouseenter/click no toque, o que fazia os tooltips abrirem e
// ficarem presos no ecrã sempre que se tocava num botão de ação.
const hasFinePointer = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Radix Tooltip só abre com hover/foco — em ecrãs táteis (sem hover) isso
// deixa os ícones/textos informativos sem forma de mostrar a explicação.
// Popover resolve isto: abre ao clicar/tocar (e continua a abrir com hover
// no ambiente secretário), fecha ao clicar fora — tal como funcionava antes.
// Regra tátil: se o conteúdo do Tip for um elemento interativo (botão/link),
// o toque executa apenas a ação — o tooltip não abre nem fica preso. Chips e
// células meramente informativas continuam a abrir a explicação com um toque.
export const Tip = ({ tip, side = "top", align = "center", block = false, className = "", children }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const interactiveRef = useRef(false);
  useEffect(() => {
    if (triggerRef.current) {
      interactiveRef.current = !!triggerRef.current.querySelector(
        'button, a, [role="button"], input, select, textarea'
      );
    }
  });
  if (!tip || getDisplayPrefs().showTooltips === false) return children;
  const handleOpenChange = (o) => {
    if (o && !hasFinePointer() && interactiveRef.current) return;
    setOpen(o);
  };
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span
          ref={triggerRef}
          className={`${block ? "block" : "inline-flex"} ${className}`}
          onMouseEnter={() => { if (hasFinePointer()) setOpen(true); }}
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
      className="gap-1 rounded-md border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-normal text-zinc-400"
    >
      {Icon && <Icon size={9} style={{ color }} />}
      {label && <span className="uppercase tracking-wider text-zinc-500">{label}</span>}
      {value != null && <span className="font-bold" style={{ color: valueColor }}>{value}</span>}
    </Badge>
  </Tip>
);

export const Kpi = ({ icon: Icon, label, value, sub, color = "#FFFFFF", subColor = "#71717A", tip, side = "top", bar, barColor, testId }) => (
  <Tip tip={tip} side={side} block>
    <Card data-testid={testId} className="sub-kpi h-full rounded-lg sub-card p-2.5 shadow-none">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-zinc-500">
        {Icon && <Icon size={10} style={{ color }} />} <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 truncate font-mono text-sm font-bold leading-tight" style={{ color }}>{value}</p>
      {sub != null && <p className="mt-0.5 truncate font-mono text-[10px] leading-tight" style={{ color: subColor }}>{sub}</p>}
      {bar != null && <MiniBar value={bar} color={barColor || color} className="mt-1.5" height="h-0.5" />}
    </Card>
  </Tip>
);

// Em mobile as tiras de 4+ KPIs ficavam com células tão estreitas que os
// rótulos truncavam ("LEALD…", "DISPO…") — abaixo de `sm` passam a grelha 2×N.
const STRIP_COLS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-6",
};

export const SummaryStrip = ({ cols = 4, children, testId, className = "" }) => (
  <div
    data-testid={testId}
    className={`sub-summary-strip grid gap-1.5 ${STRIP_COLS[cols] || ""} ${className}`}
    style={STRIP_COLS[cols] ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
  >
    {children}
  </div>
);

// Cabeçalho de secção padronizado de TODOS os painéis — título tático com
// traço divisor que se estende até à margem (hierarquia + organização),
// meta opcional à direita (contagens, totais) e slot de ação.
export const SectionHeader = ({ icon: Icon, title, meta, action, tip, className = "", testId }) => (
  <div data-testid={testId} className={`mb-2.5 flex items-center gap-2 ${className}`}>
    <Tip tip={tip}>
      <h3 className="flex min-w-0 shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
        {Icon && <Icon size={12} className="shrink-0 text-red-500/90" />}
        <span className="truncate">{title}</span>
      </h3>
    </Tip>
    <span className="h-px min-w-3 flex-1 bg-white/[0.08]" aria-hidden="true" />
    {meta != null && <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">{meta}</span>}
    {action}
  </div>
);

// Micro-etiqueta acima do título dos painéis — dá contexto de secção com um
// traço laser vermelho, no estilo dos kickers de HUD militar.
export const PanelKicker = ({ children, className = "" }) => (
  <p className={`flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-red-500/90 ${className}`}>
    <span className="inline-block h-px w-4 bg-red-500 shadow-[0_0_6px_rgba(220,38,38,0.8)]" aria-hidden="true" />
    {children}
  </p>
);

// Ícone gigante e quase invisível no canto do header — identidade da secção
// sem peso visual (marca de água).
export const PanelWatermark = ({ icon: Icon }) => (
  <span className="sub-watermark" aria-hidden="true">
    <Icon strokeWidth={1.5} />
  </span>
);

// Empty state tático partilhado — moldura tracejada, ícone com glow e voz noir.
// Substitui os <p> soltos "Sem X" espalhados pelos painéis.
export const EmptyState = ({ icon: Icon, title, sub, testId, className = "", children }) => (
  <div data-testid={testId} className={`sub-empty ${className}`}>
    {Icon && (
      <span className="sub-empty-icon">
        <Icon size={17} />
      </span>
    )}
    {title && <p className="font-display text-sm font-bold uppercase tracking-wider text-zinc-300">{title}</p>}
    {sub && <p className="max-w-[280px] font-mono text-[10px] leading-relaxed text-zinc-500">{sub}</p>}
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
          aria-label="Novo nome"
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
          type="button"
          aria-label="Guardar nome"
          data-testid={testId && `${testId}-save`}
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={save}
          className="shrink-0 text-success transition-colors hover:brightness-125"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          aria-label="Cancelar edição"
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
          type="button"
          aria-label="Renomear"
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
      type="button"
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={active}
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
      <button type="button"
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

// Botão único para toda e qualquer compra/melhoria/ação com custo em todo o jogo
// (veículos, armas, propriedades, QG, recrutamento, formação, etc.) — verde quando
// possível, vermelho quando não, sempre visível e com o motivo do bloqueio no tooltip.
// `requireConfirm` dobra o passo de confirmação (mirror do ConfirmButton) para compras
// grandes, sem precisar de um componente/estilo à parte.
export const PurchaseButton = ({
  testId, label, icon: Icon, can, blockedReasons = [], availableTip, confirmLabel = "Confirmar?",
  requireConfirm = false, onConfirm, className = "", layout = "row", children,
}) => {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const skipArm = getDisplayPrefs().confirmIrreversible === false;
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  const tip = pending
    ? "A processar — aguarda a confirmação do servidor."
    : armed
    ? "Clica outra vez para confirmar — ação irreversível."
    : !can
    ? (blockedReasons.length ? blockedReasons.join(" ") : null)
    : availableTip;
  const runConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };
  const handleClick = () => {
    if (!can || pending) return;
    if (!requireConfirm || skipArm) { runConfirm(); return; }
    if (armed) { setArmed(false); runConfirm(); } else setArmed(true);
  };
  return (
    <Tip tip={tip} block className={className}>
      <button type="button"
        data-testid={testId}
        onClick={handleClick}
        disabled={!can || pending}
        aria-busy={pending}
        className={cn(
          layout === "card"
            ? "flex h-full w-full flex-col items-start gap-1 rounded-md border px-3 py-2 text-left font-mono text-[9px] font-bold uppercase md:flex-row md:items-center md:text-[10px]"
            : "flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[10px] font-bold uppercase",
          "transition-colors disabled:cursor-not-allowed",
          pending
            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
            : armed
            ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
            : can
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/20"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        )}
      >
        {pending ? (
          <><Loader2 size={11} className="animate-spin" /> A processar…</>
        ) : children != null ? children : (
          <>{Icon && <Icon size={11} />} {armed ? confirmLabel : label}</>
        )}
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
