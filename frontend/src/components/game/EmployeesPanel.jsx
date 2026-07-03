import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContext";
import {
  fmtMoney, fmtDuration, SPEC_LABELS, EMP_STATUS_LABELS, EMP_STATUS_COLORS, STATUS_LABELS,
  ATTR_LABELS, ATTR_FULL, RARITY_LABELS, RARITY_COLORS, RANK_LABELS, fatigueColor, goodBarColor,
} from "../../lib/game";
import { Tip, Kpi, SummaryStrip, InlineRename } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import {
  IdCard, GraduationCap, BedDouble, ChevronUp, Gift, UserX, Lock,
  Cross, Gavel, Sparkles, History, ChevronDown, RefreshCw, AlertTriangle, Warehouse,
  HeartPulse, ShieldCheck, BatteryMedium, UserCheck, Car,
} from "lucide-react";

const EMP_STATUS_TIPS = {
  idle: "Disponível para missões, treino ou descanso.",
  on_mission: "Em operação — regressa quando a equipa voltar ao QG.",
  training: "Em formação — ganha atributos e XP quando terminar.",
  resting: "A descansar — recupera 50 de fadiga e +5 de moral.",
  injured: "Ferido — não pode operar. Paga a clínica para o curar.",
  arrested: "Preso — contrata o advogado ou paga suborno para o libertar.",
};

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

const StatBar = ({ label, value, color }) => (
  <div>
    <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
      <span>{label}</span>
      <span>{Math.round(value)}%</span>
    </div>
    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
      <div className="h-full transition-all duration-500" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  </div>
);

const RarityBadge = ({ rarity, rar }) => (
  <Tip tip={rar ? `Raridade ${RARITY_LABELS[rarity]}: atributos ×${rar.mult}, nível máx. ${rar.max_level}, ${rar.talent_slots} slot(s) de talento.` : null} align="end">
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
      style={{ color: RARITY_COLORS[rarity], background: `${RARITY_COLORS[rarity]}1a` }}
    >
      {RARITY_LABELS[rarity]}
    </span>
  </Tip>
);

const ActionBtn = ({ testId, icon: Icon, label, color, onClick, disabled, title }) => (
  <Tip tip={title} block>
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-1 rounded border border-white/10 px-2 py-1.5 font-mono text-[10px] transition-colors hover:bg-white/5 disabled:opacity-40 ${color}`}
    >
      <Icon size={11} /> {label}
    </button>
  </Tip>
);

const EmployeeCard = ({ e }) => {
  const {
    state, catalog, serverNow, assignEmployee, trainEmployee, restEmployee,
    promoteEmployee, bonusEmployee, healEmployee, releaseEmployee, fireEmployee, renameEmployee,
  } = useGame();
  const [manage, setManage] = useState(false);
  const [course, setCourse] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const sp = catalog.specializations[e.role_key] || {};
  const rar = catalog.rarities[e.rarity] || {};
  const maxLevel = rar.max_level || 5;
  const xpArr = catalog.emp_level_xp || [];
  const nextXp = e.level < maxLevel && e.level < xpArr.length ? xpArr[e.level] : null;
  const prevXp = xpArr[e.level - 1] || 0;
  const xpPct = nextXp ? Math.min(100, ((e.xp - prevXp) / (nextXp - prevXp)) * 100) : 100;

  const untilIso = e.status === "training" ? e.training?.ends_at : e.status_until;
  const remaining = untilIso ? Math.max(0, (Date.parse(untilIso) - serverNow()) / 1000) : null;

  const team = e.team_id ? state.teams.find((t) => t.id === e.team_id) : null;
  const vehicle = team?.vehicle_id ? state.vehicles.find((v) => v.id === team.vehicle_id) : null;
  const mission = e.status === "on_mission" && team ? state.missions.find((m) => m.team_id === team.id) : null;
  let missionEtaS = null;
  let missionPhaseLabel = "";
  if (mission) {
    const nextAt = mission.phase === "en_route" ? mission.arrive_at : mission.phase === "operating" ? mission.finish_at : mission.return_at;
    missionEtaS = Math.max(0, (Date.parse(nextAt) - serverNow()) / 1000);
    missionPhaseLabel = STATUS_LABELS[mission.phase] || mission.phase;
  }

  const rankIdx = Math.max(0, catalog.ranks.indexOf(e.rank));
  const isTopRank = rankIdx >= catalog.ranks.length - 1;
  const nextRankReq = isTopRank ? null : catalog.rank_req_level[rankIdx + 1];
  const promoteCost = catalog.hr_costs.promote_base * (rankIdx + 1);
  const bonusCost = Math.max(100, e.salary);
  const healCost = Math.max(200, Math.round(catalog.hr_costs.heal_base * (1 - (state.bonuses?.heal || 0))));
  const releaseCost = Math.max(300, Math.round(
    (catalog.hr_costs.release_base + state.player.heat * 30) *
    (1 - (state.bonuses?.legal || 0)) * (1 - (state.bonuses?.bribe_discount || 0))
  ));
  const fireCost = e.salary * 3;
  const money = state.player.clean_money;
  const idle = e.status === "idle";

  return (
    <div data-testid={`employee-card-${e.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <InlineRename
              testId={`emp-rename-${e.id}`} value={e.name} onSave={(name) => renameEmployee(e.id, name)}
              textClassName="text-sm font-bold text-white"
            />
            <Tip tip={`Nível ${e.level} de ${maxLevel} (máximo para a raridade ${RARITY_LABELS[e.rarity]}).`}>
              <span data-testid={`employee-level-${e.id}`} className="shrink-0 font-mono text-[10px] font-bold text-cyan-400">N{e.level}/{maxLevel}</span>
            </Tip>
            <span className="shrink-0 font-mono text-[10px] font-normal text-zinc-500">{e.age} anos</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            {sp.name || e.role_key} · {RANK_LABELS[e.rank] || e.rank}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <RarityBadge rarity={e.rarity} rar={rar} />
          <Tip
            tip={mission ? `${mission.opportunity?.name || "Operação"} · ${missionPhaseLabel} · termina em ${fmtDuration(missionEtaS)}` : EMP_STATUS_TIPS[e.status]}
            align="end"
          >
            <span
              data-testid={`employee-status-${e.id}`}
              className="rounded-full px-2 py-0.5 text-right font-mono text-[9px] font-bold uppercase"
              style={{ color: EMP_STATUS_COLORS[e.status], background: `${EMP_STATUS_COLORS[e.status]}1a` }}
            >
              {mission ? mission.opportunity?.name || EMP_STATUS_LABELS[e.status] : EMP_STATUS_LABELS[e.status] || e.status}
              {mission ? <> · {fmtDuration(missionEtaS)}</> : remaining !== null && remaining > 0 && <> · {fmtDuration(remaining)}</>}
            </span>
          </Tip>
        </div>
      </div>

      <div className="mt-2">
        <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
          <span>XP</span>
          <span>{nextXp ? `${e.xp}/${nextXp}` : "MAX"}</span>
        </div>
        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <StatBar label="Moral" value={e.morale} color={goodBarColor(e.morale)} />
        <StatBar label="Lealdade" value={e.loyalty} color={goodBarColor(e.loyalty)} />
        <StatBar label="Fadiga" value={e.fatigue} color={fatigueColor(e.fatigue)} />
      </div>

      {e.betrayal_risk >= 25 && (
        <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-red-400" data-testid={`betrayal-warning-${e.id}`}>
          <AlertTriangle size={10} /> Risco de traição: {e.betrayal_risk}% — paga um bónus ou promove-o
        </p>
      )}

      <div className="mt-2 grid grid-cols-5 gap-1">
        {Object.entries(e.attrs || {}).map(([k, v]) => {
          const key = (sp.attrs || []).includes(k);
          return (
            <Tip key={k} tip={`${ATTR_FULL[k] || k}: ${v}${key ? " — atributo-chave desta especialização, pesa mais nas operações." : ""}`} block>
              <div
                className={`rounded px-1 py-0.5 text-center font-mono text-[9px] ${
                  key ? "bg-red-500/15 text-red-300" : "bg-black/40 text-zinc-500"
                }`}
              >
                {ATTR_LABELS[k] || k} <span className="font-bold text-white">{v}</span>
              </div>
            </Tip>
          );
        })}
      </div>

      {(e.talents || []).length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {e.talents.map((t) => (
            <Tip key={t} tip={catalog.talents[t]?.desc}>
              <span className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">
                <Sparkles size={9} /> {catalog.talents[t]?.name || t}
              </span>
            </Tip>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <select
          data-testid={`emp-team-select-${e.id}`}
          value={e.team_id || ""}
          disabled={!idle}
          onChange={(ev) => assignEmployee(e.id, ev.target.value || null)}
          className="w-full flex-1 rounded border border-white/10 bg-black/60 px-2 py-1 font-mono text-[11px] text-white disabled:opacity-40"
        >
          <option value="">Sem equipa</option>
          {state.teams.map((t) => (
            <option key={t.id} value={t.id}>{`${t.name} · ${state.employees.filter((x) => x.team_id === t.id).length} membros`}</option>
          ))}
        </select>
        <Tip tip={`Salário: ${fmtMoney(e.salary)} a cada ciclo de 30 min, pago com dinheiro limpo. Promoções aumentam o salário em 10%.`} align="end">
          <span className="shrink-0 font-mono text-[10px] text-zinc-500">{fmtMoney(e.salary)}/ciclo</span>
        </Tip>
      </div>
      {vehicle && (
        <Tip tip={`Veículo atribuído à equipa ${team.name}: ${vehicle.name}.`}>
          <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-zinc-500">
            <Car size={10} className="shrink-0 text-cyan-400" /> {vehicle.name}
          </p>
        </Tip>
      )}

      {e.status === "injured" && (
        <div className="mt-2">
          <ActionBtn testId={`emp-heal-${e.id}`} icon={Cross} label={`Clínica ${fmtMoney(healCost)}`} color="w-full text-orange-400"
            onClick={() => healEmployee(e.id)} disabled={money < healCost} />
        </div>
      )}
      {e.status === "arrested" && (
        <div className="mt-2">
          <ActionBtn testId={`emp-release-${e.id}`} icon={Gavel} label={`Advogado ${fmtMoney(releaseCost)}`} color="w-full text-red-400"
            onClick={() => releaseEmployee(e.id)} disabled={money < releaseCost} />
        </div>
      )}

      <button
        data-testid={`emp-manage-toggle-${e.id}`}
        onClick={() => setManage(!manage)}
        className="mt-2 flex w-full items-center justify-center gap-1 font-mono text-[10px] uppercase text-zinc-500 transition-colors hover:text-white"
      >
        Gerir <ChevronDown size={11} className={`transition-transform ${manage ? "rotate-180" : ""}`} />
      </button>

      {manage && (
        <div className="mt-1.5 space-y-2 border-t border-white/10 pt-2">
          <div className="flex gap-1.5">
            <select
              data-testid={`emp-train-select-${e.id}`}
              value={course}
              onChange={(ev) => setCourse(ev.target.value)}
              className="flex-1 rounded border border-white/10 bg-black/60 px-2 py-1 font-mono text-[10px] text-white"
            >
              <option value="">Escolher formação...</option>
              {Object.entries(catalog.training_courses).map(([k, c]) => (
                <option key={k} value={k}>{`${c.name} · ${fmtMoney(c.cost)}${c.spec && c.spec === e.spec ? " ★" : ""}`}</option>
              ))}
            </select>
            <ActionBtn
              testId={`emp-train-btn-${e.id}`} icon={GraduationCap} label="Treinar" color="text-cyan-400"
              onClick={() => { trainEmployee(e.id, course); setCourse(""); }}
              disabled={!idle || !course || money < (catalog.training_courses[course]?.cost || Infinity)}
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ActionBtn
              testId={`emp-rest-${e.id}`} icon={BedDouble} label="Descansar" color="text-purple-300"
              onClick={() => restEmployee(e.id)} disabled={!idle || e.fatigue < 15}
              title="Recupera 50 de fadiga e +5 moral"
            />
            <ActionBtn
              testId={`emp-promote-${e.id}`} icon={ChevronUp}
              label={isTopRank ? "Topo" : `Promover ${fmtMoney(promoteCost)}`} color="text-emerald-400"
              onClick={() => promoteEmployee(e.id)}
              disabled={isTopRank || e.status === "on_mission" || e.level < nextRankReq || money < promoteCost}
              title={isTopRank ? "Já é o teu braço-direito" : `Requer nível ${nextRankReq} · +10 lealdade, +8 moral, +10% salário`}
            />
            <ActionBtn
              testId={`emp-bonus-${e.id}`} icon={Gift} label={`Bónus ${fmtMoney(bonusCost)}`} color="text-amber-400"
              onClick={() => bonusEmployee(e.id)} disabled={money < bonusCost}
              title="+15 moral, +10 lealdade"
            />
            <ActionBtn
              testId={`emp-fire-${e.id}`} icon={UserX} label={`Despedir ${fmtMoney(fireCost)}`} color="text-red-400"
              onClick={() => fireEmployee(e.id)} disabled={e.status === "on_mission" || money < fireCost}
              title="Indemnização de 3 salários. Baixa a moral dos restantes."
            />
          </div>

          {(e.history || []).length > 0 && (
            <div>
              <button
                data-testid={`emp-history-toggle-${e.id}`}
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 font-mono text-[10px] uppercase text-zinc-500 hover:text-white"
              >
                <History size={10} /> Histórico ({e.history.length})
              </button>
              {showHistory && (
                <div className="mt-1 space-y-0.5">
                  {[...e.history].reverse().map((h, i) => (
                    <p key={i} className="font-mono text-[10px] text-zinc-400">
                      <span className="text-zinc-600">{new Date(h.ts).toLocaleDateString("pt-PT")}</span> {h.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CandidateCard = ({ c }) => {
  const { state, catalog, recruitEmployee } = useGame();
  const sp = catalog.specializations[c.role_key] || {};
  const caps = state.caps.employees;
  const lackRespect = state.player.respect < c.min_respect;
  const lackMoney = state.player.clean_money < c.cost;
  const full = caps.used >= caps.max;
  const topAttrs = Object.entries(c.attrs || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const newPayroll = (state.salary_total || 0) + c.salary;
  const blockers = [];
  if (full) blockers.push("esconderijos cheios");
  if (lackRespect) blockers.push(`faltam ${(c.min_respect - state.player.respect).toLocaleString("pt-PT")} de respeito`);
  if (lackMoney) blockers.push(`faltam ${fmtMoney(c.cost - state.player.clean_money)}`);

  return (
    <div data-testid={`candidate-card-${c.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">
            {c.name} <span className="font-mono text-[10px] font-normal text-zinc-500">{c.age} anos</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            {sp.name || c.role_key} · {SPEC_LABELS[c.spec] || c.spec} ·{" "}
            <Tip tip={`Impacto na folha salarial: ${fmtMoney(state.salary_total || 0)} → ${fmtMoney(newPayroll)} por ciclo de 30 min.`}>
              <span>{fmtMoney(c.salary)}/ciclo</span>
            </Tip>
          </p>
        </div>
        <RarityBadge rarity={c.rarity} rar={catalog.rarities[c.rarity]} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {topAttrs.map(([k, v]) => (
          <Tip key={k} tip={`${ATTR_FULL[k] || k}: ${v} — um dos melhores atributos deste candidato.`}>
            <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
              {ATTR_LABELS[k] || k} <span className="font-bold text-white">{v}</span>
            </span>
          </Tip>
        ))}
        {(c.talents || []).map((t) => (
          <Tip key={t} tip={catalog.talents[t]?.desc}>
            <span className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">
              <Sparkles size={9} /> {catalog.talents[t]?.name || t}
            </span>
          </Tip>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] text-zinc-500">
          {c.min_respect > 0 && (
            <Tip tip={`Requisito de reputação: ${c.min_respect.toLocaleString("pt-PT")} de respeito para este candidato confiar em ti.`}>
              <span className={lackRespect ? "text-red-400" : "text-zinc-500"}>{c.min_respect.toLocaleString("pt-PT")} respeito</span>
            </Tip>
          )}
        </div>
        <Tip tip={blockers.length ? `Não podes contratar: ${blockers.join(" · ")}.` : `Contratar por ${fmtMoney(c.cost)} (custo único) + ${fmtMoney(c.salary)}/ciclo de salário.`} align="end">
          <button
            data-testid={`hire-candidate-${c.id}`}
            onClick={() => recruitEmployee(c.id)}
            disabled={lackRespect || lackMoney || full}
            className="rounded bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-black transition-colors hover:bg-gray-200 disabled:opacity-40"
          >
            {fmtMoney(c.cost)}
          </button>
        </Tip>
      </div>
    </div>
  );
};

export const EmployeesPanel = ({ open, onOpenChange, onNavigate }) => {
  const { state, catalog, serverNow, refreshPool, buyProperty } = useGame();
  const [tab, setTab] = useState("roster");
  useTick(open);
  if (!state || !catalog) return null;

  const caps = state.caps.employees;
  const hideout = catalog.property_types?.esconderijo;
  const canBuyHideout = hideout && state.player.level >= hideout.min_level && state.player.clean_money >= hideout.price;
  const capFull = caps.used >= caps.max;
  const payrollMs = state.player.next_payroll_at ? Date.parse(state.player.next_payroll_at) - serverNow() : null;
  const poolMs = state.player.pool_refresh_at ? Date.parse(state.player.pool_refresh_at) - serverNow() : null;

  const grouped = {};
  (state.candidates || []).forEach((c) => {
    (grouped[c.source] = grouped[c.source] || []).push(c);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-md" data-testid="employees-panel">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <IdCard size={18} className="text-red-500" /> Recursos Humanos
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="employee-caps">{caps.used}/{caps.max}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            As pessoas são o coração da organização — recruta, treina e mantém-nas leais.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Folha salarial</p>
            <p className="font-mono text-xs font-bold text-white" data-testid="salary-total">{fmtMoney(state.salary_total)}/ciclo</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Próximo pagamento</p>
            <p className="font-mono text-xs font-bold text-amber-400" data-testid="payroll-countdown">
              {payrollMs !== null ? fmtDuration(payrollMs / 1000) : "—"}
            </p>
          </div>
        </div>

        {(() => {
          const emps = state.employees;
          const avg = (fn) => (emps.length ? Math.round(emps.reduce((a, e) => a + fn(e), 0) / emps.length) : 0);
          const avgMorale = avg((e) => e.morale);
          const avgLoyalty = avg((e) => e.loyalty);
          const avgFatigue = avg((e) => e.fatigue);
          const available = emps.filter((e) => e.status === "idle" && e.fatigue < 90).length;
          const statusCounts = {};
          emps.forEach((e) => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });
          return (
            <>
              <SummaryStrip cols={4} className="mt-2" testId="hr-summary">
                <Kpi icon={HeartPulse} label="Moral" value={`${avgMorale}%`} color={goodBarColor(avgMorale)} bar={avgMorale}
                  tip="Moral média do plantel. Moral baixa aumenta falhas e abandonos — sobe com bónus, promoções e descanso." />
                <Kpi icon={ShieldCheck} label="Lealdade" value={`${avgLoyalty}%`} color={goodBarColor(avgLoyalty)} bar={avgLoyalty}
                  tip="Lealdade média. Valores baixos aumentam o risco de traições: roubos, fugas de informação e sabotagem." />
                <Kpi icon={BatteryMedium} label="Fadiga" value={`${avgFatigue}%`} color={fatigueColor(avgFatigue)} bar={avgFatigue}
                  tip="Fadiga média. Aos 90% um funcionário fica indisponível — manda-o descansar (recupera 50)." />
                <Kpi icon={UserCheck} label="Disponíveis" value={`${available}/${emps.length}`} color={available > 0 ? "#34D399" : "#EF4444"}
                  tip="Funcionários prontos para operar já: sem tarefa atribuída e com fadiga abaixo de 90%." />
              </SummaryStrip>
              {Object.keys(statusCounts).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="hr-status-chips">
                  {Object.entries(statusCounts).map(([s, n]) => (
                    <Tip key={s} tip={EMP_STATUS_TIPS[s]}>
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase"
                        style={{ color: EMP_STATUS_COLORS[s], background: `${EMP_STATUS_COLORS[s]}14` }}
                      >
                        {n} {EMP_STATUS_LABELS[s]}
                      </span>
                    </Tip>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {capFull && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2" data-testid="hr-cap-full">
            <p className="font-mono text-[10px] text-amber-400">Esconderijos cheios</p>
            {canBuyHideout ? (
              <button
                data-testid="hr-buy-hideout-inline"
                onClick={() => buyProperty("esconderijo")}
                className="flex items-center gap-1 rounded border border-white/15 px-2 py-1 font-mono text-[10px] font-bold text-purple-300 transition-colors hover:bg-white/10"
              >
                <Warehouse size={10} /> Comprar esconderijo · {fmtMoney(hideout.price)}
              </button>
            ) : (
              <button
                data-testid="hr-nav-properties"
                onClick={() => onNavigate && onNavigate("properties")}
                className="font-mono text-[10px] text-purple-300 underline-offset-2 hover:underline"
              >
                Ver Imóveis
              </button>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
          <button
            data-testid="tab-roster"
            onClick={() => setTab("roster")}
            className={`rounded px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
              tab === "roster" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
            }`}
          >
            Plantel ({state.employees.length})
          </button>
          <button
            data-testid="tab-recruit"
            onClick={() => setTab("recruit")}
            className={`rounded px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
              tab === "recruit" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
            }`}
          >
            Recrutar ({(state.candidates || []).length})
          </button>
        </div>

        {tab === "roster" && (
          <div className="mt-3 space-y-2" data-testid="employees-list">
            {state.employees.length === 0 && (
              <p className="font-mono text-[11px] text-zinc-600">Sem funcionários. Vai à aba Recrutar.</p>
            )}
            {state.employees.map((e) => (
              <EmployeeCard key={e.id} e={e} />
            ))}
          </div>
        )}

        {tab === "recruit" && (
          <div className="mt-3" data-testid="recruitment-list">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] text-zinc-500">
                Novos contactos em <span className="text-white">{poolMs !== null ? fmtDuration(Math.max(0, poolMs / 1000)) : "—"}</span>
              </p>
              <button
                data-testid="refresh-pool-btn"
                onClick={() => refreshPool()}
                disabled={state.player.clean_money < catalog.hr_costs.pool_refresh}
                className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-cyan-400 transition-colors hover:bg-white/5 disabled:opacity-40"
              >
                <RefreshCw size={10} /> Atualizar {fmtMoney(catalog.hr_costs.pool_refresh)}
              </button>
            </div>

            {Object.entries(catalog.recruit_sources).map(([key, src]) => {
              const locked = state.player.level < src.min_level;
              const cands = grouped[key] || [];
              return (
                <div key={key} className="mb-4">
                  <h3 className="mb-1.5 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {src.name}
                    {locked && (
                      <span className="flex items-center gap-0.5 font-mono text-[9px] text-amber-400">
                        <Lock size={9} /> Nível {src.min_level}
                      </span>
                    )}
                  </h3>
                  {locked ? (
                    <p className="font-mono text-[10px] text-zinc-600">Sobe de nível para desbloquear esta fonte de recrutamento.</p>
                  ) : cands.length === 0 ? (
                    <p className="font-mono text-[10px] text-zinc-600">Sem candidatos de momento.</p>
                  ) : (
                    <div className="space-y-2">
                      {cands.map((c) => (
                        <CandidateCard key={c.id} c={c} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
