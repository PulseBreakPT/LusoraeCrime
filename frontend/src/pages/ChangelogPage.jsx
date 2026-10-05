import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { LegalShell, LegalSkeleton, LegalError } from "../components/legal/LegalShell";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { GitBranch, Sparkles, Wrench, Bug, Scale, Coins, LayoutDashboard } from "lucide-react";

const CATEGORY_ORDER = ["novidades", "melhorias", "correcoes", "equilibrio", "economia", "interface"];

const CATEGORY_STYLE = {
  novidades: { icon: Sparkles, badge: "border-red-500/30 bg-red-500/10 text-red-400" },
  melhorias: { icon: Wrench, badge: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  correcoes: { icon: Bug, badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  equilibrio: { icon: Scale, badge: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  economia: { icon: Coins, badge: "border-teal-500/30 bg-teal-500/10 text-teal-400" },
  interface: { icon: LayoutDashboard, badge: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
};

const formatDate = (iso) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
  } catch (_e) {
    return iso;
  }
};

export default function ChangelogPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await api.get("/legal/changelog", { timeout: 8000 });
      setData(res.data);
      setStatus("ready");
    } catch (_err) {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
    window.scrollTo(0, 0);
  }, [load]);

  return (
    <LegalShell active="/changelog">
      {status === "loading" && <LegalSkeleton />}
      {status === "error" && <LegalError onRetry={load} />}

      {status === "ready" && data && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-red-500">
            <GitBranch size={13} aria-hidden="true" /> Registo de operações · Desenvolvimento
          </div>
          <h1 data-testid="changelog-title" className="sub-title mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-5xl">
            Changelog
          </h1>
          <div className="mt-3 h-0.5 w-20 bg-gradient-to-r from-red-600 via-red-600/60 to-transparent" />
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-500">
            Tudo o que muda em Lisboa fica registado. Novidades, melhorias, correções e ajustes de
            equilíbrio — versão a versão, sem segredos.
          </p>

          {/* Linha temporal */}
          <div className="relative mt-12 space-y-10 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-gradient-to-b before:from-red-500/50 before:via-white/[0.09] before:to-transparent sm:before:left-[11px]">
            {data.versions.map((v) => (
              <section key={v.version} data-testid={`changelog-version-${v.version}`} className="relative pl-8 sm:pl-12">
                {/* Marcador */}
                <span aria-hidden="true" className={`absolute left-0 top-5 flex h-[15px] w-[15px] items-center justify-center rounded-full border sm:h-[23px] sm:w-[23px] ${v.tag === "atual" ? "sub-node-current border-red-500/60 bg-red-500/20" : "border-white/15 bg-[#0d0d0d]"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${v.tag === "atual" ? "bg-red-500" : "bg-zinc-600"}`} />
                </span>

                <Card className={`sub-version-card rounded-lg p-5 sm:p-6 ${v.tag === "atual" ? "sub-version-current" : ""}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-display text-2xl font-bold tracking-tight text-white">v{v.version}</span>
                    {v.tag === "atual" && (
                      <Badge className="rounded-full border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.25)]">
                        Atual
                      </Badge>
                    )}
                    <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-600">{formatDate(v.date)}</span>
                  </div>
                  <h2 className="mt-1.5 font-display text-lg font-bold uppercase tracking-wide text-zinc-100">{v.title}</h2>

                  <div className="mt-4 space-y-5">
                    {CATEGORY_ORDER.filter((c) => v.sections?.[c]?.length).map((cat) => {
                      const style = CATEGORY_STYLE[cat];
                      const Icon = style.icon;
                      return (
                        <div key={cat}>
                          <Badge variant="outline" className={`gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
                            <Icon size={11} aria-hidden="true" /> {data.categories?.[cat] || cat}
                          </Badge>
                          <ul className="mt-2.5 space-y-1.5">
                            {v.sections[cat].map((item, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-400">
                                <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-red-500/50" aria-hidden="true" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </section>
            ))}
          </div>
        </div>
      )}
    </LegalShell>
  );
}
