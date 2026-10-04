import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { LegalShell, LegalSkeleton, LegalError } from "../components/legal/LegalShell";
import { FileText, CalendarDays, BadgeCheck } from "lucide-react";

const ROUTE_DOC = {
  "/termos": { id: "terms", kicker: "Documento oficial · Termos" },
  "/privacidade": { id: "privacy", kicker: "Documento oficial · Privacidade" },
  "/rgpd": { id: "rgpd", kicker: "Documento oficial · Proteção de Dados" },
};

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const formatDate = (iso) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
  } catch (_e) {
    return iso;
  }
};

export default function LegalPage() {
  const location = useLocation();
  const config = ROUTE_DOC[location.pathname] || ROUTE_DOC["/termos"];
  const [doc, setDoc] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  const load = useCallback(async () => {
    setStatus("loading");
    setDoc(null);
    try {
      const res = await api.get(`/legal/documents/${config.id}`, { timeout: 8000 });
      setDoc(res.data);
      setStatus("ready");
    } catch (_err) {
      setStatus("error");
    }
  }, [config.id]);

  useEffect(() => {
    load();
    window.scrollTo(0, 0);
  }, [load]);

  const toc = useMemo(
    () => (doc?.sections || []).map((s) => ({ id: slugify(s.heading), label: s.heading })),
    [doc]
  );

  return (
    <LegalShell active={location.pathname}>
      {status === "loading" && <LegalSkeleton />}
      {status === "error" && <LegalError onRetry={load} />}

      {status === "ready" && doc && (
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* Índice (desktop) */}
          <aside className="hidden lg:block">
            <nav aria-label="Índice" className="sub-toc sticky top-24 rounded-lg p-4">
              <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span className="h-1 w-1 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" aria-hidden="true" />
                Índice
              </p>
              <div className="space-y-0.5">
                {toc.map((t, i) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className="flex items-baseline gap-2 truncate rounded-r py-1.5 pl-3 text-xs text-zinc-500 hover:text-zinc-100"
                  >
                    <span className="shrink-0 font-mono text-[10px] font-bold text-zinc-700">{String(i + 1).padStart(2, "0")}</span>
                    <span className="truncate">{t.label}</span>
                  </a>
                ))}
              </div>
            </nav>
          </aside>

          {/* Documento */}
          <article data-testid="legal-document" className="min-w-0 animate-slide-up">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-red-500">
              <FileText size={13} aria-hidden="true" /> {config.kicker}
            </div>
            <h1 data-testid="legal-title" className="sub-title mt-3 font-display text-4xl font-bold uppercase tracking-tight text-white sm:text-5xl">
              {doc.title}
            </h1>
            <div className="mt-3 h-0.5 w-20 bg-gradient-to-r from-red-600 via-red-600/60 to-transparent" />

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
              <span data-testid="legal-version" className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono font-bold uppercase tracking-wider text-zinc-300">
                <BadgeCheck size={12} className="text-red-400" aria-hidden="true" /> Versão {doc.version}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays size={12} aria-hidden="true" /> Em vigor desde {formatDate(doc.effective_date)}
              </span>
            </div>

            {doc.summary && (
              <p className="sub-doc-summary mt-6 rounded-md px-4 py-3.5 text-sm leading-relaxed text-zinc-300">
                {doc.summary}
              </p>
            )}

            <div className="mt-10 space-y-10">
              {doc.sections.map((section) => (
                <section key={section.heading} id={slugify(section.heading)} className="scroll-mt-24">
                  <h2 className="sub-sec-heading font-display text-lg font-bold uppercase tracking-wide text-white">
                    {section.heading}
                  </h2>
                  <div className="mt-3 space-y-3">
                    {(section.paragraphs || []).map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed text-zinc-400">{p}</p>
                    ))}
                    {section.bullets && (
                      <ul className="space-y-2">
                        {section.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-400">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-sm bg-red-500/70" aria-hidden="true" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(section.paragraphs_after || []).map((p, i) => (
                      <p key={`after-${i}`} className="text-sm leading-relaxed text-zinc-400">{p}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {doc.available_versions?.length > 0 && (
              <div className="mt-14 pt-1">
                <div className="sub-hairline mb-5" aria-hidden="true" />
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600">Histórico de versões</p>
                <ul className="mt-2.5 space-y-1.5">
                  {doc.available_versions.slice().reverse().map((v) => (
                    <li key={v.version} className="flex items-center gap-2.5 text-xs text-zinc-500">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${v.version === doc.version ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" : "bg-zinc-700"}`} aria-hidden="true" />
                      Versão {v.version} — em vigor desde {formatDate(v.effective_date)}
                      {v.version === doc.version && <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-red-400">Atual</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </div>
      )}
    </LegalShell>
  );
}
