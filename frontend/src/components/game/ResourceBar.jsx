import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContext";
import { fmtMoney, fmtDuration, heatStatus, passiveRates, teamsReadiness } from "../../lib/game";
import { Tip, MiniBar } from "./hud";
import { Banknote, Coins, Flame, Trophy, Users, Crosshair, HandCoins } from "lucide-react";

const useTick = () => {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
};

export const ResourceBar = () => {
  const { state, catalog, serverNow } = useGame();
  useTick();
  if (!state) return null;
  const p = state.player;
  const nextRespect = p.next_level_respect;
  const respPct = nextRespect ? Math.min(100, (p.respect / nextRespect) * 100) : 100;
  const hs = heatStatus(p.heat);
  const { dirtyPerH, launderPerH } = passiveRates(state, catalog);
  const tr = teamsReadiness(state);
  const activeOps = state.missions.length;
  const payrollS = p.next_payroll_at ? Math.max(0, (Date.parse(p.next_payroll_at) - serverNow()) / 1000) : null;

  return (
    <div data-testid="resource-bar" className="pointer-events-auto absolute left-2 right-2 top-2 z-20 animate-slide-down">
      <div className="mx-auto flex max-w-4xl items-stretch gap-2 overflow-x-auto rounded-lg border border-white/10 bg-black/75 px-3 py-1.5 shadow-2xl backdrop-blur-xl md:overflow-visible">
        <Tip
          tip={nextRespect ? `Nível ${p.level} — faltam ${nextRespect - p.respect} de respeito para o nível ${p.level + 1}. Sobe de nível para desbloquear oportunidades, veículos e recrutas.` : "Nível máximo alcançado — domínio total de Lisboa."}
          side="bottom"
          align="start"
        >
          <div className="flex shrink-0 items-center gap-2 border-r border-white/10 pr-3">
            <div className="flex flex-col items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-red-600/20 font-mono text-xs font-bold text-red-500">
                {p.level}
              </span>
              <MiniBar value={respPct} color="#DC2626" className="mt-0.5 w-7" height="h-0.5" />
            </div>
            <div className="hidden sm:block">
              <p className="max-w-[120px] truncate text-xs font-semibold text-white">{p.org_name}</p>
              <p className="font-mono text-[9px] text-zinc-500">
                {nextRespect ? `${p.respect}/${nextRespect} resp.` : "nível máx."}
              </p>
            </div>
          </div>
        </Tip>

        <Stat
          testId="stat-clean-money" icon={Banknote} color="#10B981" label="Limpo" value={fmtMoney(p.clean_money)}
          sub={launderPerH > 0 ? `+${fmtMoney(launderPerH)}/h` : null} subColor="#34D399"
          tip="Dinheiro limpo — paga compras, reparações, salários e subornos. Cresce com lavagem (taxa 25%) e empresas de fachada."
        />
        <Stat
          testId="stat-dirty-money" icon={Coins} color="#F59E0B" label="Sujo" value={fmtMoney(p.dirty_money)}
          sub={dirtyPerH > 0 ? `+${fmtMoney(dirtyPerH)}/h` : null} subColor="#F59E0B"
          tip="Dinheiro sujo vindo do crime — lava-o no Império para o poderes gastar. Montantes altos atraem atenção."
        />
        <Stat
          testId="stat-respect" icon={Trophy} color="#0A84FF" label="Respeito" value={p.respect}
          sub={nextRespect ? `nível ${p.level + 1} aos ${nextRespect}` : "máx."}
          tip="Respeito ganho em operações bem-sucedidas — sobe o nível da organização e desbloqueia conteúdo novo."
        />
        <Tip tip={`Calor policial: ${hs.label}. ${hs.desc} Baixa naturalmente com o tempo ou com subornos no Império.`} side="bottom">
          <div data-testid="stat-heat" className="flex shrink-0 items-center gap-1.5 px-1">
            <Flame size={14} style={{ color: hs.color }} />
            <div>
              <p className="hidden text-[8px] uppercase tracking-wider text-zinc-500 md:block">
                Calor · <span style={{ color: hs.color }}>{hs.label}</span>
              </p>
              <p className="font-mono text-xs font-bold text-white">{Math.round(p.heat)}%</p>
              <MiniBar value={p.heat} color={hs.color} className="w-10" height="h-0.5" />
            </div>
          </div>
        </Tip>

        <div className="hidden items-stretch gap-2 border-l border-white/10 pl-2 md:flex">
          <Stat
            testId="stat-teams-ready" icon={Users} color="#22D3EE" label="Prontas" value={`${tr.ready}/${tr.total}`}
            tip={`Equipas prontas a operar: ${tr.ready} de ${tr.total}${tr.busy > 0 ? ` · ${tr.busy} em operação` : ""}. Uma equipa pronta tem membros disponíveis, veículo com combustível e em condições.`}
          />
          <Stat
            testId="stat-active-ops" icon={Crosshair} color="#EF4444" label="Ops" value={activeOps}
            tip={activeOps > 0 ? `${activeOps} operação(ões) em curso — acompanha as unidades no mapa.` : "Sem operações em curso — seleciona uma oportunidade no mapa e despacha uma equipa."}
          />
          <Stat
            testId="stat-payroll" icon={HandCoins} color="#F59E0B" label="Salários" value={fmtMoney(state.salary_total || 0)}
            sub={payrollS != null ? `em ${fmtDuration(payrollS)}` : null} subColor="#F59E0B" align="end"
            tip="Folha salarial paga a cada 30 min com dinheiro limpo. Falhar pagamentos quebra a moral e a lealdade — e há quem abandone ou traia."
          />
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, color, label, value, sub, subColor, tip, align = "center", testId }) => (
  <Tip tip={tip} side="bottom" align={align}>
    <div data-testid={testId} className="flex shrink-0 items-center gap-1.5 px-1">
      <Icon size={14} style={{ color }} />
      <div>
        <p className="hidden text-[8px] uppercase tracking-wider text-zinc-500 md:block">{label}</p>
        <p className="font-mono text-xs font-bold text-white">{value}</p>
        {sub && <p className="font-mono text-[9px] leading-tight" style={{ color: subColor || "#71717A" }}>{sub}</p>}
      </div>
    </div>
  </Tip>
);
