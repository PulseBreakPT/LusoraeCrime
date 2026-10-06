import { useMemo } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney } from "../../lib/game";
import { GAME_AREAS } from "../../game/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { PanelWatermark, SectionHeader } from "./hud";
import {
  Sparkles, Crosshair, Users, ArrowRight, LockKeyhole, Route, Target, Clock3,
} from "lucide-react";

const horizonLabel = {
  agora: "Agora",
  sessao: "Esta sessão",
  plano: "Próximo passo",
};

export const ForYouPanel = ({ open, onOpenChange, onNavigate, onSelectOpp }) => {
  const { state } = useGame();

  const suggestions = useMemo(() => {
    if (!state) return [];
    return (state.opportunities || [])
      .filter((opp) => opp.status === "active" && Number(opp.min_level || 1) <= Number(state.player?.level || 1))
      .sort((a, b) => Number(b.reward || 0) - Number(a.reward || 0))
      .slice(0, 4);
  }, [state]);

  if (!state) return null;

  const level = Number(state.player?.level || 1);
  const readyTeams = (state.teams || []).filter((team) => team.status === "idle").length;
  const activeOps = (state.opportunities || []).filter((opp) => opp.status === "taken").length;
  const moves = (state.retention?.next_moves || []).slice(0, 3);
  const futureAreas = GAME_AREAS
    .filter((area) => !area.hidden && Number(area.minLevel || 1) > level)
    .sort((a, b) => Number(a.minLevel) - Number(b.minLevel));
  const nextUnlockLevel = futureAreas[0]?.minLevel || null;
  const nextUnlocks = nextUnlockLevel
    ? futureAreas.filter((area) => Number(area.minLevel) === Number(nextUnlockLevel)).slice(0, 4)
    : [];

  const closeAndNavigate = (panel, opts) => {
    onOpenChange(false);
    onNavigate?.(panel, opts);
  };

  const selectOpportunity = (opp) => {
    onOpenChange(false);
    onSelectOpp?.(opp);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel w-full overflow-y-auto sm:max-w-xl" data-testid="for-you-panel">
        <SheetHeader>
          <PanelWatermark icon={Sparkles} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <Sparkles size={18} className="text-cyan-300" /> Para ti
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            O que merece a tua atenção agora, sem percorrer menus.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Card className="sub-card p-3 text-center shadow-none">
            <Users size={13} className="mx-auto text-cyan-300" />
            <p className="mt-1 text-lg font-bold text-white">{readyTeams}</p>
            <p className="font-mono text-[9px] uppercase text-zinc-600">equipas prontas</p>
          </Card>
          <Card className="sub-card p-3 text-center shadow-none">
            <Route size={13} className="mx-auto text-red-300" />
            <p className="mt-1 text-lg font-bold text-white">{activeOps}</p>
            <p className="font-mono text-[9px] uppercase text-zinc-600">em curso</p>
          </Card>
          <Card className="sub-card p-3 text-center shadow-none">
            <Crosshair size={13} className="mx-auto text-amber-300" />
            <p className="mt-1 text-lg font-bold text-white">{suggestions.length}</p>
            <p className="font-mono text-[9px] uppercase text-zinc-600">sugeridas</p>
          </Card>
        </div>

        {moves.length > 0 && (
          <div className="mt-4">
            <SectionHeader icon={Target} title="Próximos movimentos" />
            <div className="space-y-1.5">
              {moves.map((move) => (
                <Button
                  key={move.id}
                  type="button"
                  variant="bare"
                  size="bare"
                  onClick={() => closeAndNavigate(
                    move.panel,
                    move.focus_test_id ? { focusTestId: move.focus_test_id } : undefined
                  )}
                  className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2.5 text-left hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                      {horizonLabel[move.horizon] || move.horizon}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-bold text-white">{move.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">{move.description}</p>
                  </div>
                  <ArrowRight size={13} className="shrink-0 text-zinc-600" />
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <SectionHeader icon={Crosshair} title="Oportunidades para agora" meta={String(suggestions.length)} />
          {suggestions.length === 0 ? (
            <Card className="sub-card p-4 text-center shadow-none">
              <Clock3 size={16} className="mx-auto text-zinc-600" />
              <p className="mt-2 text-[11px] text-zinc-500">Sem novas oportunidades compatíveis neste momento.</p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {suggestions.map((opp) => (
                <Button
                  key={opp.id}
                  type="button"
                  variant="bare"
                  size="bare"
                  onClick={() => selectOpportunity(opp)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-left hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-white">{opp.name}</p>
                    <p className="mt-0.5 truncate font-mono text-[9px] uppercase text-zinc-600">
                      {opp.district || "Zona desconhecida"} · risco {opp.risk || "—"}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] font-bold text-emerald-300">
                    {fmtMoney(opp.reward || 0)}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </div>

        {nextUnlockLevel && (
          <Card className="sub-card mt-4 border-cyan-500/15 p-3 shadow-none">
            <div className="flex items-start gap-2">
              <LockKeyhole size={14} className="mt-0.5 shrink-0 text-cyan-300" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-300/70">
                  Próximo marco · nível {nextUnlockLevel}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {nextUnlocks.map((area) => (
                    <Badge key={area.id} variant="outline" className="border-white/10 text-[9px] text-zinc-300">
                      {area.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </SheetContent>
    </Sheet>
  );
};
