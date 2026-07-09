import { useMemo } from "react";

/**
 * Chrome partilhado do arranque SSS — usado por BootScreen, LoadingScreen
 * e pela pré-visualização /dev/loading. Puramente visual: toda a lógica
 * de estado permanece nos ecrãs que o consomem.
 */

function makeSessionCode() {
  const chars = "0123456789ABCDEF";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function LoadingBackdrop({ children }) {
  const session = useMemo(makeSessionCode, []);
  return (
    <div className="lus-boot-bg fixed inset-0 z-50 overflow-hidden">
      <div className="lus-boot-sweep" aria-hidden="true" />
      <div className="lus-boot-sonar" aria-hidden="true" />
      <div className="lus-scanline" aria-hidden="true" />
      <div className="lus-boot-crt" aria-hidden="true" />
      <div className="lus-boot-noise" aria-hidden="true" />
      <div className="lus-boot-vignette" aria-hidden="true" />

      <div className="lus-boot-hud lus-boot-hud-top" aria-hidden="true">
        <span>Lusorae OS // Noir-2.6</span>
        <span className="lus-boot-ruler" />
        <span className="hidden sm:inline">Lisboa · 38.7223° N · 9.1393° O</span>
        <span className="sm:hidden">Lisboa</span>
      </div>
      <div className="lus-boot-hud lus-boot-hud-bottom" aria-hidden="true">
        <span className="lus-boot-rec">
          <span className="lus-boot-rec-dot" />
          <span className="hidden sm:inline">Canal cifrado · AES-256</span>
          <span className="sm:hidden">Cifrado</span>
        </span>
        <span className="lus-boot-ruler" />
        <span>Sessão {session}</span>
      </div>

      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center py-12">
          {children}
        </div>
      </div>
    </div>
  );
}

export function TacticalFrame({ header = "Ligação segura", status = "Em direto", tone = "ok", children }) {
  return (
    <div className="lus-frame mx-4 w-full max-w-md animate-slide-up">
      <span className="lus-frame-topline" aria-hidden="true" />
      <span className="lus-corner-tr" aria-hidden="true" />
      <span className="lus-corner-bl" aria-hidden="true" />
      <span className="lus-frame-ticks lus-frame-ticks-l" aria-hidden="true" />
      <span className="lus-frame-ticks lus-frame-ticks-r" aria-hidden="true" />
      <div className="lus-frame-header">
        <span>{header}</span>
        <span className={tone === "error" ? "lus-frame-status lus-frame-status-error" : "lus-frame-status"}>
          <span className="lus-frame-status-dot" aria-hidden="true" />
          {status}
        </span>
      </div>
      {children}
    </div>
  );
}

export function TacticalRadar() {
  return (
    <div className="lus-radar-wrap" aria-hidden="true">
      <span className="lus-radar-orbit" />
      <span className="lus-radar-cardinal lus-radar-n">N</span>
      <span className="lus-radar-cardinal lus-radar-e">E</span>
      <span className="lus-radar-cardinal lus-radar-s">S</span>
      <span className="lus-radar-cardinal lus-radar-w">O</span>
      <div className="lus-radar">
        <span className="lus-radar-ticks" />
        <span className="lus-radar-dot" />
        <span className="lus-radar-blip" />
        <span className="lus-radar-blip lus-radar-blip-2" />
        <span className="lus-radar-blip lus-radar-blip-3" />
      </div>
    </div>
  );
}

export function BootWordmark({ statusText }) {
  return (
    <div className="text-center">
      <p className="lus-eyebrow font-mono text-[10px] uppercase tracking-[0.45em] text-primary/90">
        <span className="lus-eyebrow-line" aria-hidden="true" />
        <span>Lisboa · Rede Criminosa</span>
        <span className="lus-eyebrow-line lus-eyebrow-line-r" aria-hidden="true" />
      </p>
      <h1 className="lus-boot-logo mt-1.5 font-display text-6xl font-bold uppercase leading-none tracking-tight">
        Lusorae
      </h1>
      <p className="lus-cursor mt-3 font-mono text-xs text-zinc-400">{statusText}</p>
    </div>
  );
}

export function UplinkProgress({ progress, label = "A ligar à organização", meta }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress || 0)));
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        <span>{label}</span>
        {meta ? <span className="text-zinc-600">{meta}</span> : null}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="lus-progress-track flex-1">
          <div className="lus-progress-shell">
            <div className="lus-progress-fill h-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="lus-progress-head" style={{ left: `${pct}%` }} aria-hidden="true" />
        </div>
        <span className="lus-progress-pct font-mono">
          {pct}
          <span className="text-[10px] font-normal text-zinc-500">%</span>
        </span>
      </div>
    </div>
  );
}

const STATUS_META = {
  done: { chip: "OK", chipClass: "lus-term-ok", rowClass: "lus-term-row-done" },
  error: { chip: "ERRO", chipClass: "lus-term-err", rowClass: "lus-term-row-error" },
  active: { chip: "···", chipClass: "lus-term-run", rowClass: "lus-term-row-active" },
  pending: { chip: "—", chipClass: "lus-term-wait", rowClass: "" },
};

export function TerminalLog({ title = "Registo de sistema", rows }) {
  return (
    <div className="lus-term">
      <div className="lus-term-head">
        <span>{title}</span>
        <span className="lus-term-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="lus-term-body">
        {rows.map((row, i) => {
          const meta = STATUS_META[row.status] || STATUS_META.pending;
          return (
            <div key={row.key} className={`lus-term-row ${meta.rowClass}`}>
              <span className="lus-term-idx">{String(i + 1).padStart(2, "0")}</span>
              <span>{row.label}</span>
              <span className="lus-term-leader" aria-hidden="true" />
              <span className={meta.chipClass}>{meta.chip}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FlavorRotator() {
  return (
    <div className="lus-flavor text-center font-mono text-[10px] uppercase tracking-widest text-zinc-500">
      <span>A subornar informadores nos bairros…</span>
      <span>A escutar a frequência da polícia…</span>
      <span>A contar notas no cofre do QG…</span>
    </div>
  );
}
