import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney } from "../../lib/game";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Card } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Tip } from "./hud";
import {
  Brain, Zap, Users, TrendingUp, Sparkles, Target, AlertTriangle,
  CheckCircle, Circle, Shield, Crosshair, Cpu, DollarSign, Heart, Wind
} from "lucide-react";

const ATTR_ICONS = {
  forca: <Shield size={12} />,
  inteligencia: <Brain size={12} />,
  discricao: <Wind size={12} />,
  conducao: <Zap size={12} />,
  tiro: <Crosshair size={12} />,
  hack: <Cpu size={12} />,
  negociacao: <DollarSign size={12} />,
  sangue_frio: <Heart size={12} />,
  resistencia: <TrendingUp size={12} />,
};

const RARITY_COLORS = {
  comum: "text-zinc-500",
  raro: "text-cyan-400",
  elite: "text-purple-400",
  lendario: "text-amber-400",
};

const SPEC_ICONS = {
  assalto: <Crosshair size={14} />,
  logistica: <Users size={14} />,
  tecnica: <Cpu size={14} />,
  influencia: <DollarSign size={14} />,
};

export const TeamCreationModal = ({ open, onOpenChange, intelligence, recommendations }) => {
  const { state, createTeam } = useGame();
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [recommendedMembers, setRecommendedMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Atualizar especialização recomendada ao abrir
  useEffect(() => {
    if (open && intelligence?.recommendations?.length > 0) {
      setSelectedSpec(intelligence.recommendations[0].spec);
    }
  }, [open, intelligence]);

  // Carregar recomendações de membros quando mudar a especialização
  useEffect(() => {
    if (!selectedSpec || !open) return;
    loadRecommendedMembers();
  }, [selectedSpec, open]);

  const loadRecommendedMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/game/teams/recommend_members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: selectedSpec }),
      });
      if (!response.ok) throw new Error("Falha ao carregar recomendações");
      const data = await response.json();
      setRecommendedMembers(data.recommended_members || []);
    } catch (err) {
      setError(err.message);
      setRecommendedMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (memberId) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectTopFive = () => {
    setSelectedMembers(recommendedMembers.slice(0, 5).map((m) => m.id));
  };

  const handleCreateTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const teamResult = await createTeam(selectedSpec);
      if (!teamResult.ok) {
        setError(teamResult.message || "Erro ao criar equipa");
        setLoading(false);
        return;
      }

      // Se houver membros selecionados, atribuir à última equipa criada
      if (selectedMembers.length > 0) {
        // Obter a equipa recém-criada
        const teamsResponse = await fetch("/api/game/state");
        if (teamsResponse.ok) {
          const gameState = await teamsResponse.json();
          const latestTeam = gameState.state.teams[gameState.state.teams.length - 1];
          if (latestTeam) {
            const assignResponse = await fetch("/api/game/teams/assign_members_batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ team_id: latestTeam.id, employee_ids: selectedMembers }),
            });
            if (!assignResponse.ok) {
              const err = await assignResponse.json();
              console.warn("Aviso ao atribuir membros:", err);
              // Não bloquear se a atribuição falhar
            }
          }
        }
      }

      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const currentRec = intelligence?.recommendations?.find((r) => r.spec === selectedSpec);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Brain size={18} className="text-cyan-400" /> Formar Nova Equipa
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            IA inteligente recomenda qual especialização criar baseado em funcionários e oportunidades pendentes.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="border-red-600/40 bg-red-600/10">
            <AlertTriangle size={14} />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        {/* Recomendações Inteligentes */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Sparkles size={12} className="text-amber-400" /> Análise Inteligente
          </h3>
          <div className="grid gap-2">
            {intelligence?.recommendations?.map((rec, idx) => (
              <button
                key={rec.spec}
                onClick={() => setSelectedSpec(rec.spec)}
                className={`rounded-lg border p-3 text-left transition-all ${
                  selectedSpec === rec.spec
                    ? "border-cyan-500/50 bg-cyan-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    <div className="mt-0.5">{SPEC_ICONS[rec.spec]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{recommendations?.[rec.spec]?.name}</p>
                      <p className="text-[10px] text-zinc-500">{rec.description}</p>
                    </div>
                  </div>
                  <div className="ml-2 text-right">
                    <p className="flex items-center gap-1 font-mono text-xs font-bold">
                      <TrendingUp size={11} className="text-amber-400" />
                      <span className={idx === 0 ? "text-amber-400" : "text-zinc-400"}>
                        {rec.score.toFixed(1)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex gap-3 text-[10px] text-zinc-500">
                  <span>📋 {rec.opportunities} oportunidades</span>
                  <span>👥 {rec.best_fit_employees} funcionários ideais</span>
                  <span>🏢 {rec.teams_existing} equipas existentes</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Membros Recomendados */}
        {selectedSpec && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                <Users size={12} className="text-emerald-400" /> Membros Recomendados
              </h3>
              {recommendedMembers.length > 0 && (
                <button
                  onClick={selectTopFive}
                  className="rounded px-2 py-1 text-[10px] font-bold uppercase text-cyan-400 hover:bg-cyan-500/20"
                >
                  Selecionar Top 5
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-center font-mono text-[10px] text-zinc-500">Carregando recomendações...</p>
            ) : recommendedMembers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[10px] text-zinc-600">
                Sem funcionários disponíveis para esta especialização.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recommendedMembers.map((member, idx) => (
                  <div
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                      selectedMembers.includes(member.id)
                        ? "border-cyan-500/50 bg-cyan-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {selectedMembers.includes(member.id) ? (
                            <CheckCircle size={12} className="shrink-0 text-cyan-400" />
                          ) : (
                            <Circle size={12} className="shrink-0 text-zinc-600" />
                          )}
                          <span className={`text-xs font-bold ${RARITY_COLORS[member.rarity]}`}>
                            {member.name}
                          </span>
                          <span className="shrink-0 rounded bg-black/40 px-1 py-0.5 font-mono text-[9px] text-zinc-500">
                            {member.role}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {member.talents?.map((talent) => (
                            <span key={talent} className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[8px] text-amber-400">
                              ✨ {talent}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs font-bold text-cyan-400">{member.score.toFixed(0)}</p>
                        <p className="font-mono text-[9px] text-zinc-500">Score</p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[9px] text-zinc-500">
                      {Object.entries(member.attrs || {}).map(([attr, val]) => (
                        <Tip key={attr} tip={`${attr}: ${val}`} align="start">
                          <span className="flex items-center gap-0.5 cursor-help">
                            {ATTR_ICONS[attr]} {val}
                          </span>
                        </Tip>
                      ))}
                      <span>❤️ {member.health}%</span>
                      <span>😴 {member.fatigue}/100</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info de Custo */}
        {state && (
          <Card className="border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <span className="font-mono text-sm">Custo: {fmtMoney(state.catalog?.team_create_cost || 5000)}</span>
              </div>
              <span className="font-mono text-[10px]" style={{ color: state.player.clean_money < (state.catalog?.team_create_cost || 5000) ? "#EF4444" : "#34D399" }}>
                {fmtMoney(state.player.clean_money)}
              </span>
            </div>
          </Card>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="flex-1 border-white/10"
          >
            Cancelar
          </Button>
          <Tip
            tip={state && state.player.clean_money < (state.catalog?.team_create_cost || 5000)
              ? "Dinheiro limpo insuficiente"
              : selectedMembers.length > 0
              ? `Criar equipa com ${selectedMembers.length} membro(s) selecionado(s)`
              : "Criar equipa vazia"}
            block
            className="flex-1"
          >
            <Button
              onClick={handleCreateTeam}
              disabled={loading || (state && state.player.clean_money < (state.catalog?.team_create_cost || 5000))}
              className={`w-full ${
                state && state.player.clean_money >= (state.catalog?.team_create_cost || 5000)
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              <Zap size={14} /> Formar Equipa ({selectedMembers.length} membros)
            </Button>
          </Tip>
        </div>
      </DialogContent>
    </Dialog>
  );
};
