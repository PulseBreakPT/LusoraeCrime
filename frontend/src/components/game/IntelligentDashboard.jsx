import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { fmtMoney } from "../../lib/game";
import { Card } from "../ui/card";
import { AlertDescription } from "../ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import {
  Brain, Building2, Truck, Users, Users2, TrendingUp, AlertTriangle,
  RefreshCw, Zap, Target, Lightbulb, Swords,
} from "lucide-react";

const STATUS_COLORS = {
  healthy: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
  optimal: "text-cyan-400",
};

// Painel modal full-screen com análise acionável de 5 módulos (Imóveis, Frota,
// RH, Equipas, Armamento) — busca /analysis/comprehensive sob pedido (não faz
// parte do polling regular de /game/state), reaproveitando sempre os mesmos
// custos/fórmulas dos endpoints de compra/reparação reais.
export const IntelligentDashboard = ({ open, onOpenChange }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/game/analysis/comprehensive");
      setAnalysis(data);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Falha ao carregar análise");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  if (!analysis) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Card className="border-white/10 bg-background/95 p-6 backdrop-blur-xl">
          {loading ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="animate-spin text-cyan-400" size={16} />
              <span className="text-sm text-white">A carregar análise inteligente...</span>
            </div>
          ) : error ? (
            <div className="space-y-3">
              <AlertDescription className="text-sm text-red-400">{error}</AlertDescription>
              <Button onClick={loadAnalysis} size="sm" variant="outline" className="w-full border-white/10">
                Tentar novamente
              </Button>
            </div>
          ) : (
            <span className="text-sm text-white">A preparar análise...</span>
          )}
        </Card>
      </div>
    );
  }

  const eff = analysis.overall_efficiency || {};

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-4">
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-background/95 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex items-center gap-2.5">
            <Brain className="text-cyan-400" size={20} />
            <h1 className="text-sm font-bold text-white sm:text-lg">IA Inteligente — Análise Completa</h1>
          </div>
          <Button data-testid="intel-dashboard-close" onClick={() => onOpenChange(false)} variant="outline" size="sm" className="border-white/10">
            Fechar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 border-b border-white/10 bg-transparent p-0 sm:grid-cols-6">
            <TabsTrigger value="overview" className="font-mono text-[10px] data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">Visão Geral</TabsTrigger>
            <TabsTrigger value="properties" className="font-mono text-[10px] data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">Imóveis</TabsTrigger>
            <TabsTrigger value="fleet" className="font-mono text-[10px] data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">Frota</TabsTrigger>
            <TabsTrigger value="weapons" className="font-mono text-[10px] data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">Armamento</TabsTrigger>
            <TabsTrigger value="hr" className="font-mono text-[10px] data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">RH</TabsTrigger>
            <TabsTrigger value="teams" className="font-mono text-[10px] data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">Equipas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Eficiência Global</h3>
                </div>
                <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Upgrades de imóveis pendentes:</span>
                    <span className={eff.property_upgrades_pending > 0 ? STATUS_COLORS.warning : STATUS_COLORS.healthy}>
                      {eff.property_upgrades_pending ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Condição da frota:</span>
                    <span className={eff.fleet_condition_avg > 70 ? STATUS_COLORS.healthy : STATUS_COLORS.warning}>
                      {eff.fleet_condition_avg ?? "—"}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Condição do armamento:</span>
                    <span className={eff.weapons_condition_avg > 70 ? STATUS_COLORS.healthy : STATUS_COLORS.warning}>
                      {eff.weapons_condition_avg ?? "—"}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Armamento equipado:</span>
                    <span className={eff.weapons_equip_rate_pct > 70 ? STATUS_COLORS.healthy : STATUS_COLORS.warning}>
                      {eff.weapons_equip_rate_pct ?? "—"}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Moral média da equipa:</span>
                    <span className={eff.staff_morale_avg > 60 ? STATUS_COLORS.healthy : STATUS_COLORS.warning}>
                      {eff.staff_morale_avg ?? "—"}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Equipas ociosas:</span>
                    <span className={eff.teams_idle_pct < 30 ? STATUS_COLORS.optimal : STATUS_COLORS.warning}>
                      {eff.teams_idle_pct ?? "—"}%
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="border-amber-500/30 bg-amber-500/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Lightbulb size={14} className="text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Recomendações Urgentes</h3>
                </div>
                <div className="space-y-1 text-[10px]">
                  {analysis.properties?.upgrade_recommendations?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="shrink-0 text-amber-400" />
                      <span className="text-amber-400">{analysis.properties.upgrade_recommendations.length} imóvel(is) com upgrade compensador</span>
                    </div>
                  )}
                  {analysis.fleet?.maintenance_recommendations?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="shrink-0 text-amber-400" />
                      <span className="text-amber-400">{analysis.fleet.maintenance_recommendations.length} veículo(s) a precisar de reparação</span>
                    </div>
                  )}
                  {analysis.weapons?.repair_recommendations?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="shrink-0 text-amber-400" />
                      <span className="text-amber-400">{analysis.weapons.repair_recommendations.length} arma(s) a precisar de reparação</span>
                    </div>
                  )}
                  {analysis.hr?.hr_summary?.at_risk_count > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="shrink-0 text-amber-400" />
                      <span className="text-amber-400">{analysis.hr.hr_summary.at_risk_count} operacional(is) em risco</span>
                    </div>
                  )}
                  {analysis.teams?.composition_recommendations?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="shrink-0 text-amber-400" />
                      <span className="text-amber-400">{analysis.teams.composition_recommendations.length} equipa(s) incompleta(s)</span>
                    </div>
                  )}
                  {!analysis.properties?.upgrade_recommendations?.length && !analysis.fleet?.maintenance_recommendations?.length &&
                    !analysis.weapons?.repair_recommendations?.length && !analysis.hr?.hr_summary?.at_risk_count &&
                    !analysis.teams?.composition_recommendations?.length && (
                    <span className="text-emerald-400">Tudo em ordem — sem recomendações urgentes.</span>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              <Card className="border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-[9px] uppercase text-zinc-500">Imóveis</p>
                <p className="mt-1 text-lg font-bold text-white">{analysis.properties?.properties_summary?.total}</p>
                <p className="text-[9px] text-zinc-600">Nível {analysis.properties?.properties_summary?.total_level}</p>
              </Card>
              <Card className="border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-[9px] uppercase text-zinc-500">Frota</p>
                <p className="mt-1 text-lg font-bold text-white">{analysis.fleet?.fleet_summary?.total_vehicles}</p>
                <p className="text-[9px] text-zinc-600">{analysis.fleet?.fleet_summary?.avg_condition}% condição</p>
              </Card>
              <Card className="border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-[9px] uppercase text-zinc-500">Armamento</p>
                <p className="mt-1 text-lg font-bold text-white">{analysis.weapons?.weapons_summary?.total}</p>
                <p className="text-[9px] text-zinc-600">{analysis.weapons?.weapons_summary?.equipped} equipadas</p>
              </Card>
              <Card className="border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-[9px] uppercase text-zinc-500">RH</p>
                <p className="mt-1 text-lg font-bold text-white">{analysis.hr?.hr_summary?.total_employees}</p>
                <p className="text-[9px] text-zinc-600">{fmtMoney(analysis.hr?.hr_summary?.total_payroll_per_cycle)}/ciclo</p>
              </Card>
              <Card className="border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-[9px] uppercase text-zinc-500">Equipas</p>
                <p className="mt-1 text-lg font-bold text-white">{analysis.teams?.teams_summary?.total_teams}</p>
                <p className="text-[9px] text-zinc-600">{analysis.teams?.teams_summary?.teams_idle} ociosas</p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="properties" className="space-y-3"><PropertiesAnalysisPanel analysis={analysis.properties} /></TabsContent>
          <TabsContent value="fleet" className="space-y-3"><FleetAnalysisPanel analysis={analysis.fleet} /></TabsContent>
          <TabsContent value="weapons" className="space-y-3"><WeaponsAnalysisPanel analysis={analysis.weapons} /></TabsContent>
          <TabsContent value="hr" className="space-y-3"><HRAnalysisPanel analysis={analysis.hr} /></TabsContent>
          <TabsContent value="teams" className="space-y-3"><TeamsAnalysisPanel analysis={analysis.teams} /></TabsContent>
        </Tabs>

        <Button
          data-testid="intel-dashboard-refresh"
          onClick={loadAnalysis}
          disabled={loading}
          variant="outline"
          className="w-full gap-1.5 border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar Análise
        </Button>
      </div>
    </div>
  );
};

function PropertiesAnalysisPanel({ analysis }) {
  if (!analysis) return null;
  return (
    <div className="space-y-3">
      {analysis.upgrade_recommendations?.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-400"><Target size={14} /> Upgrades Recomendados</h3>
          {analysis.upgrade_recommendations.slice(0, 5).map((rec) => (
            <div key={rec.property_id} className="mb-1.5 flex items-center justify-between rounded border border-amber-500/20 bg-black/40 p-2 text-[10px]">
              <span className="truncate text-white">{rec.property_name}</span>
              <span className="shrink-0 text-amber-400">{fmtMoney(rec.upgrade_cost)}</span>
              <span className="shrink-0 text-zinc-500">ROI: {rec.roi_months}m</span>
            </div>
          ))}
        </Card>
      )}
      {analysis.expand_recommendations?.length > 0 && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-400"><Zap size={14} /> Novos Imóveis</h3>
          {analysis.expand_recommendations.slice(0, 5).map((rec) => (
            <div key={rec.type_key} className="mb-1.5 flex items-center justify-between rounded border border-cyan-500/20 bg-black/40 p-2 text-[10px]">
              <span className={`truncate ${rec.is_locked ? "text-zinc-500" : "text-white"}`}>{rec.type_name}{rec.is_locked ? " (bloqueado)" : ""}</span>
              <span className="shrink-0 text-cyan-400">{fmtMoney(rec.price)}</span>
            </div>
          ))}
        </Card>
      )}
      <Card className="border-white/10 bg-white/[0.03] p-3 text-[10px] text-zinc-500">
        <p>Condição média: <span className="text-white">{analysis.properties_summary?.avg_condition}%</span></p>
        <p>Manutenção diária: <span className="text-white">{fmtMoney(analysis.properties_summary?.total_daily_maintenance)}</span></p>
      </Card>
    </div>
  );
}

function FleetAnalysisPanel({ analysis }) {
  if (!analysis) return null;
  return (
    <div className="space-y-3">
      {analysis.maintenance_recommendations?.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-400"><AlertTriangle size={14} /> Manutenção Urgente</h3>
          {analysis.maintenance_recommendations.slice(0, 5).map((rec) => (
            <div key={rec.vehicle_id} className="mb-1.5 flex items-center justify-between rounded border border-red-500/20 bg-black/40 p-2 text-[10px]">
              <span className="truncate text-white">{rec.vehicle_name}</span>
              <span className="shrink-0 text-red-400">{rec.current_condition}%</span>
              <span className="shrink-0 text-zinc-500">{fmtMoney(rec.repair_cost)}</span>
            </div>
          ))}
        </Card>
      )}
      {analysis.fuel_recommendations?.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-400"><Zap size={14} /> Abastecimento</h3>
          {analysis.fuel_recommendations.slice(0, 5).map((rec) => (
            <div key={rec.vehicle_id} className="mb-1.5 flex items-center justify-between rounded border border-amber-500/20 bg-black/40 p-2 text-[10px]">
              <span className="truncate text-white">{rec.vehicle_name}</span>
              <span className="shrink-0 text-amber-400">{rec.fuel_percentage}%</span>
              <span className="shrink-0 text-zinc-500">{fmtMoney(rec.refuel_cost)}</span>
            </div>
          ))}
        </Card>
      )}
      {analysis.next_vehicle_recommendation && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-1.5 text-sm font-bold text-cyan-400">Próximo Veículo Recomendado</h3>
          <p className="text-white">{analysis.next_vehicle_recommendation.name}</p>
          <p className="text-[10px] text-zinc-500">{fmtMoney(analysis.next_vehicle_recommendation.price)}</p>
        </Card>
      )}
    </div>
  );
}

function WeaponsAnalysisPanel({ analysis }) {
  if (!analysis) return null;
  return (
    <div className="space-y-3">
      {analysis.repair_recommendations?.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-400"><AlertTriangle size={14} /> Reparação Urgente</h3>
          {analysis.repair_recommendations.slice(0, 5).map((rec) => (
            <div key={rec.weapon_id} className="mb-1.5 flex items-center justify-between rounded border border-red-500/20 bg-black/40 p-2 text-[10px]">
              <span className="truncate text-white">{rec.weapon_name}</span>
              <span className="shrink-0 text-red-400">{rec.current_condition}%</span>
              <span className="shrink-0 text-zinc-500">{fmtMoney(rec.repair_cost)}</span>
            </div>
          ))}
        </Card>
      )}
      {analysis.unequipped_weapons?.length > 0 && analysis.idle_employees_without_weapon?.length > 0 && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-400"><Swords size={14} /> Armas no inventário sem operacional</h3>
          <p className="text-[10px] text-zinc-400">
            {analysis.unequipped_weapons.length} arma(s) por atribuir e {analysis.idle_employees_without_weapon.length} operacional(is) disponível(is) sem equipamento — usa a atribuição automática no Armamento.
          </p>
        </Card>
      )}
      {analysis.category_coverage?.some((c) => c.gap > 0) && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 text-sm font-bold text-amber-400">Cobertura por Categoria</h3>
          {analysis.category_coverage.filter((c) => c.gap > 0).slice(0, 5).map((c) => (
            <div key={c.category} className="mb-1 flex justify-between text-[10px]">
              <span className="text-white">{c.category_name}</span>
              <span className="text-amber-400">{c.weapons_equipped}/{c.employees_in_spec} equipadas</span>
            </div>
          ))}
        </Card>
      )}
      {analysis.next_weapon_recommendation && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-1.5 text-sm font-bold text-cyan-400">Próxima Arma Recomendada</h3>
          <p className="text-white">{analysis.next_weapon_recommendation.name}</p>
          <p className="text-[10px] text-zinc-500">{fmtMoney(analysis.next_weapon_recommendation.price)}</p>
        </Card>
      )}
    </div>
  );
}

function HRAnalysisPanel({ analysis }) {
  if (!analysis) return null;
  return (
    <div className="space-y-3">
      <Card className="border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-sm font-bold text-white">Resumo RH</h3>
        <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
          <div>
            <p className="text-zinc-500">Nível Médio</p>
            <p className="text-lg font-bold text-white">{analysis.hr_summary?.avg_level}</p>
          </div>
          <div>
            <p className="text-zinc-500">Fadiga Média</p>
            <p className="text-lg font-bold text-amber-400">{analysis.hr_summary?.avg_fatigue}%</p>
          </div>
          <div>
            <p className="text-zinc-500">Moral Média</p>
            <p className="text-lg font-bold text-emerald-400">{analysis.hr_summary?.avg_morale}%</p>
          </div>
          <div>
            <p className="text-zinc-500">De Alto Valor</p>
            <p className="text-lg font-bold text-cyan-400">{analysis.hr_summary?.high_value_count}</p>
          </div>
        </div>
      </Card>

      {analysis.training_recommendations?.length > 0 && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-400"><Lightbulb size={14} /> Formações Recomendadas</h3>
          {analysis.training_recommendations.slice(0, 5).map((rec) => (
            <div key={rec.employee_id} className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="truncate text-white">{rec.employee_name}</span>
              <span className="shrink-0 text-cyan-400">{rec.course_name}</span>
            </div>
          ))}
        </Card>
      )}

      {analysis.recruitment_needs?.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 text-sm font-bold text-amber-400">Recrutamento Necessário</h3>
          {analysis.recruitment_needs.map((need) => (
            <div key={need.spec} className="mb-1 flex justify-between text-[10px]">
              <span className="text-white">{need.spec_name}</span>
              <span className="text-amber-400">+{need.needed}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function TeamsAnalysisPanel({ analysis }) {
  if (!analysis) return null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Object.entries(analysis.teams_summary?.teams_by_spec || {}).map(([spec, count]) => (
          <Card key={spec} className="border-white/10 bg-white/[0.03] p-3">
            <p className="font-mono text-[9px] uppercase text-zinc-500">{spec}</p>
            <p className="mt-1 text-xl font-bold text-white">{count}</p>
            <p className="text-[9px] text-zinc-600">equipas</p>
          </Card>
        ))}
      </div>

      {analysis.composition_recommendations?.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-400"><Users size={14} /> Equipas Incompletas</h3>
          {analysis.composition_recommendations.slice(0, 5).map((rec) => (
            <div key={rec.team_id} className="mb-1.5 flex items-center justify-between rounded border border-amber-500/20 bg-black/40 p-2 text-[10px]">
              <span className="truncate text-white">{rec.team_name}</span>
              <span className="shrink-0 text-amber-400">{rec.current_size}/{rec.recommended_roles ? rec.current_size + rec.recommended_roles.length : "?"}</span>
            </div>
          ))}
        </Card>
      )}

      {analysis.specialization_balance?.length > 0 && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-2 text-sm font-bold text-cyan-400">Equilíbrio por Especialização</h3>
          {analysis.specialization_balance.map((bal) => (
            <div key={bal.spec} className="mb-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-white">{bal.spec}</span>
                <span className="text-cyan-400">{bal.teams} equipa(s) / {bal.active_opportunities} oportunidade(s)</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-black/40">
                <div
                  className={`h-full rounded ${bal.balance_status === "overextended" ? "bg-red-500" : bal.balance_status === "balanced" ? "bg-emerald-500" : "bg-zinc-600"}`}
                  style={{ width: `${Math.min(100, bal.avg_opp_per_team * 25)}%` }}
                />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
