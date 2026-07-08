import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CURRENT_VERSION } from "../../data/changelog";

/**
 * Layout partilhado para páginas públicas (Termos, Privacidade, Changelog).
 * Header sticky com voltar + marca, fundo escuro com glow, footer com links cruzados.
 */
export default function LegalLayout({ eyebrow, title, subtitle, updated, children, wide = false }) {
  return (
    <div className="relative min-h-screen w-full bg-background text-foreground">
      {/* Fundo decorativo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[840px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-primary/5 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className={`mx-auto flex h-14 items-center justify-between px-4 sm:px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
          <Link
            to="/auth"
            data-testid="legal-back-link"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            Voltar
          </Link>
          <Link to="/auth" className="inline-flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" />
            <span className="font-display text-sm font-bold tracking-[0.2em] text-white">LUSORAE</span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">v{CURRENT_VERSION}</span>
        </div>
      </header>

      {/* Conteúdo */}
      <main className={`relative z-10 mx-auto px-4 pb-20 pt-12 sm:px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        <div className="animate-slide-up">
          {eyebrow && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">{subtitle}</p>}
          {updated && (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-zinc-600">
              Última atualização: {updated} · Versão {CURRENT_VERSION}
            </p>
          )}
        </div>
        <div className="mt-10">{children}</div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-black/50">
        <div className={`mx-auto flex flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            © 2026 Lusorae · Simulador de estratégia · Temporada 0
          </span>
          <nav className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest">
            <Link to="/termos" className="text-zinc-500 transition-colors hover:text-white">Termos</Link>
            <Link to="/privacidade" className="text-zinc-500 transition-colors hover:text-white">Privacidade</Link>
            <Link to="/changelog" className="text-zinc-500 transition-colors hover:text-white">Changelog</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Secção numerada de documento legal */
export function LegalSection({ number, title, children }) {
  return (
    <section className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
      <h2 className="mb-3 flex items-baseline gap-3 font-display text-lg font-semibold text-white">
        {number && <span className="font-mono text-sm font-bold text-primary">{number}.</span>}
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

/** Lista com marcadores estilizados */
export function LegalList({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
