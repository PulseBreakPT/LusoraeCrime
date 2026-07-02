import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";
import LiveMap from "../components/game/LiveMap";
import { ResourceBar } from "../components/game/ResourceBar";
import { OpportunityCard } from "../components/game/OpportunityCard";
import { TeamsPanel } from "../components/game/TeamsPanel";
import { EmpirePanel } from "../components/game/EmpirePanel";
import { ActivityFeed, ActivityFeedMobile } from "../components/game/ActivityFeed";
import { Building2, Users, Loader2 } from "lucide-react";

export default function GamePage() {
  const { state, serverNow } = useGame();
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [showTeams, setShowTeams] = useState(false);
  const [showEmpire, setShowEmpire] = useState(false);

  useEffect(() => {
    if (!selectedOpp || !state) return;
    const still = state.opportunities.find((o) => o.id === selectedOpp.id);
    if (!still) setSelectedOpp(null);
    else if (still !== selectedOpp) setSelectedOpp(still);
  }, [state, selectedOpp]);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-600" />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">A ligar à rede...</p>
        </div>
      </div>
    );
  }

  const busyCount = state.teams.filter((t) => t.status !== "idle").length;

  return (
    <div data-testid="game-page" className="relative h-screen w-full overflow-hidden bg-[#050505]">
      <LiveMap
        state={state}
        serverNow={serverNow}
        selectedOppId={selectedOpp?.id}
        onSelectOpp={(opp) => setSelectedOpp(opp)}
      />

      <ResourceBar />
      <ActivityFeed />
      <ActivityFeedMobile />
      {selectedOpp && <OpportunityCard opp={selectedOpp} onClose={() => setSelectedOpp(null)} />}

      <div className="pointer-events-auto absolute bottom-3 left-2 z-30 flex gap-2 md:left-1/2 md:-translate-x-1/2">
        <button
          data-testid="open-empire-button"
          onClick={() => setShowEmpire(true)}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xl backdrop-blur-xl transition-colors hover:bg-black"
        >
          <Building2 size={15} className="text-red-500" /> Império
        </button>
        <button
          data-testid="open-teams-button"
          onClick={() => setShowTeams(true)}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xl backdrop-blur-xl transition-colors hover:bg-black"
        >
          <Users size={15} className="text-cyan-400" /> Equipas
          {busyCount > 0 && (
            <span className="rounded-full bg-red-600 px-1.5 font-mono text-[10px]">{busyCount}</span>
          )}
        </button>
      </div>

      <TeamsPanel open={showTeams} onOpenChange={setShowTeams} />
      <EmpirePanel open={showEmpire} onOpenChange={setShowEmpire} />
    </div>
  );
}
