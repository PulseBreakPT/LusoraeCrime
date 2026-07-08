import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ShieldCheck, FileText, Lock, History } from "lucide-react";
import { CURRENT_VERSION } from "../../data/changelog";

const NAV = [
  { to: "/termos", label: "Termos", icon: FileText },
  { to: "/privacidade", label: "Privacidade", icon: Lock },
  { to: "/changelog", label: "Changelog", icon: History },
];

/**
 * Layout partilhado para páginas públicas (Termos, Privacidade, Changelog).
 * Header sticky com navegação cruzada, hero com título em gradiente e footer editorial.
 */
export default function LegalLayout({ eyebrow, title, subtitle, updated, children, wide = false }) {
  const { pathname } = useLocation();
  const width = wide ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground">
      {/* Fundo decorativo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(1100px_520px_at_50%_-12%,rgba(220,38,38,0.16),transparent_62%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(720px_420px_at_100%_105%,rgba(220,38,38,0.06),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 100% 60% at 50% 0%, black 35%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 100% 60% at 50% 0%, black 35%, transparent 80%)",
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-black/75 backdrop-blur-2xl">
        <div className={`relative mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6 ${width}`}>
          <Link
            to="/auth"
            data-testid="legal-back-link"
            className="group inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400 transition-all hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>

          <Link to="/auth" className="mx-2 hidden shrink-0 items-center gap-2.5 md:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="font-display text-base font-bold tracking-[0.28em] text-white">LUSORAE</span>
          </Link>

          <nav className="flex items-center gap-1.5">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 font-mono text-[10px] uppercase tracking-widest transition-all sm:px-3 ${
                    active
                      ? "border-primary/40 bg-primary/15 text-primary shadow-[0_0_18px_rgba(220,38,38,0.25)]"
                      : "border-transparent text-zinc-500 hover:border-white/15 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon size={11} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Hero + conteúdo */}
      <main className={`relative z-10 mx-auto px-4 pb-24 pt-14 sm:px-6 sm:pt-16 ${width}`}>
        <div className="animate-slide-up">
          {eyebrow && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent">{title}</span>
          </h1>
          <span className="mt-6 block h-[3px] w-20 rounded-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />
          {subtitle && <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">{subtitle}</p>}
          {updated && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Atualizado: <span className="text-zinc-300">{updated}</span>
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Versão <span className="text-zinc-300">{CURRENT_VERSION}</span>
              </span>
            </div>
          )}
        </div>
        <div className="mt-12">{children}</div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-black/60 backdrop-blur-xl">
        <div className={`mx-auto flex flex-col gap-6 px-4 py-9 sm:px-6 ${width}`}>
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary" />
                <span className="font-display text-sm font-bold tracking-[0.25em] text-white">LUSORAE</span>
              </div>
              <p className="mt-2.5 max-w-xs text-xs leading-relaxed text-zinc-600">
                Simulador de estratégia e gestão num mapa vivo de Lisboa. Todo o conteúdo é ficcional e destinado a entretenimento.
              </p>
            </div>
            <nav className="flex flex-col gap-2.5 font-mono text-[10px] uppercase tracking-widest sm:items-end">
              <Link to="/termos" className="text-zinc-500 transition-colors hover:text-white">Termos e Condições</Link>
              <Link to="/privacidade" className="text-zinc-500 transition-colors hover:text-white">Política de Privacidade</Link>
              <Link to="/changelog" className="text-zinc-500 transition-colors hover:text-white">Changelog</Link>
            </nav>
          </div>
          <div className="flex flex-col items-start justify-between gap-2 border-t border-white/[0.06] pt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:flex-row sm:items-center">
            <span>© 2026 Lusorae · Temporada 0</span>
            <span>v{CURRENT_VERSION} · Feito em Lisboa</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Secção numerada de documento legal */
export function LegalSection({ number, title, children }) {
  return (
    <section className="group relative mb-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 transition-all hover:border-primary/25 sm:p-7">
      <span className="pointer-events-none absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-primary/80 via-primary/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <h2 className="mb-4 flex items-center gap-3.5 font-display text-lg font-semibold text-white">
        {number && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 font-mono text-xs font-bold text-primary">
            {number}
          </span>
        )}
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

/** Lista com marcadores estilizados */
export function LegalList({ items }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgba(220,38,38,0.7)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
