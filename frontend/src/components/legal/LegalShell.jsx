import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContextV2";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const NAV_LINKS = [
  { to: "/termos", label: "Termos" },
  { to: "/privacidade", label: "Privacidade" },
  { to: "/rgpd", label: "RGPD" },
  { to: "/changelog", label: "Changelog" },
];

/**
 * Moldura partilhada das páginas legais e do changelog: header fixo com
 * navegação de regresso, wordmark e links entre documentos + rodapé.
 */
export function LegalShell({ children, active }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const backTarget = user ? "/" : "/auth";

  const goBack = () => {
    if (window.history.length > 2) navigate(-1);
    else navigate(backTarget);
  };

  return (
    <div className="sub-page-bg min-h-screen text-zinc-200">
      {/* Fundo ambiente tático: grelha + glows */}
      <div className="sub-page-grid" aria-hidden="true" />
      <div className="sub-page-glow" aria-hidden="true" />

      <header className="sub-page-header top-0 z-40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            data-testid="legal-back-button"
            onClick={goBack}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Voltar
          </button>

          <Link
            to={backTarget}
            className="group flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight text-white transition-opacity hover:opacity-90"
          >
            <ShieldCheck
              size={16}
              className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.65)] transition-transform group-hover:scale-110"
              aria-hidden="true"
            />
            <span className="sub-title">SUBMUNDO</span>
          </Link>

          <nav aria-label="Documentos" className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                aria-current={active === l.to ? "page" : undefined}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 ${
                  active === l.to
                    ? "sub-doc-nav-active bg-red-500/10 text-red-400"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {/* Mobile: só o link ativo é omitido do menu compacto */}
          <div className="sm:hidden" />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6">{children}</main>

      <footer className="relative z-10 py-8">
        <div className="sub-hairline mx-auto max-w-5xl" aria-hidden="true" />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 pt-8">
          <nav aria-label="Documentos legais" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            {NAV_LINKS.map((l, i) => (
              <span key={l.to} className="flex items-center gap-3">
                {i > 0 && <span className="text-zinc-800">·</span>}
                <Link to={l.to} className="transition-colors hover:text-red-400">{l.label}</Link>
              </span>
            ))}
          </nav>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-700">
            SUBMUNDO · Simulador de império criminoso · Suporte
          </p>
        </div>
      </footer>
    </div>
  );
}

export function LegalSkeleton() {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-label="A carregar documento">
      <div className="h-3 w-40 rounded bg-white/10" />
      <div className="h-10 w-2/3 rounded bg-white/10" />
      <div className="h-4 w-1/2 rounded bg-white/5" />
      <div className="space-y-3 pt-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 rounded bg-white/5" style={{ width: `${90 - i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}

export function LegalError({ onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center" role="alert">
      <p className="font-mono text-xs uppercase tracking-widest text-red-400">Falha de transmissão</p>
      <p className="max-w-sm text-sm text-zinc-500">Não foi possível carregar o documento. Verifica a tua ligação e tenta novamente.</p>
      <button
        type="button"
        data-testid="legal-retry-button"
        onClick={onRetry}
        className="rounded-md border border-white/10 bg-white/5 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-200 transition-colors hover:border-red-500/40 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
      >
        Tentar novamente
      </button>
    </div>
  );
}
