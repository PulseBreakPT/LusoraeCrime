import { useEffect, useState } from "react";
import {
  AlertTriangle, BriefcaseBusiness, Check, Clock3, Coins,
  Crosshair, Gauge, ListChecks, LockKeyhole, Package, Play,
  RadioTower, ScanLine, ShieldAlert, Sparkles, Target,
  TrendingDown, TrendingUp, Users, Vault, X,
} from "lucide-react";
import { useGame } from "../../context/GameContextV2";
import { fmtDuration, fmtMoney } from "../../lib/game";
import { MiniBar, PanelKicker, PanelWatermark, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";


const TABS = [
  ["board", "Golpes", Vault],
  ["market", "Mercado", Coins],
  ["bounty", "Caçada", ShieldAlert],
  ["caches", "Sinais", RadioTower],
];

const selectClass = "mt-1 h-9 w-full rounded-md border border-white/10 bg-black/50 px-2 font-mono text-[10px] text-zinc-200 outline-none focus:border-red-500/50";

const statusLabel = {
  available: "Disponível",
  running: "Em curso",
  ready: "Resultado pronto",
  complete: "Concluída",
};

export const MastermindPanel = ({ open, onOpenChange }) => {
  const {
    state, scoutMastermindTarget, createMastermindHeist, startHeistPrep,
    claimHeistPrep, launchMastermindHeist, claimMastermindHeist,
    abortMastermindHeist, tradeBlackMarket, resolveBounty, scanSignalCache,
  } = useGame();
  const mastermind = state?.mastermind;
  const teams = state?.teams || [];
  const vehicles = state?.vehicles || [];
  const [tab, setTab] = useState("board");
  const [draft, setDraft] = useState({
    team_id: "",
    vehicle_id: "",
    approach_key: "silent",
    fence_key: "quick",
    crew_cut_pct: 20,
  });
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [hunterTeamId, setHunterTeamId] = useState("");

  useEffect(() => {
    if (!draft.team_id && teams[0]) {
      setDraft((current) => ({ ...current, team_id: teams[0].id }));
    }
    if (!hunterTeamId && teams[0]) setHunterTeamId(teams[0].id);
  }, [draft.team_id, hunterTeamId, teams]);

  useEffect(() => {
    if (!draft.vehicle_id && vehicles[0]) {
      setDraft((current) => ({ ...current, vehicle_id: vehicles[0].id }));
    }
  }, [draft.vehicle_id, vehicles]);

  useEffect(() => {
    if (!mastermind) return;
    const approach = mastermind.approaches?.find((item) => item.unlocked);
    const fence = mastermind.fences?.find((item) => item.unlocked);
    setDraft((current) => ({
      ...current,
      approach_key: mastermind.approaches?.some((item) => item.key === current.approach_key && item.unlocked)
        ? current.approach_key : approach?.key || "silent",
      fence_key: mastermind.fences?.some((item) => item.key === current.fence_key && item.unlocked)
        ? current.fence_key : fence?.key || "quick",
    }));
  }, [mastermind?.rank?.level]);

  if (!state) return null;

  const create = (targetKey) => createMastermindHeist({
    target_key: targetKey,
    ...draft,
    crew_cut_pct: Number(draft.crew_cut_pct),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto lus-panel sm:max-w-xl" data-testid="mastermind-panel">
        <SheetHeader>
          <PanelWatermark icon={Vault} />
          <PanelKicker>Rede Mastermind · Grandes Golpes</PanelKicker>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Vault size={18} className="text-violet-300" /> Sala de Planeamento
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Golpes por fases, mercado negro, caçadores rivais e sinais escondidos.
          </SheetDescription>
        </SheetHeader>

        {!mastermind ? (
          <Card className="mt-5 lus-card p-5 text-center">
            <RadioTower className="mx-auto animate-pulse text-violet-300" size={22} />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              A desencriptar a rede Mastermind…
            </p>
          </Card>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              {TABS.map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  data-testid={`mastermind-tab-${key}`}
                  className={`flex items-center justify-center gap-1 rounded-lg px-1 py-2 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    tab === key ? "bg-violet-500/20 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  }`}
                >
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>

            {tab === "board" && (
              <BoardTab
                mastermind={mastermind}
                teams={teams}
                vehicles={vehicles}
                draft={draft}
                setDraft={setDraft}
                onScout={(targetKey) => scoutMastermindTarget({ target_key: targetKey })}
                onCreate={create}
                onStartPrep={(prepKey) => startHeistPrep({
                  heist_id: mastermind.active_heist.id,
                  prep_key: prepKey,
                })}
                onClaimPrep={(prepKey) => claimHeistPrep({
                  heist_id: mastermind.active_heist.id,
                  prep_key: prepKey,
                })}
                onLaunch={() => launchMastermindHeist({ heist_id: mastermind.active_heist.id })}
                onClaim={() => claimMastermindHeist({ heist_id: mastermind.active_heist.id })}
                onAbort={() => abortMastermindHeist({ heist_id: mastermind.active_heist.id })}
              />
            )}

            {tab === "market" && (
              <MarketTab
                market={mastermind.market}
                quantity={tradeQuantity}
                setQuantity={setTradeQuantity}
                onTrade={(goodKey, action) => tradeBlackMarket({
                  good_key: goodKey,
                  action,
                  quantity: Number(tradeQuantity),
                })}
              />
            )}

            {tab === "bounty" && (
              <BountyTab
                bounty={mastermind.bounty}
                teams={teams}
                teamId={hunterTeamId}
                setTeamId={setHunterTeamId}
                onPay={() => resolveBounty({ action: "pay" })}
                onAmbush={() => resolveBounty({ action: "ambush", team_id: hunterTeamId })}
              />
            )}

            {tab === "caches" && (
              <CachesTab caches={mastermind.caches} onScan={(districtKey) => scanSignalCache({ district_key: districtKey })} />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};


const RankCard = ({ rank }) => (
  <Card className="lus-card p-4" data-testid="mastermind-rank">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">Estatuto Mastermind</p>
        <p className="mt-1 text-sm font-bold text-white">{rank.name}</p>
        <p className="font-mono text-[9px] text-zinc-600">Nível {rank.level} · {rank.xp} XP</p>
      </div>
      <Badge className="border-violet-500/25 bg-violet-500/10 font-mono text-violet-300">
        {rank.next_name || "Lenda máxima"}
      </Badge>
    </div>
    <MiniBar value={rank.progress_pct} color="#A78BFA" className="mt-3" height="h-1.5" />
    <p className="mt-1 text-right font-mono text-[9px] text-zinc-600">
      {rank.next_xp ? `${rank.next_xp - rank.xp} XP até ao próximo estatuto` : "Progressão completa"}
    </p>
  </Card>
);


const BoardTab = ({
  mastermind, teams, vehicles, draft, setDraft, onScout, onCreate,
  onStartPrep, onClaimPrep, onLaunch, onClaim, onAbort,
}) => {
  const active = mastermind.active_heist;
  return (
    <div className="mt-4 space-y-3">
      <RankCard rank={mastermind.rank} />

      {!active ? (
        <>
          <SectionHeader icon={BriefcaseBusiness} title="Configuração do plano" />
          <Card className="lus-card p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Equipa">
                <select
                  className={selectClass}
                  value={draft.team_id}
                  onChange={(event) => setDraft((current) => ({ ...current, team_id: event.target.value }))}
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} · {team.status === "idle" ? "pronta" : team.status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Veículo de fuga">
                <select
                  className={selectClass}
                  value={draft.vehicle_id}
                  onChange={(event) => setDraft((current) => ({ ...current, vehicle_id: event.target.value }))}
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} · {Math.round(vehicle.condition)}%
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Abordagem">
                <select
                  className={selectClass}
                  value={draft.approach_key}
                  onChange={(event) => setDraft((current) => ({ ...current, approach_key: event.target.value }))}
                >
                  {mastermind.approaches.map((approach) => (
                    <option key={approach.key} value={approach.key} disabled={!approach.unlocked}>
                      {approach.name}{!approach.unlocked ? ` · nível ${approach.unlock_rank}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Recetor da carga">
                <select
                  className={selectClass}
                  value={draft.fence_key}
                  onChange={(event) => setDraft((current) => ({ ...current, fence_key: event.target.value }))}
                >
                  {mastermind.fences.map((fence) => (
                    <option key={fence.key} value={fence.key} disabled={!fence.unlocked}>
                      {fence.name}{!fence.unlocked ? ` · nível ${fence.unlock_rank}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="mt-3 block font-mono text-[9px] uppercase tracking-wider text-zinc-500">
              Parte da equipa · <span className="text-violet-300">{draft.crew_cut_pct}%</span>
              <input
                type="range"
                min="10"
                max="35"
                step="1"
                value={draft.crew_cut_pct}
                onChange={(event) => setDraft((current) => ({ ...current, crew_cut_pct: Number(event.target.value) }))}
                className="mt-2 w-full accent-violet-500"
              />
            </label>
            <p className="mt-1 text-[10px] text-zinc-600">
              Uma parte maior reduz o teu pagamento, mas melhora a moral, lealdade e precisão da equipa.
            </p>
          </Card>

          <SectionHeader icon={Target} title="Quadro de alvos" meta={`${mastermind.targets.filter((item) => item.unlocked).length}/${mastermind.targets.length} acessíveis`} />
          {mastermind.targets.map((target) => (
            <TargetCard
              key={target.key}
              target={target}
              canCreate={Boolean(draft.team_id && draft.vehicle_id)}
              onScout={() => onScout(target.key)}
              onCreate={() => onCreate(target.key)}
            />
          ))}
        </>
      ) : (
        <ActivePlan
          active={active}
          onStartPrep={onStartPrep}
          onClaimPrep={onClaimPrep}
          onLaunch={onLaunch}
          onClaim={onClaim}
          onAbort={onAbort}
        />
      )}
    </div>
  );
};


const TargetCard = ({ target, canCreate, onScout, onCreate }) => (
  <Card className={`lus-card p-4 ${target.unlocked ? "" : "opacity-55"}`} data-testid={`mastermind-target-${target.key}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-display text-sm font-bold uppercase tracking-wide text-white">{target.name}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{target.description}</p>
      </div>
      <Badge variant="outline" className="shrink-0 border-white/10 font-mono text-[9px] text-zinc-400">
        {fmtMoney(target.base_reward)}
      </Badge>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-1 text-center">
      <Info label="Base" value={`${Math.round(target.base_success * 100)}%`} />
      <Info label="Calor" value={`+${target.heat}`} />
      <Info label="Preps" value={target.preps.length} />
    </div>
    {target.intel ? (
      <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-2">
        <p className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase text-violet-300">
          <ScanLine size={11} /> Dossiê ativo · {target.intel.recommended_name}
        </p>
        <p className="mt-1 text-[10px] text-zinc-500">
          {target.intel.risk_note} · {fmtMoney(target.intel.reward_min)}–{fmtMoney(target.intel.reward_max)}
        </p>
      </div>
    ) : null}
    <div className="mt-3 flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 flex-1 text-[9px]"
        disabled={!target.unlocked || target.intel_active}
        onClick={onScout}
      >
        <ScanLine size={11} /> {target.intel_active ? "Dossiê ativo" : "Obter dossiê"}
      </Button>
      <Button
        size="sm"
        className="h-8 flex-1 text-[9px]"
        disabled={!target.unlocked || !canCreate || target.cooldown_remaining_s > 0}
        onClick={onCreate}
      >
        {!target.unlocked
          ? <><LockKeyhole size={11} /> Nível {target.unlock_rank}</>
          : target.cooldown_remaining_s > 0
          ? <><Clock3 size={11} /> {fmtDuration(target.cooldown_remaining_s)}</>
          : <><ListChecks size={11} /> Montar plano</>}
      </Button>
    </div>
  </Card>
);


const ActivePlan = ({ active, onStartPrep, onClaimPrep, onLaunch, onClaim, onAbort }) => {
  const finale = active.finale;
  if (finale) {
    const ready = finale.status === "ready";
    return (
      <>
        <SectionHeader icon={Crosshair} title="Final em execução" />
        <Card className="lus-card overflow-hidden p-4" data-testid="mastermind-finale">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-white">{active.target_name}</p>
              <p className="font-mono text-[9px] uppercase text-zinc-500">
                {active.team_name} · {active.vehicle_name}
              </p>
            </div>
            <Badge className={ready ? "bg-emerald-500/15 text-emerald-300" : "bg-violet-500/15 text-violet-300"}>
              {ready ? "Resultado pronto" : fmtDuration(finale.remaining_s)}
            </Badge>
          </div>
          <MiniBar value={finale.progress_pct} color={ready ? "#34D399" : "#A78BFA"} className="mt-4" height="h-2" />
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase text-amber-300">
              <Sparkles size={11} /> {finale.complication_name}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">{finale.complication_description}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center">
            <Info label="Chance" value={`${Math.round(finale.chance * 100)}%`} />
            <Info label="Líquido" value={fmtMoney(finale.net_reward)} />
            <Info label="Capacidade" value={`${finale.loot_capacity_pct}%`} />
          </div>
          <Button className="mt-4 w-full" disabled={!ready} onClick={onClaim}>
            {ready ? <><Check size={14} /> Recolher o resultado</> : <><Clock3 size={14} /> Equipa no alvo</>}
          </Button>
          <Button variant="ghost" className="mt-2 w-full text-[10px] text-red-400" onClick={onAbort}>
            <X size={12} /> Abortar e retirar a equipa
          </Button>
        </Card>
      </>
    );
  }

  const completed = active.preps.filter((prep) => prep.status === "complete").length;
  return (
    <>
      <SectionHeader icon={ListChecks} title={active.target_name} meta={`${completed}/${active.preps.length} preparações`} />
      <Card className="lus-card p-3">
        <div className="grid grid-cols-2 gap-2">
          <Info label="Equipa" value={active.team_name} />
          <Info label="Veículo" value={active.vehicle_name} />
          <Info label="Abordagem" value={active.approach_name} />
          <Info label="Recetor" value={active.fence_name} />
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
          <p className="font-mono text-[9px] uppercase text-zinc-500">Lista de prontidão</p>
          <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[9px]">
            <ReadyLine ready={active.readiness.team} label="Equipa escolhida" />
            <ReadyLine ready={active.readiness.vehicle} label="Veículo escolhido" />
            <ReadyLine ready={active.readiness.approach} label="Abordagem definida" />
            <ReadyLine ready={active.readiness.fence} label="Recetor definido" />
          </div>
        </div>
      </Card>

      <SectionHeader icon={Gauge} title="Preparações" meta={`${active.readiness.required_done}/${active.readiness.required_total} obrigatórias`} />
      {active.preps.map((prep) => {
        const isCurrent = active.current_prep?.prep_key === prep.key;
        const canClaim = isCurrent && active.current_prep?.status === "ready";
        const running = isCurrent && active.current_prep?.status === "running";
        return (
          <Card key={prep.key} className="lus-card p-3" data-testid={`mastermind-prep-${prep.key}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-white">{prep.name}</p>
                <p className="font-mono text-[9px] text-zinc-500">
                  {prep.required ? "Obrigatória" : "Opcional"} · {fmtMoney(prep.cost)} · {prep.attempts} tentativa(s)
                </p>
              </div>
              <Badge variant="outline" className={prep.status === "complete" ? "border-emerald-500/30 text-emerald-300" : "border-white/10 text-zinc-400"}>
                {statusLabel[prep.status] || prep.status}
              </Badge>
            </div>
            {isCurrent && (
              <div className="mt-3">
                <MiniBar value={active.current_prep.progress_pct} color={canClaim ? "#34D399" : "#A78BFA"} height="h-1.5" />
                <p className="mt-1 text-right font-mono text-[9px] text-zinc-600">
                  {canClaim ? "Relatório disponível" : fmtDuration(active.current_prep.remaining_s)}
                </p>
              </div>
            )}
            <Button
              size="sm"
              variant={canClaim ? "default" : "outline"}
              className="mt-3 h-8 w-full text-[9px]"
              disabled={prep.status === "complete" || Boolean(active.current_prep && !canClaim)}
              onClick={() => canClaim ? onClaimPrep(prep.key) : onStartPrep(prep.key)}
            >
              {prep.status === "complete"
                ? <><Check size={11} /> Preparação concluída</>
                : canClaim
                ? <><Check size={11} /> Recolher relatório</>
                : running
                ? <><Clock3 size={11} /> Em curso</>
                : <><Play size={11} /> Iniciar · {fmtDuration(prep.duration_s)}</>}
            </Button>
          </Card>
        );
      })}

      <Button className="w-full" disabled={!active.readiness.ready} onClick={onLaunch}>
        <Crosshair size={14} /> Lançar o golpe
      </Button>
      <Button variant="ghost" className="w-full text-[10px] text-red-400" onClick={onAbort}>
        <X size={12} /> Cancelar plano
      </Button>
    </>
  );
};


const MarketTab = ({ market, quantity, setQuantity, onTrade }) => (
  <div className="mt-4 space-y-3">
    <SectionHeader icon={Coins} title="Mercado negro dinâmico" meta={`${market.used}/${market.capacity} espaço`} />
    <Card className="lus-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase text-zinc-500">Armazenamento clandestino</p>
          <p className="mt-1 text-xs font-bold text-white">{market.used} de {market.capacity} unidades</p>
        </div>
        <Badge className={market.raid_risk_pct >= 25 ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}>
          {market.raid_risk_pct}% risco
        </Badge>
      </div>
      <MiniBar value={(market.used / Math.max(1, market.capacity)) * 100} color="#F59E0B" className="mt-3" height="h-1.5" />
      <label className="mt-3 block font-mono text-[9px] uppercase text-zinc-500">
        Quantidade por ordem
        <input
          type="number"
          min="1"
          max="20"
          value={quantity}
          onChange={(event) => setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
          className={selectClass}
        />
      </label>
    </Card>

    {market.raid_log?.[0] && (
      <Card className="border-red-500/20 bg-red-500/5 p-3">
        <p className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase text-red-300">
          <AlertTriangle size={11} /> Última rusga ao armazém
        </p>
        <p className="mt-1 text-[10px] text-zinc-500">
          Perdas: {Object.entries(market.raid_log[0].losses).map(([key, value]) => `${key} ×${value}`).join(" · ")}
        </p>
      </Card>
    )}

    {market.goods.map((good) => {
      const TrendIcon = good.trend === "up" ? TrendingUp : good.trend === "down" ? TrendingDown : Gauge;
      const totalSpace = good.space * quantity;
      return (
        <Card key={good.key} className={`lus-card p-3 ${good.unlocked ? "" : "opacity-55"}`}>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40">
              <Package size={16} className="text-amber-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-white">{good.name}</p>
                <span className="font-mono text-[10px] font-bold text-amber-300">{fmtMoney(good.price)}</span>
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">{good.description}</p>
              <div className="mt-2 flex items-center justify-between font-mono text-[9px]">
                <span className="text-zinc-500">Carteira: {good.owned} · espaço {good.space}/un.</span>
                <span className={good.trend === "up" ? "text-emerald-300" : good.trend === "down" ? "text-red-300" : "text-zinc-400"}>
                  <TrendIcon size={10} className="mr-1 inline" /> {good.change_pct > 0 ? "+" : ""}{good.change_pct}%
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[9px]"
              disabled={!good.unlocked || market.used + totalSpace > market.capacity}
              onClick={() => onTrade(good.key, "buy")}
            >
              Comprar · {fmtMoney(good.price * quantity)}
            </Button>
            <Button
              size="sm"
              className="h-8 text-[9px]"
              disabled={!good.unlocked || good.owned < quantity}
              onClick={() => onTrade(good.key, "sell")}
            >
              Vender · {fmtMoney(good.price * quantity)}
            </Button>
          </div>
        </Card>
      );
    })}
  </div>
);


const BountyTab = ({ bounty, teams, teamId, setTeamId, onPay, onAmbush }) => (
  <div className="mt-4 space-y-3">
    <SectionHeader icon={ShieldAlert} title="Resposta aos caçadores" />
    <Card className="lus-card overflow-hidden p-4" data-testid="mastermind-bounty">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">Recompensa rival</p>
          <p className="mt-1 text-lg font-bold text-white">{bounty.name}</p>
        </div>
        <span className="font-mono text-2xl font-black text-red-400">{bounty.value}</span>
      </div>
      <MiniBar value={bounty.progress_pct} color={bounty.tier >= 3 ? "#EF4444" : "#F59E0B"} className="mt-3" height="h-2" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Info label="Ameaça" value={`Nível ${bounty.tier}`} />
        <Info label="Compra de silêncio" value={fmtMoney(bounty.payoff_cost)} />
      </div>
    </Card>

    <Card className="lus-card p-3">
      <p className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase text-zinc-400">
        <Users size={11} /> Contraemboscada
      </p>
      <p className="mt-1 text-[10px] text-zinc-500">
        Envia uma equipa disponível para identificar e quebrar a rede que te está a seguir.
      </p>
      <select className={selectClass} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>{team.name} · {team.status}</option>
        ))}
      </select>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" className="h-9 text-[9px]" disabled={!bounty.value} onClick={onPay}>
          <Coins size={11} /> Pagar silêncio
        </Button>
        <Button
          size="sm"
          className="h-9 text-[9px]"
          disabled={!bounty.value || !teamId || bounty.hunter_remaining_s > 0}
          onClick={onAmbush}
        >
          <Crosshair size={11} /> {bounty.hunter_remaining_s > 0 ? fmtDuration(bounty.hunter_remaining_s) : "Montar emboscada"}
        </Button>
      </div>
    </Card>
  </div>
);


const CachesTab = ({ caches, onScan }) => (
  <div className="mt-4 space-y-3">
    <SectionHeader icon={RadioTower} title="Rede de sinais" meta={`${caches.collected}/${caches.total}`} />
    <Card className="lus-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] uppercase text-zinc-500">Cifragem territorial</p>
          <p className="mt-1 text-xs font-bold text-white">
            {caches.completion_claimed ? "Rede Lenda do Sinal completa" : "Localiza as caches de cada zona"}
          </p>
        </div>
        <RadioTower size={20} className={caches.completion_claimed ? "text-emerald-300" : "text-violet-300"} />
      </div>
      <MiniBar value={(caches.collected / Math.max(1, caches.total)) * 100} color="#A78BFA" className="mt-3" height="h-1.5" />
      <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
        Cada assinatura pode ser recolhida uma vez. Completar a rede concede um pagamento e XP adicionais.
      </p>
    </Card>

    {caches.districts.map((district) => (
      <Card key={district.key} className="lus-card p-3" data-testid={`signal-cache-${district.key}`}>
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
            district.collected ? "border-emerald-500/25 bg-emerald-500/5" : "border-white/10 bg-black/40"
          }`}>
            {district.collected ? <Check size={16} className="text-emerald-300" /> : <ScanLine size={16} className="text-violet-300" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{district.name}</p>
            <p className="font-mono text-[9px] uppercase text-zinc-600">Assinatura {district.signature}</p>
          </div>
          <Badge variant="outline" className={district.collected ? "border-emerald-500/30 text-emerald-300" : "border-white/10 text-zinc-500"}>
            {district.collected ? "Recuperada" : "Por localizar"}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 h-8 w-full text-[9px]"
          disabled={district.collected || district.remaining_s > 0}
          onClick={() => onScan(district.key)}
        >
          {district.collected
            ? <><Check size={11} /> Cache segura</>
            : district.remaining_s > 0
            ? <><Clock3 size={11} /> Recalibrar · {fmtDuration(district.remaining_s)}</>
            : <><ScanLine size={11} /> Varrer frequência</>}
        </Button>
      </Card>
    ))}
  </div>
);


const Field = ({ label, children }) => (
  <label className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
    {label}
    {children}
  </label>
);

const Info = ({ label, value }) => (
  <div className="rounded-lg border border-white/[0.08] bg-black/25 p-2">
    <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">{label}</p>
    <p className="mt-0.5 truncate font-mono text-[10px] font-bold text-zinc-300">{value}</p>
  </div>
);

const ReadyLine = ({ ready, label }) => (
  <span className={ready ? "flex items-center gap-1 text-emerald-300" : "flex items-center gap-1 text-zinc-600"}>
    {ready ? <Check size={10} /> : <X size={10} />} {label}
  </span>
);

