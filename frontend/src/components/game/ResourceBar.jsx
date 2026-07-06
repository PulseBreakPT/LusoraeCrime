import { useEffect, useRef, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, fmtDuration, heatStatus, passiveRates, teamsReadiness } from "../../lib/game";
import { Tip, MiniBar, AnimatedNumber, useFlash } from "./hud";
import { Badge } from "../ui/badge";
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
  const prevCleanRef = useRef(null);
  const moneyIn = state && prevCleanRef.current != null && state.player.clean_money > prevCleanRef.current;
  const moneyFlash = useFlash(moneyIn ? state.player.clean_money : null);
  useEffect(() => {
    if (state) prevCleanRef.current = state.player.clean_money;
  }, [state]);
  if (!state) return null;
  const p = state.player;
  const nextRespect = p.next_level_respect;
  const respPct = nextRespect ? Math.min(100, (p.respect / nextRespect) * 100) : 100;
  const hs = heatStatus(p.heat);
  const { dirtyPerH, launderPerH } = passiveRates(state, catalog, serverNow());
  const tr = teamsReadiness(state, serverNow());
  const activeOps = state.missions.length;
  const payrollS = p.next_payroll_at ? Math.max(0, (Date.parse(p.next_payroll_at) - serverNow()) / 1000) : null;
  const payrollShort = (state.salary_total || 0) > 0 && p.clean_money < state.salary_total;

  return (
    <div data-testid="resource-bar" className="pointer-events-auto absolute left-2 right-2 top-2 z-20 animate-slide-down">
      <div className="mx-auto flex w-fit max-w-full items-stretch gap-1 rounded-lg border border-border bg-card/90 px-2 py-1.5 shadow-2xl backdrop-blur-xl sm:gap-2 sm:px-3">
        <Tip
          tip={nextRespect ? `Nível ${p.level} — faltam ${nextRespect - p.respect} de respeito para o nível ${p.level + 1}. Sobe de nível para desbloquear oportunidades, veículos e recrutas.` : "Nível máximo alcançado — domínio total de Lisboa."}
          side="bottom"
          align="start"
        >
          <div className="flex shrink-0 items-center gap-1.5 border-r border-border pr-2 sm:gap-2 sm:pr-3">
            <div className="flex flex-col items-center">
              <Badge variant="outline" className="flex h-7 w-7 items-center justify-center rounded border-primary/30 bg-primary/15 p-0 font-mono text-xs font-bold text-primary">
                {p.level}
              </Badge>
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
          testId="stat-clean-money" icon={Banknote} color="#10B981" label="Limpo"
          value={<AnimatedNumber value={p.clean_money} format={fmtMoney} />}
          sub={launderPerH > 0 ? `+${fmtMoney(launderPerH)}/h` : null} subColor="#34D399"
          tip="Dinheiro limpo — paga compras, reparações, salários e subornos. Cresce com lavagem (taxa 25%) e empresas de fachada."
          className={moneyFlash ? "lus-flash rounded" : ""}
        />
        {(() => {
          const dirtyCap = state.caps?.dirty_money?.max || 0;
          const dirtyPct = dirtyCap > 0 ? p.dirty_money / dirtyCap : 0;
          const nearCap = dirtyPct >= 0.9;
          return (
            <Stat
              testId="stat-dirty-money" icon={Coins} color={nearCap ? "#EF4444" : "#F59E0B"} label="Sujo"
              value={<AnimatedNumber value={p.dirty_money} format={fmtMoney} />}
              sub={nearCap ? "cofre quase cheio!" : dirtyPerH > 0 ? `+${fmtMoney(dirtyPerH)}/h` : null}
              subColor={nearCap ? "#EF4444" : "#F59E0B"}
              tip={`Dinheiro sujo vindo do crime — lava-o no Império para o poderes gastar. Capacidade do cofre: ${fmtMoney(p.dirty_money)}/${fmtMoney(dirtyCap)}${nearCap ? " — produção dos laboratórios acima do limite é DESPERDIÇADA. Lava dinheiro já!" : ". Produção acima do limite é desperdiçada; montantes altos atraem atenção."}`}
            />
          );
        })()}
        <Stat
          testId="stat-respect" icon={Trophy} color="#0A84FF" label="Respeito" value={<AnimatedNumber value={p.respect} />}
          tip="Respeito ganho em operações bem-sucedidas — sobe o nível da organização e desbloqueia conteúdo novo."
        />
        <Tip tip={`Calor policial: ${hs.label}. ${hs.desc} Baixa naturalmente com o tempo ou com subornos no Império.`} side="bottom" className="min-w-0">
          <div data-testid="stat-heat" className="flex min-w-0 items-center gap-1 px-0.5 sm:gap-1.5 sm:px-1">
            <Flame size={14} className="shrink-0" style={{ color: hs.color }} />
            <div className="min-w-0">
              <p className="hidden text-[8px] uppercase tracking-wider text-zinc-500 md:block">
                Calor · <span style={{ color: hs.color }}>{hs.label}</span>
              </p>
              <p className="truncate font-mono text-[11px] font-bold text-white sm:text-xs">{Math.round(p.heat)}%</p>
              <MiniBar value={p.heat} color={hs.color} className="w-7 sm:w-10" height="h-0.5" />
            </div>
          </div>
        </Tip>

        <div className="hidden items-stretch gap-2 border-l border-border pl-2 md:flex">
          <Stat
            testId="stat-teams-ready" icon={Users} color={tr.ready === 0 && tr.total > 0 ? "#EF4444" : "#22D3EE"} label="Prontas" value={`${tr.ready}/${tr.total}`}
            tip={`Equipas prontas a operar: ${tr.ready} de ${tr.total}${tr.busy > 0 ? ` · ${tr.busy} em operação` : ""}. Uma equipa pronta tem membros disponíveis, veículo com combustível e em condições.`}
          />
          <Stat
            testId="stat-active-ops" icon={Crosshair} color="#EF4444" label="Ops" value={activeOps}
            tip={activeOps > 0 ? `${activeOps} operação(ões) em curso — acompanha as unidades no mapa.` : "Sem operações em curso — seleciona uma oportunidade no mapa e despacha uma equipa."}
          />
          <Stat
            testId="stat-payroll" icon={HandCoins} color={payrollShort ? "#EF4444" : "#F59E0B"} label="Salários" value={fmtMoney(state.salary_total || 0)}
            sub={payrollShort ? "fundos insuficientes!" : payrollS != null ? `em ${fmtDuration(payrollS)}` : null} subColor={payrollShort ? "#EF4444" : "#F59E0B"} align="end"
            tip={payrollShort
              ? `Não tens dinheiro limpo suficiente para o próximo ciclo salarial (${fmtMoney(state.salary_total)}) — os operacionais vão perder moral e lealdade, e quem estiver disponível pode abandonar a organização.`
              : "Ciclo salarial pago a cada 30 min com dinheiro limpo. Falhar pagamentos quebra a moral e a lealdade — e há quem abandone ou traia."}
          />
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, color, label, value, sub, subColor, tip, align = "center", testId, className = "" }) => (
  <Tip tip={tip} side="bottom" align={align} className="min-w-0">
    <div data-testid={testId} className={`flex min-w-0 items-center gap-1 px-0.5 sm:gap-1.5 sm:px-1 ${className}`}>
      <Icon size={14} className="shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="hidden text-[8px] uppercase tracking-wider text-zinc-500 md:block">{label}</p>
        <p title={typeof value === "string" ? value : undefined} className="truncate font-mono text-[11px] font-bold text-white sm:text-xs">{value}</p>
        {sub && <p title={sub} className="truncate font-mono text-[9px] leading-tight" style={{ color: subColor || "#71717A" }}>{sub}</p>}
      </div>
    </div>
  </Tip>
);
