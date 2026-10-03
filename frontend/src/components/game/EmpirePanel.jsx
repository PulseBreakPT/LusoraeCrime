import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, fmtDuration, passiveRates, heatStatus } from "../../lib/game";
import { Tip, MiniBar, PanelKicker, PanelWatermark, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Table, TableBody, TableCell, TableRow } from "../ui/table";
import {
  Building2, Banknote, MapPin, Siren, TrendingUp, TrendingDown,
  AlertTriangle, History, ChevronDown, Clock,
} from "lucide-react";

const TX_LABELS = {
  mission_reward: "Recompensa de operação", payroll: "Ciclo salarial", weekly_costs: "Fecho semanal", vehicle_buy: "Compra de veículo",
  vehicle_sell: "Venda de veículo", refuel: "Combustível", repair: "Reparação", recruit: "Recrutamento",
  pool_refresh: "Novos contactos", training: "Formação", promote: "Promoção", bonus: "Bónus",
  heal: "Clínica", release: "Advogado", fire: "Indemnização", property_buy: "Compra de imóvel",
  property_sell: "Venda de imóvel", property_upgrade: "Melhoria de imóvel", hq_upgrade: "Melhoria do Quartel-General",
  bribe: "Suborno",
  launder_out: "Lavagem (saída)", launder_in: "Lavagem (entrada)", team_create: "Nova equipa",
};

export const EmpirePanel = ({ open, onOpenChange }) => {
  const { state, catalog, serverNow, launder, bribePolice, fetchTransactions } = useGame();
  const [amount, setAmount] = useState("");
  const [showLedger, setShowLedger] = useState(false);
  const [transactions, setTransactions] = useState([]);
  useEffect(() => {
    if (!open) return;
    fetchTransactions().then((r) => { if (r.ok) setTransactions(r.data); });
  }, [open, fetchTransactions]);
  if (!state) return null;
  const p = state.player;
  const { dirtyPerH, launderPerH, heatPerH } = passiveRates(state, catalog, serverNow());
  const hs = heatStatus(p.heat);
  const weeklyFixed = state.weekly_fixed_total || state.salary_total || 0;
  const weeklyBreakdown = state.weekly_cost_breakdown || {};
  const fixedPerH = weeklyFixed / (7 * 24);
  const netPerH = dirtyPerH + launderPerH - fixedPerH;
  // Autonomia financeira: converte o fecho fixo semanal para um equivalente
  // horário apenas para comparar com a lavagem passiva; a cobrança real é
  // sempre feita à segunda-feira às 20:00.
  const cleanNetPerH = launderPerH - fixedPerH;
  const runwayHours = cleanNetPerH < 0 ? p.clean_money / Math.abs(cleanNetPerH) : null;
  const payrollS = p.next_payroll_at ? Math.max(0, (Date.parse(p.next_payroll_at) - serverNow()) / 1000) : null;
  const liquidity = weeklyFixed > 0 && p.clean_money < weeklyFixed * 0.5
    ? "red"
    : weeklyFixed > 0 && p.clean_money < weeklyFixed
    ? "amber"
    : null;
  const dirtyCap = state.caps?.dirty_money;
  const baseLaunderRate = catalog?.economy_meta?.launder_base_rate ?? 0.78;

  const handleLaunder = async () => {
    const value = parseInt(amount, 10);
    if (!value || value <= 0) return;
    const res = await launder(value);
    if (res.ok) setAmount("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto lus-panel">
        <SheetHeader>
          <PanelWatermark icon={Building2} />
          <PanelKicker>Rede · Visão Geral</PanelKicker>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Building2 size={18} className="text-primary" /> {p.org_name}
          </SheetTitle>
          <SheetDescription className="text-zinc-500">O dinheiro não dorme — lava-o, investe-o e mantém a polícia longe.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatBox label="€ Limpo" value={fmtMoney(p.clean_money)} accent="#10B981" tip="Pronto a gastar: compras, salários, reparações e subornos." />
          <StatBox label="€ Sujo" value={fmtMoney(p.dirty_money)} accent="#F59E0B" tip="Precisa de ser lavado antes de poder ser gasto. Lava abaixo ou usa empresas de fachada." />
        </div>

        <Tip tip={p.next_level_respect ? `Nível ${p.level} — faltam ${p.next_level_respect - p.respect} de respeito para o próximo. O respeito ganha-se em operações bem-sucedidas e desbloqueia conteúdo novo.` : "Nível máximo alcançado — domínio total de Lisboa."} block>
          <Card className="mt-2 lus-card p-3 shadow-none" data-testid="empire-level-card">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Nível <span className="ml-1 font-mono text-sm font-bold text-primary">{p.level}</span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Respeito <span className="ml-1 font-mono text-sm font-bold text-white">{p.respect}</span>
                {p.next_level_respect && <span className="text-zinc-600">/{p.next_level_respect}</span>}
              </p>
            </div>
            <MiniBar value={p.next_level_respect ? (p.respect / p.next_level_respect) * 100 : 100} color="#DC2626" className="mt-2" height="h-1.5" />
          </Card>
        </Tip>

        {dirtyCap && (
          <Tip tip={`Limite de armazenamento de dinheiro sujo: ${fmtMoney(dirtyCap.max)}. Acima disto, a produção passiva e as recompensas de operações são desperdiçadas — lava regularmente para abrir espaço.`} block>
            <div className="mt-2 flex w-full items-center justify-between font-mono text-[9px] uppercase tracking-wider text-zinc-500">
              <span>Armazenamento sujo</span>
              <span className={dirtyCap.used >= dirtyCap.max * 0.9 ? "text-red-400" : "text-zinc-400"}>
                {fmtMoney(dirtyCap.used)} / {fmtMoney(dirtyCap.max)}
              </span>
            </div>
          </Tip>
        )}
        {dirtyCap && dirtyCap.used >= dirtyCap.max * 0.9 && (
          <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-red-400" data-testid="dirty-cap-warning">
            <AlertTriangle size={10} /> Perto do limite de armazenamento — lava dinheiro antes que a produção seja desperdiçada.
          </p>
        )}

        {liquidity && (
          <Alert
            data-testid="liquidity-warning"
            variant={liquidity === "red" ? "destructive" : "default"}
            className={`mt-2 py-2 ${liquidity === "red" ? "border-red-600/40 bg-red-600/10" : "border-amber-500/30 bg-amber-500/5"}`}
          >
            <AlertTriangle size={12} className={liquidity === "red" ? "text-red-400" : "text-amber-400"} />
            <AlertDescription className={`font-mono text-[10px] ${liquidity === "red" ? "text-red-400" : "text-amber-400"}`}>
              {liquidity === "red"
                ? "Reserva crítica: podes não conseguir pagar o fecho semanal de segunda-feira às 20:00."
                : "Reserva baixa: o dinheiro limpo está abaixo do próximo fecho semanal."}
            </AlertDescription>
          </Alert>
        )}

        <Card className="mt-3 lus-card p-3 shadow-none" data-testid="empire-cashflow">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <TrendingUp size={11} className="text-emerald-400" /> Fluxo de caixa passivo
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <Tip tip="Dinheiro sujo gerado por hora pelos laboratórios." block>
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-zinc-600">Produção</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-amber-400">+{fmtMoney(dirtyPerH)}/h</p>
              </div>
            </Tip>
            <Tip tip="Lavagem passiva por hora das empresas de fachada (sem taxa)." block>
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-zinc-600">Lavagem</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-emerald-400">+{fmtMoney(launderPerH)}/h</p>
              </div>
            </Tip>
            <Tip tip={`Fecho semanal ${fmtMoney(weeklyFixed)}: salários ${fmtMoney(weeklyBreakdown.gross_salaries || 0)}, TSU ${fmtMoney(weeklyBreakdown.employer_social_security || 0)}, frota ${fmtMoney(weeklyBreakdown.fleet_fixed || 0)} e imóveis ${fmtMoney(weeklyBreakdown.property_fixed || 0)}. O valor /h abaixo é apenas equivalente analítico.`} block>
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-zinc-600">Fixos</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-red-400">-{fmtMoney(fixedPerH)}/h</p>
              </div>
            </Tip>
          </div>
          <Tip tip={`Balanço económico equivalente por hora (produção + lavagem - custos fixos semanais/168h). A cobrança fixa real só acontece à segunda-feira às 20:00 e não inclui combustível, reparações nem recompensas de operações.${heatPerH > 0 ? ` Os laboratórios também geram +${heatPerH.toFixed(1)} calor/h.` : ""}`} block>
            <p className="mt-2 flex items-center gap-1 border-t border-white/10 pt-1.5 font-mono text-[10px]">
              {netPerH >= 0 ? <TrendingUp size={10} className="text-emerald-400" /> : <TrendingDown size={10} className="text-red-400" />}
              <span className="uppercase tracking-wider text-zinc-500">Balanço:</span>
              <span className="font-bold" style={{ color: netPerH >= 0 ? "#34D399" : "#EF4444" }}>
                {netPerH >= 0 ? "+" : ""}{fmtMoney(netPerH)}/h
              </span>
            </p>
          </Tip>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-zinc-500">
            <Tip tip="Tempo até ao próximo fecho fixo semanal, sempre à segunda-feira às 20:00 (hora de Portugal).">
              <span className="flex items-center gap-1">
                <Clock size={9} /> Próx. fecho: <span className="text-zinc-300">{payrollS != null ? fmtDuration(payrollS) : "—"}</span>
              </span>
            </Tip>
            <Tip tip={runwayHours != null ? "Autonomia estimada usando o equivalente horário dos custos fixos semanais contra a lavagem passiva, sem contar recompensas de operações." : "A lavagem passiva já cobre o equivalente horário dos custos fixos semanais."}>
              <span className="flex items-center gap-1">
                Autonomia:{" "}
                <span className={runwayHours != null && runwayHours < 24 ? "text-red-400" : "text-zinc-300"}>
                  {runwayHours != null ? fmtDuration(runwayHours * 3600) : "estável"}
                </span>
              </span>
            </Tip>
          </div>
        </Card>

        <div className="mt-6">
          <SectionHeader icon={MapPin} title="Quartel-general" />
          <Card className="lus-card p-3 shadow-none">
            <p className="text-sm font-semibold text-white">{p.hq.name}</p>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-500">Cais do Sodré, Lisboa</p>
          </Card>
        </div>


        <div className="mt-6">
          <SectionHeader icon={Banknote} title="Lavagem de dinheiro" />
          <Card className="lus-card p-3 shadow-none">
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-zinc-500">Converte dinheiro sujo em limpo. Retorno base de 78% (22% de fricção), melhorável até 90%.</p>
              {state.caps?.dirty_money?.max > 0 && (
                <Tip tip={`Capacidade do cofre de dinheiro sujo: ${fmtMoney(p.dirty_money)} de ${fmtMoney(state.caps.dirty_money.max)}. Produção dos laboratórios acima deste limite é desperdiçada — sobe de nível para aumentar, ou lava regularmente.`} align="end">
                  <span
                    data-testid="dirty-cap-indicator"
                    className="shrink-0 font-mono text-[10px]"
                    style={{ color: p.dirty_money >= state.caps.dirty_money.max * 0.9 ? "#EF4444" : "#71717A" }}
                  >
                    cofre {Math.round((p.dirty_money / state.caps.dirty_money.max) * 100)}%
                  </span>
                </Tip>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                data-testid="launder-amount-input"
                type="number"
                min="1"
                placeholder="Montante"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-white/10 bg-white/5 font-mono text-white placeholder:text-zinc-600"
              />
              <Button
                data-testid="launder-submit-button"
                onClick={handleLaunder}
                disabled={!amount || parseInt(amount, 10) > p.dirty_money}
                variant="outline"
                className={`shrink-0 text-xs font-bold uppercase ${
                  !amount || parseInt(amount, 10) > p.dirty_money
                    ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                Lavar
              </Button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[0.25, 0.5, 1].map((f) => (
                <Button
                  key={f}
                  variant="outline" size="sm"
                  data-testid={`launder-quick-${f * 100}`}
                  onClick={() => setAmount(String(Math.floor(p.dirty_money * f)))}
                  disabled={p.dirty_money <= 0}
                  className={`h-auto px-2 py-1 font-mono text-[10px] ${
                    p.dirty_money <= 0
                      ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                      : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {f === 1 ? "MAX" : `${f * 100}%`}
                </Button>
              ))}
            </div>
            {amount && parseInt(amount, 10) > 0 && (
              <p className="mt-2 font-mono text-[11px] text-emerald-400">
                Recebes pelo menos {fmtMoney(Math.floor(parseInt(amount, 10) * baseLaunderRate))} limpos na taxa base
              </p>
            )}
          </Card>
        </div>

        <div className="mt-6">
          <SectionHeader icon={Siren} title="Polícia" meta={`${Math.round(p.heat)}%`} />
          <Card className="lus-card p-3 shadow-none">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <Tip tip={hs.desc}>
                <span>Calor policial · <span style={{ color: hs.color }}>{hs.label}</span></span>
              </Tip>
              <span>{Math.round(p.heat)}%</span>
            </div>
            <MiniBar value={p.heat} color={hs.color} className="mt-1.5" height="h-1.5" />
            <div className="mt-1.5 flex justify-between font-mono text-[9px] text-zinc-600">
              <Tip tip="Aos 70% há risco de rusgas aos laboratórios."><span className={p.heat >= 70 ? "text-orange-400" : ""}>70% rusgas</span></Tip>
              <Tip tip="Aos 90% todas as operações ficam bloqueadas até o calor baixar."><span className={p.heat >= 90 ? "text-red-500" : ""}>90% bloqueio</span></Tip>
            </div>
            {p.heat >= 90 && (
              <p className="mt-1.5 font-mono text-[10px] text-red-500">Alerta máximo: operações bloqueadas</p>
            )}
            <Tip tip={`Suborno: paga ${fmtMoney(Math.max(1000, Math.round(p.heat * 150)))} limpos para reduzir o calor em 40 pontos. O custo sobe com o calor atual.`} block>
              <Button
                data-testid="bribe-police-button"
                onClick={bribePolice}
                disabled={p.heat < 10 || p.clean_money < Math.max(1000, Math.round(p.heat * 150))}
                size="sm"
                variant="outline"
                className={`mt-2 w-full text-[10px] font-bold uppercase tracking-wider ${
                  p.heat < 10 || p.clean_money < Math.max(1000, Math.round(p.heat * 150))
                    ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                Subornar polícia · {fmtMoney(Math.max(1000, Math.round(p.heat * 150)))} (-40 calor)
              </Button>
            </Tip>
          </Card>
        </div>

        <div className="mt-6 pb-2">
          <button
            data-testid="ledger-toggle"
            onClick={() => setShowLedger(!showLedger)}
            className="flex w-full items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:text-white"
          >
            <span className="flex items-center gap-1.5"><History size={12} className="text-red-500/90" /> Extrato</span>
            <span className="h-px min-w-3 flex-1 bg-gradient-to-r from-white/[0.14] via-white/[0.06] to-transparent" aria-hidden="true" />
            <ChevronDown size={13} className={`transition-transform ${showLedger ? "rotate-180" : ""}`} />
          </button>
          {showLedger && (
            <div className="mt-2" data-testid="ledger-list">
              {transactions.length === 0 ? (
                <p className="font-mono text-[10px] text-zinc-600">Livro-razão em branco — o primeiro golpe ainda está por escrever.</p>
              ) : (
                <Table>
                  <TableBody>
                    {transactions.map((t) => (
                      <TableRow key={t.id} className="border-white/10 hover:bg-white/[0.03]">
                        <TableCell className="min-w-0 p-1.5">
                          <p className="truncate font-mono text-[10px] text-zinc-300">{t.note || TX_LABELS[t.kind] || t.kind}</p>
                          <p className="font-mono text-[9px] text-zinc-600">{new Date(t.ts).toLocaleString("pt-PT")}</p>
                        </TableCell>
                        <TableCell className="p-1.5 text-right">
                          <span
                            className="shrink-0 font-mono text-[10px] font-bold"
                            style={{ color: t.amount >= 0 ? "#34D399" : "#EF4444" }}
                          >
                            {t.amount >= 0 ? "+" : ""}{fmtMoney(t.amount)} {t.currency === "dirty" ? "sujos" : "limpos"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const StatBox = ({ label, value, accent = "#FFFFFF", tip }) => (
  <Tip tip={tip} block>
    <Card className="h-full lus-card p-3 shadow-none">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate font-mono text-lg font-bold leading-tight" style={{ color: accent }}>{value}</p>
    </Card>
  </Tip>
);
