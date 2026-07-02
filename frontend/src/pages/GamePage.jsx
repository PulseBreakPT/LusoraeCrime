import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";
import LiveMap from "../components/game/LiveMap";
import { ResourceBar } from "../components/game/ResourceBar";
import { OpportunityCard } from "../components/game/OpportunityCard";
import { TeamsPanel } from "../components/game/TeamsPanel";
import { EmpirePanel } from "../components/game/EmpirePanel";
import { EmployeesPanel } from "../components/game/EmployeesPanel";
import { FleetPanel } from "../components/game/FleetPanel";
import { PropertiesPanel } from "../components/game/PropertiesPanel";
import { ActivityFeed, ActivityFeedMobile } from "../components/game/ActivityFeed";
import { Building2, Users, IdCard, Car, Warehouse, Loader2 } from "lucide-react";

export default function GamePage() {
  const { state, serverNow } = useGame();
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);

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

      <div className="pointer-events-auto absolute bottom-3 left-2 z-30 flex gap-1.5 md:left-1/2 md:-translate-x-1/2">
        <HudButton testId="open-empire-button" icon={Building2} label="Império" color="text-red-500" onClick={() => setOpenPanel("empire")} />
        <HudButton testId="open-teams-button" icon={Users} label="Equipas" color="text-cyan-400" badge={busyCount} onClick={() => setOpenPanel("teams")} />
        <HudButton testId="open-employees-button" icon={IdCard} label="RH" color="text-emerald-400" onClick={() => setOpenPanel("employees")} />
        <HudButton testId="open-fleet-button" icon={Car} label="Frota" color="text-amber-400" onClick={() => setOpenPanel("fleet")} />
        <HudButton testId="open-properties-button" icon={Warehouse} label="Imóveis" color="text-purple-300" onClick={() => setOpenPanel("properties")} />
      </div>

      <TeamsPanel open={openPanel === "teams"} onOpenChange={(o) => setOpenPanel(o ? "teams" : null)} />
      <EmpirePanel open={openPanel === "empire"} onOpenChange={(o) => setOpenPanel(o ? "empire" : null)} />
      <EmployeesPanel open={openPanel === "employees"} onOpenChange={(o) => setOpenPanel(o ? "employees" : null)} />
      <FleetPanel open={openPanel === "fleet"} onOpenChange={(o) => setOpenPanel(o ? "fleet" : null)} />
      <PropertiesPanel open={openPanel === "properties"} onOpenChange={(o) => setOpenPanel(o ? "properties" : null)} />
    </div>
  );
}

const HudButton = ({ testId, icon: Icon, label, color, badge, onClick }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/80 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xl backdrop-blur-xl transition-colors hover:bg-black"
  >
    <Icon size={15} className={color} />
    <span className="hidden md:inline">{label}</span>
    {badge > 0 && <span className="rounded-full bg-red-600 px-1.5 font-mono text-[10px]">{badge}</span>}
  </button>
);
