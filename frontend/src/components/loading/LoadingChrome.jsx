/**
 * Chrome partilhado do arranque SSS — usado por BootScreen, LoadingScreen
 * e pela pré-visualização /dev/loading. Puramente visual: toda a lógica
 * de estado permanece nos ecrãs que o consomem.
 */

export function LoadingBackdrop({ children }) {
  return (
    <div className="sub-boot-bg fixed inset-0 z-50 overflow-hidden">
      <div className="sub-boot-sweep" aria-hidden="true" />
      <div className="sub-boot-sonar" aria-hidden="true" />
      <div className="sub-scanline" aria-hidden="true" />
      <div className="sub-boot-crt" aria-hidden="true" />
      <div className="sub-boot-noise" aria-hidden="true" />
      <div className="sub-boot-vignette" aria-hidden="true" />

      <div className="sub-boot-hud sub-boot-hud-top" aria-hidden="true">
        <span>SUBMUNDO</span>
      </div>

      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center py-12">
          {children}
        </div>
      </div>
    </div>
  );
}

export function TacticalFrame({ header = "A iniciar", status = "", tone = "ok", children }) {
  return (
    <div className="sub-frame mx-4 w-full max-w-md animate-slide-up">
      <span className="sub-frame-topline" aria-hidden="true" />
      <span className="sub-corner-tr" aria-hidden="true" />
      <span className="sub-corner-bl" aria-hidden="true" />
      <span className="sub-frame-ticks sub-frame-ticks-l" aria-hidden="true" />
      <span className="sub-frame-ticks sub-frame-ticks-r" aria-hidden="true" />
      <div className="sub-frame-header">
        <span>{header}</span>
        {status ? (
          <span className={tone === "error" ? "sub-frame-status sub-frame-status-error" : "sub-frame-status"}>
            <span className="sub-frame-status-dot" aria-hidden="true" />
            {status}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function TacticalRadar() {
  return (
    <div className="sub-radar-wrap" aria-hidden="true">
      <span className="sub-radar-orbit" />
      <span className="sub-radar-cardinal sub-radar-n">N</span>
      <span className="sub-radar-cardinal sub-radar-e">E</span>
      <span className="sub-radar-cardinal sub-radar-s">S</span>
      <span className="sub-radar-cardinal sub-radar-w">O</span>
      <div className="sub-radar">
        <span className="sub-radar-ticks" />
        <span className="sub-radar-dot" />
        <span className="sub-radar-blip" />
        <span className="sub-radar-blip sub-radar-blip-2" />
        <span className="sub-radar-blip sub-radar-blip-3" />
      </div>
    </div>
  );
}

export function BootWordmark({ statusText }) {
  return (
    <div className="text-center">
      <h1 className="sub-boot-logo mt-1.5 font-display text-6xl font-bold uppercase leading-none tracking-tight">
        SUBMUNDO
      </h1>
      <p className="sub-cursor mt-3 font-mono text-xs text-zinc-400">{statusText}</p>
    </div>
  );
}

export function UplinkProgress({ progress, label = "A carregar", meta }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress || 0)));
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        <span>{label}</span>
        {meta ? <span className="text-zinc-600">{meta}</span> : null}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="sub-progress-track flex-1">
          <div className="sub-progress-shell">
            <div className="sub-progress-fill h-full" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <span className="sub-progress-head" style={{ left: `${pct}%` }} aria-hidden="true" />
        </div>
        <span className="sub-progress-pct font-mono">
          {pct}
          <span className="text-[10px] font-normal text-zinc-500">%</span>
        </span>
      </div>
    </div>
  );
}

const STATUS_META = {
  done: { chip: "OK", chipClass: "sub-term-ok", rowClass: "sub-term-row-done" },
  error: { chip: "ERRO", chipClass: "sub-term-err", rowClass: "sub-term-row-error" },
  active: { chip: "···", chipClass: "sub-term-run", rowClass: "sub-term-row-active" },
  pending: { chip: "—", chipClass: "sub-term-wait", rowClass: "" },
};

export function TerminalLog({ title = "Progresso", rows }) {
  return (
    <div className="sub-term">
      <div className="sub-term-head">
        <span>{title}</span>
        <span className="sub-term-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="sub-term-body">
        {rows.map((row, i) => {
          const meta = STATUS_META[row.status] || STATUS_META.pending;
          return (
            <div key={row.key} className={`sub-term-row ${meta.rowClass}`}>
              <span className="sub-term-idx">{String(i + 1).padStart(2, "0")}</span>
              <span>{row.label}</span>
              <span className="sub-term-leader" aria-hidden="true" />
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
    <div className="sub-flavor text-center font-mono text-[10px] uppercase tracking-widest text-zinc-500">
      <span>A subornar informadores nos bairros…</span>
      <span>A escutar a frequência da polícia…</span>
      <span>A contar notas no cofre do QG…</span>
    </div>
  );
}
