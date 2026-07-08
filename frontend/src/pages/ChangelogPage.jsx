import { useMemo, useState } from "react";
import { Sparkles, ArrowUpRight, Wrench, Scale, History, Layers } from "lucide-react";
import LegalLayout from "./legal/LegalLayout";
import { CHANGELOG, changelogStats } from "../data/changelog";

const TYPE_META = {
  novo: {
    label: "Novo",
    icon: Sparkles,
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
  },
  melhorado: {
    label: "Melhorado",
    icon: ArrowUpRight,
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    dot: "bg-sky-400",
  },
  corrigido: {
    label: "Corrigido",
    icon: Wrench,
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dot: "bg-amber-400",
  },
  equilibrio: {
    label: "Equilíbrio",
    icon: Scale,
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    dot: "bg-violet-400",
  },
};

function TypeChip({ type }) {
  const meta = TYPE_META[type];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${meta.chip}`}>
      <Icon size={9} />
      {meta.label}
    </span>
  );
}

export default function ChangelogPage() {
  const [filter, setFilter] = useState("all");
  const stats = useMemo(() => changelogStats(), []);

  const filtered = useMemo(() => {
    if (filter === "all") return CHANGELOG;
    return CHANGELOG
      .map((v) => ({ ...v, changes: v.changes.filter((c) => c.type === filter) }))
      .filter((v) => v.changes.length > 0);
  }, [filter]);

  return (
    <LegalLayout
      eyebrow="Temporada 0 · Histórico de desenvolvimento"
      title="Changelog"
      subtitle="Todas as alterações do Lusorae, versão a versão. O jogo está em desenvolvimento ativo — cada atualização é documentada aqui com total transparência."
      wide
    >
      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="changelog-stats">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <Layers size={11} /> Versões
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-white">{stats.versions}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <History size={11} /> Alterações
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <Sparkles size={11} /> Novidades
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-400">{stats.byType.novo || 0}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <Wrench size={11} /> Correções
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-amber-400">{stats.byType.corrigido || 0}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-10 flex flex-wrap items-center gap-2" data-testid="changelog-filters">
        <button
          onClick={() => setFilter("all")}
          data-testid="changelog-filter-all"
          className={`rounded-full border px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
            filter === "all"
              ? "border-primary bg-primary text-white shadow-[0_0_16px_rgba(220,38,38,0.35)]"
              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-white"
          }`}
        >
          Tudo · {stats.total}
        </button>
        {Object.entries(TYPE_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const count = stats.byType[key] || 0;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              data-testid={`changelog-filter-${key}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                filter === key
                  ? `${meta.chip} shadow-lg`
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-white"
              }`}
            >
              <Icon size={10} />
              {meta.label} · {count}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="relative" data-testid="changelog-timeline">
        <div className="absolute bottom-4 left-[7px] top-2 w-px bg-gradient-to-b from-primary/60 via-white/10 to-transparent sm:left-[11px]" />
        <div className="space-y-10">
          {filtered.map((release) => (
            <article key={release.version} className="relative pl-8 sm:pl-12" data-testid={`changelog-version-${release.version}`}>
              {/* Nó da timeline */}
              <span
                className={`absolute left-0 top-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 sm:h-[23px] sm:w-[23px] ${
                  release.current
                    ? "border-primary bg-primary/20 shadow-[0_0_14px_rgba(220,38,38,0.6)]"
                    : "border-white/20 bg-background"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${release.current ? "bg-primary" : "bg-white/30"}`} />
              </span>

              {/* Cabeçalho da versão */}
              <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs font-bold tracking-wider ${
                    release.current
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-white/15 bg-white/[0.04] text-zinc-300"
                  }`}
                >
                  v{release.version}
                </span>
                {release.current && (
                  <span className="animate-pulse rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-white">
                    Atual
                  </span>
                )}
                <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-600">{release.date}</span>
              </header>

              <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{release.title}</h2>
              <p className="mt-1 text-sm text-zinc-500">{release.tagline}</p>

              {/* Alterações */}
              <ul className="mt-5 space-y-2.5">
                {release.changes.map((change, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
                  >
                    <TypeChip type={change.type} />
                    <span className="text-sm leading-relaxed text-zinc-300">{change.text}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </LegalLayout>
  );
}
