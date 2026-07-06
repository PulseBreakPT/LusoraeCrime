import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, fmtDuration } from "../../lib/game";
import { Tip } from "./hud";
import { Card } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import {
  Brain, Building2, Truck, Users, Users2, TrendingUp, AlertTriangle, CheckCircle,
  RefreshCw, Zap, BarChart3, Target, Shield, Lightbulb
} from "lucide-react";

const ICONS = {
  properties: <Building2 size={16} />,
  fleet: <Truck size={16} />,
  hr: <Users size={16} />,
  teams: <Users2 size={16} />,
};

const STATUS_COLORS = {
  healthy: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
  optimal: "text-cyan-400",
};

export const IntelligentDashboard = ({ open, onOpenChange }) => {
  const { state } = useGame();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    loadAnalysis();
  }, [open]);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/game/analysis/comprehensive");
      if (!response.ok) throw new Error("Falha ao carregar análise");
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!state || !analysis) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <Card className="border-white/10 bg-background/95 p-6 backdrop-blur-xl">
          {loading ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="animate-spin" />
              <span className="text-white">Carregando análise inteligente...</span>
            </div>
          ) : error ? (
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          ) : (
            <span className="text-white">Selecione um módulo para ver análise</span>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-background/95 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Brain className="text-cyan-400" size={24} />
            <h1 className="text-xl font-bold text-white">IA Inteligente — Análise Completa</h1>
          </div>
          <Button onClick={() => onOpenChange(false)} variant="outline" className="border-white/10">
            Fechar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 border-b border-white/10 bg-transparent">
            <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="properties" className="data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">
              Imóveis
            </TabsTrigger>
            <TabsTrigger value="fleet" className="data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">
              Frota
            </TabsTrigger>
            <TabsTrigger value="hr" className="data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">
              RH
            </TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:border-b-2 data-[state=active]:border-cyan-400">
              Equipas
            </TabsTrigger>
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-cyan-400" />
                  <h3 className="font-bold text-white text-sm">Eficiência Global</h3>
                </div>
                <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">ROI Imóveis:</span>
                    <span className={analysis.overall_efficiency.property_roi_avg_months < 12 ? STATUS_COLORS.optimal : STATUS_COLORS.warning}>
                      ~{analysis.overall_efficiency.property_roi_avg_months} meses
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Condição Frota:</span>
                    <span className={analysis.overall_efficiency.fleet_condition_avg > 70 ? STATUS_COLORS.healthy : STATUS_COLORS.warning}>
                      {analysis.overall_efficiency.fleet_condition_avg}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Saúde RH:</span>
                    <span className={analysis.overall_efficiency.staff_health_avg > 80 ? STATUS_COLORS.healthy : STATUS_COLORS.warning}>
                      {analysis.overall_efficiency.staff_health_avg}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Utilização Equipas:</span>
                    <span className={analysis.overall_efficiency.teams_utilization_pct > 50 ? STATUS_COLORS.optimal : STATUS_COLORS.warning}>
                      {analysis.overall_efficiency.teams_utilization_pct}%
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={14} className="text-amber-400" />
                  <h3 className="font-bold text-white text-sm">Recomendações Urgentes</h3>
                </div>
                <div className="space-y-1 text-[10px]">
                  {analysis.properties?.upgrade_recommendations?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="text-amber-400" />
                      <span className="text-amber-400">{analysis.properties.upgrade_recommendations.length} imóvel(is) para upgrade</span>
                    </div>
                  )}
                  {analysis.fleet?.maintenance_recommendations?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="text-amber-400" />
                      <span className="text-amber-400">{analysis.fleet.maintenance_recommendations.length} veículo(s) para reparação</span>
                    </div>
                  )}
                  {analysis.hr?.hr_summary?.at_risk_count > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="text-amber-400" />
                      <span className="text-amber-400">{analysis.hr.hr_summary.at_risk_count} funcionário(s) em risco</span>
                    </div>
                  )}
                  {analysis.teams?.composition_recommendations?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="text-amber-400" />
                      <span className="text-amber-400">{analysis.teams.composition_recommendations.length} equipa(s) incompleta(s)</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-[10px] text-zinc-500">Imóveis</p>
                <p className="mt-1 text-lg font-bold text-white">{analysis.properties?.properties_summary?.total}</p>
                <p className="text-[9px] text-zinc-600">Nível {analysis.properties?.properties_summary?.total_level}</p>
              </Card>
              <Card className="border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-[10px] text-zinc-500">Frota</p>
                <p className="mt-1 text-lg font-bold text-white">{analysis.fleet?.fleet_summary?.total_vehicles}</p>
                <p className="text-[9px] text-zinc-600">{analysis.fleet?.fleet_summary?.total_condition_avg?.toFixed(0)}% condição</p>
              </Card>
              <Card className="border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-[10px] text-zinc-500">RH</p>
                <p className="mt-1 text-lg font-bold text-white">{analysis.hr?.hr_summary?.total_employees}</p>
                <p className="text-[9px] text-zinc-600">{fmtMoney(analysis.hr?.hr_summary?.total_payroll_monthly)}/mês</p>
              </Card>
              <Card className="border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-[10px] text-zinc-500">Equipas</p>
                <p className="mt-1 text-lg font-bold text-white">{analysis.teams?.teams_summary?.total_teams}</p>
                <p className="text-[9px] text-zinc-600">{analysis.teams?.teams_summary?.teams_idle} ociosas</p>
              </Card>
            </div>
          </TabsContent>

          {/* Imóveis */}
          <TabsContent value="properties" className="space-y-4">
            <PropertyAnalysisPanel analysis={analysis.properties} />
          </TabsContent>

          {/* Frota */}
          <TabsContent value="fleet" className="space-y-4">
            <FleetAnalysisPanel analysis={analysis.fleet} />
          </TabsContent>

          {/* RH */}
          <TabsContent value="hr" className="space-y-4">
            <HRAnalysisPanel analysis={analysis.hr} />
          </TabsContent>

          {/* Equipas */}
          <TabsContent value="teams" className="space-y-4">
            <TeamsAnalysisPanel analysis={analysis.teams} />
          </TabsContent>
        </Tabs>

        <Button onClick={loadAnalysis} className="w-full border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20" variant="outline">
          <RefreshCw size={14} /> Atualizar Análise
        </Button>
      </div>
    </div>
  );
};

function PropertyAnalysisPanel({ analysis }) {
  return (
    <div className="space-y-3">
      {analysis?.upgrade_recommendations && analysis.upgrade_recommendations.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-400">
            <Target size={14} /> Upgrades Recomendados
          </h3>
          {analysis.upgrade_recommendations.slice(0, 3).map((rec) => (
            <div key={rec.property_id} className="mb-2 flex items-center justify-between rounded border border-amber-500/20 bg-black/40 p-2 text-[10px]">
              <span className="text-white">{rec.property_name}</span>
              <span className="text-amber-400">{fmtMoney(rec.upgrade_cost)}</span>
              <span className="text-zinc-500">ROI: {rec.roi_months}mo</span>
            </div>
          ))}
        </Card>
      )}

      {analysis?.expand_recommendations && analysis.expand_recommendations.length > 0 && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-cyan-400">
            <Zap size={14} /> Novos Imóveis
          </h3>
          {analysis.expand_recommendations.slice(0, 3).map((rec) => (
            <div key={rec.type_key} className="mb-2 flex items-center justify-between rounded border border-cyan-500/20 bg-black/40 p-2 text-[10px]">
              <span className="text-white">{rec.type_name}</span>
              <span className="text-cyan-400">{fmtMoney(rec.price)}</span>
              <span className="text-zinc-500">{(rec.efficiency_score * 100).toFixed(1)}% eff</span>
            </div>
          ))}
        </Card>
      )}

      {analysis?.property_analysis && (
        <div className="text-[10px] text-zinc-500">
          <p>Condição média: <span className="text-white">{analysis.properties_summary?.total_condition.toFixed(0)}%</span></p>
          <p>Custo mensal: <span className="text-white">{fmtMoney(analysis.properties_summary?.total_monthly_cost)}</span></p>
        </div>
      )}
    </div>
  );
}

function FleetAnalysisPanel({ analysis }) {
  return (
    <div className="space-y-3">
      {analysis?.maintenance_recommendations && analysis.maintenance_recommendations.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-red-400">
            <AlertTriangle size={14} /> Manutenção Urgente
          </h3>
          {analysis.maintenance_recommendations.slice(0, 3).map((rec) => (
            <div key={rec.vehicle_id} className="mb-2 flex items-center justify-between rounded border border-red-500/20 bg-black/40 p-2 text-[10px]">
              <span className="text-white">{rec.vehicle_name}</span>
              <span className="text-red-400">{rec.current_condition}%</span>
              <span className="text-zinc-500">{fmtMoney(rec.repair_cost)}</span>
            </div>
          ))}
        </Card>
      )}

      {analysis?.fuel_recommendations && analysis.fuel_recommendations.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-400">
            <Zap size={14} /> Abastecimento
          </h3>
          {analysis.fuel_recommendations.slice(0, 3).map((rec) => (
            <div key={rec.vehicle_id} className="mb-2 flex items-center justify-between rounded border border-amber-500/20 bg-black/40 p-2 text-[10px]">
              <span className="text-white">{rec.vehicle_name}</span>
              <span className="text-amber-400">{rec.fuel_percentage}%</span>
              <span className="text-zinc-500">{fmtMoney(rec.fuel_cost)}</span>
            </div>
          ))}
        </Card>
      )}

      {analysis?.next_vehicle_recommendation && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-2 font-bold text-cyan-400">Próximo Veículo Recomendado</h3>
          <p className="text-white">{analysis.next_vehicle_recommendation.name}</p>
          <p className="text-[10px] text-zinc-500">{fmtMoney(analysis.next_vehicle_recommendation.price)}</p>
        </Card>
      )}
    </div>
  );
}

function HRAnalysisPanel({ analysis }) {
  return (
    <div className="space-y-3">
      <Card className="border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 font-bold text-white">Resumo RH</h3>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <p className="text-zinc-500">Nível Médio</p>
            <p className="text-lg font-bold text-white">{analysis.hr_summary?.avg_level}</p>
          </div>
          <div>
            <p className="text-zinc-500">Fadiga Média</p>
            <p className="text-lg font-bold text-yellow-400">{analysis.hr_summary?.avg_fatigue}%</p>
          </div>
          <div>
            <p className="text-zinc-500">Saúde Média</p>
            <p className="text-lg font-bold text-emerald-400">{analysis.hr_summary?.avg_health}%</p>
          </div>
          <div>
            <p className="text-zinc-500">De Alto Valor</p>
            <p className="text-lg font-bold text-cyan-400">{analysis.hr_summary?.high_value_count}</p>
          </div>
        </div>
      </Card>

      {analysis?.training_recommendations && analysis.training_recommendations.length > 0 && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-cyan-400">
            <Lightbulb size={14} /> Treinamentos Recomendados
          </h3>
          {analysis.training_recommendations.slice(0, 3).map((rec) => (
            <div key={rec.employee_id} className="mb-2 text-[10px]">
              <p className="text-white">{rec.employee_name}</p>
              <p className="text-cyan-400">{rec.course_name}</p>
            </div>
          ))}
        </Card>
      )}

      {analysis?.recruitment_needs && analysis.recruitment_needs.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 font-bold text-amber-400">Recrutamento Necessário</h3>
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
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(analysis.teams_summary?.teams_by_spec || {}).map(([spec, count]) => (
          <Card key={spec} className="border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] text-zinc-500 uppercase">{spec}</p>
            <p className="mt-1 text-xl font-bold text-white">{count}</p>
            <p className="text-[9px] text-zinc-600">equipas</p>
          </Card>
        ))}
      </div>

      {analysis?.composition_recommendations && analysis.composition_recommendations.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-400">
            <Users size={14} /> Equipas Incompletas
          </h3>
          {analysis.composition_recommendations.slice(0, 3).map((rec) => (
            <div key={rec.team_id} className="mb-2 flex items-center justify-between rounded border border-amber-500/20 bg-black/40 p-2 text-[10px]">
              <span className="text-white">{rec.team_name}</span>
              <span className="text-amber-400">{rec.current_size}/6</span>
            </div>
          ))}
        </Card>
      )}

      {analysis?.specialization_balance && (
        <Card className="border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="mb-2 font-bold text-cyan-400">Alinhamento com Oportunidades</h3>
          {analysis.specialization_balance.map((bal) => (
            <div key={bal.spec} className="mb-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-white">{bal.spec}</span>
                <span className="text-cyan-400">{bal.teams} equipas / {bal.opportunities} opps</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-black/40">
                <div
                  className={`h-full rounded ${bal.balance_status === "overextended" ? "bg-red-500" : bal.balance_status === "balanced" ? "bg-emerald-500" : "bg-zinc-600"}`}
                  style={{ width: `${Math.min(100, (bal.teams / max(1, bal.opportunities)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

const max = Math.max;
