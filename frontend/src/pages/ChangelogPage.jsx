import { useMemo, useState } from "react";
import { Sparkles, ArrowUpRight, Wrench, Scale, History, Layers } from "lucide-react";
import LegalLayout from "./legal/LegalLayout";
import { CHANGELOG, changelogStats } from "../data/changelog";

const TYPE_META = {
  novo: {
    label: "Novo",
    icon: Sparkles,
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    square: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  },
  melhorado: {
    label: "Melhorado",
    icon: ArrowUpRight,
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    square: "border-sky-500/25 bg-sky-500/10 text-sky-400",
  },
  corrigido: {
    label: "Corrigido",
    icon: Wrench,
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    square: "border-amber-500/25 bg-amber-500/10 text-amber-400",
  },
  equilibrio: {
    label: "Equilíbrio",
    icon: Scale,
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    square: "border-violet-500/25 bg-violet-500/10 text-violet-400",
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

function StatCard({ icon: Icon, label, value, valueCls = "text-white", squareCls = "border-white/15 bg-white/[0.05] text-zinc-300" }) {
  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-4 transition-all hover:border-white/[0.18] hover:from-white/[0.06]">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${squareCls}`}>
          <Icon size={15} />
        </span>
        <span>
          <span className={`block font-display text-2xl font-bold leading-none ${valueCls}`}>{value}</span>
          <span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-zinc-500">{label}</span>
        </span>
      </div>
    </div>
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
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="changelog-stats">
        <StatCard icon={Layers} label="Versões" value={stats.versions} />
        <StatCard icon={History} label="Alterações" value={stats.total} />
        <StatCard icon={Sparkles} label="Novidades" value={stats.byType.novo || 0} valueCls="text-emerald-400" squareCls={TYPE_META.novo.square} />
        <StatCard icon={Wrench} label="Correções" value={stats.byType.corrigido || 0} valueCls="text-amber-400" squareCls={TYPE_META.corrigido.square} />
      </div>

      {/* Filtros */}
      <div className="mb-12 flex flex-wrap items-center gap-2" data-testid="changelog-filters">
        <button
          onClick={() => setFilter("all")}
          data-testid="changelog-filter-all"
          className={`rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
            filter === "all"
              ? "border-primary bg-primary text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]"
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
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
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
        <div className="absolute bottom-6 left-[9px] top-3 w-px bg-gradient-to-b from-primary/70 via-white/10 to-transparent sm:left-[13px]" />
        <div className="space-y-12">
          {filtered.map((release) => (
            <article key={release.version} className="relative pl-9 sm:pl-14" data-testid={`changelog-version-${release.version}`}>
              {/* Nó da timeline */}
              <span
                className={`absolute left-0 top-2 flex h-[19px] w-[19px] items-center justify-center rounded-full border-2 sm:h-[27px] sm:w-[27px] ${
                  release.current
                    ? "border-primary bg-primary/20 shadow-[0_0_18px_rgba(220,38,38,0.65)]"
                    : "border-white/20 bg-background"
                }`}
              >
                {release.current && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
                <span className={`h-1.5 w-1.5 rounded-full ${release.current ? "bg-primary" : "bg-white/30"}`} />
              </span>

              {/* Cartão da versão (destacado se atual) */}
              <div
                className={
                  release.current
                    ? "rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/[0.06] to-transparent p-5 shadow-[0_0_90px_-35px_rgba(220,38,38,0.6)] sm:p-6"
                    : ""
                }
              >
                <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    className={`rounded-lg border px-3 py-1 font-mono text-sm font-bold tracking-wider ${
                      release.current
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-white/15 bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    v{release.version}
                  </span>
                  {release.current && (
                    <span className="animate-pulse rounded-full bg-primary px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-white shadow-[0_0_14px_rgba(220,38,38,0.5)]">
                      Atual
                    </span>
                  )}
                  <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-600">{release.date}</span>
                </header>

                <h2 className="font-display text-xl font-bold sm:text-2xl">
                  <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">{release.title}</span>
                </h2>
                <p className="mt-1.5 text-sm text-zinc-500">{release.tagline}</p>

                <ul className="mt-5 space-y-2.5">
                  {release.changes.map((change, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition-all hover:translate-x-0.5 hover:border-white/[0.14] hover:bg-white/[0.045]"
                    >
                      <TypeChip type={change.type} />
                      <span className="text-sm leading-relaxed text-zinc-300">{change.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </LegalLayout>
  );
}
