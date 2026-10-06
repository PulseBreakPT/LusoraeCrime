import { useEffect, useMemo, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { PanelWatermark } from "./hud";
import {
  RadioTower, AlertTriangle, ShieldCheck, Gauge, Users, Car, MapPinned,
  Plus, Trash2, Route, Zap, SlidersHorizontal, CloudRain, Clock3, CalendarDays,
} from "lucide-react";

const TABS = [
  ["center", "Centro"],
  ["coverage", "Cobertura"],
  ["rules", "Regras"],
];

const readinessTone = {
  playable: "text-emerald-300",
  stretch: "text-amber-300",
  locked: "text-red-300",
};

const secondsLeft = (iso) => {
  if (!iso) return null;
  const s = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
};

export const OperationalCenterPanel = ({ open, onOpenChange, onNavigate }) => {
  const {
    state,
    reinforceMission,
    createStagingArea,
    deleteStagingArea,
    saveOperationalRules,
  } = useGame();
  const [tab, setTab] = useState("center");
  const [busy, setBusy] = useState("");
  const [rules, setRules] = useState(null);

  const operational = state?.operational || {};
  const world = operational.world || {};
  const idleTeams = useMemo(
    () => (state?.teams || []).filter((team) => team.status === "idle" && team.vehicle_id),
    [state?.teams]
  );

  useEffect(() => {
    if (!open) return;
    setRules({
      auto_low_risk: false,
      max_auto_risk: 1,
      min_auto_chance: 0.75,
      max_heat: 65,
      reserve_teams: 1,
      min_vehicle_condition: 65,
      ...(operational.operational_rules || {}),
    });
  }, [open, operational.operational_rules]);

  if (!state) return null;

  const act = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } finally { setBusy(""); }
  };

  const sendSupport = (missionId, teamId) =>
    act(`support-${missionId}-${teamId}`, () => reinforceMission(missionId, teamId));

  const createStaging = (row) => {
    if (!Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lng))) return;
    return act(`staging-${row.district}`, () =>
      createStagingArea(`Apoio · ${row.district}`, Number(row.lat), Number(row.lng), 4)
    );
  };

  const saveRules = () => act("rules", () => saveOperationalRules(rules || {}));

  const counts = operational.readiness_counts || {};
  const staging = (operational.staging_areas || []).filter(
    (area) => !area.expires_at || Date.parse(area.expires_at) > Date.now()
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sub-panel w-full overflow-y-auto sm:max-w-xl"
        data-testid="operational-center-panel"
      >
        <SheetHeader>
          <PanelWatermark icon={RadioTower} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <RadioTower size={18} className="text-sky-300" /> Central de Operações
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Coordena prontidão, reforços, cobertura regional e regras de despacho sem sair do mapa.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-3">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1">
            {TABS.map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wider"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "center" && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                ["playable", "Prontas", counts.playable || 0],
                ["stretch", "No limite", counts.stretch || 0],
                ["locked", "Bloqueadas", counts.locked || 0],
              ].map(([key, label, value]) => (
                <Card key={key} className="sub-card p-3 text-center shadow-none">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
                  <p className={`mt-1 text-xl font-bold ${readinessTone[key]}`}>{value}</p>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Card className="sub-card p-3 shadow-none">
                <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase text-zinc-500">
                  <Users size={11} /> Equipas prontas
                </p>
                <p className="mt-1 text-lg font-bold text-white">{operational.available_teams || 0}</p>
              </Card>
              <Card className="sub-card p-3 shadow-none">
                <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase text-zinc-500">
                  <Car size={11} /> Viaturas úteis
                </p>
                <p className="mt-1 text-lg font-bold text-white">{operational.usable_vehicles || 0}</p>
              </Card>
            </div>

            {(operational.requires_action || []).length > 0 && (
              <Card className="sub-card border-red-500/20 p-3 shadow-none">
                <p className="flex items-center gap-2 text-xs font-bold text-white">
                  <AlertTriangle size={14} className="text-red-400" /> Requer a tua atenção
                </p>
                <div className="mt-2 space-y-2">
                  {operational.requires_action.map((item) => (
                    <div key={`${item.kind}-${item.mission_id}`} className="rounded-lg border border-white/[0.07] bg-black/20 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-zinc-100">{item.title}</p>
                          <p className="mt-0.5 font-mono text-[9px] text-zinc-500">
                            {item.team}{item.expires_at ? ` · ${secondsLeft(item.expires_at)}` : ""}
                          </p>
                        </div>
                        {item.kind === "decision" && (
                          <Button size="compact" variant="outline" onClick={() => onNavigate?.("operations")}>
                            Abrir
                          </Button>
                        )}
                      </div>
                      {item.kind === "reinforcement" && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {idleTeams.slice(0, 4).map((team) => (
                            <Button
                              key={team.id}
                              size="compact"
                              variant="outline"
                              disabled={!!busy}
                              onClick={() => sendSupport(item.mission_id, team.id)}
                            >
                              <Plus size={11} /> {team.name}
                            </Button>
                          ))}
                          {!idleTeams.length && (
                            <span className="font-mono text-[9px] text-zinc-600">Sem equipas de reserva.</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="sub-card p-3 shadow-none">
              <p className="flex items-center gap-2 text-xs font-bold text-white">
                <Zap size={13} className="text-amber-300" /> Mundo operacional
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <CloudRain size={12} className="mx-auto text-sky-300" />
                  <p className="mt-1 text-[10px] font-semibold text-zinc-200">{world.weather?.name || "—"}</p>
                </div>
                <div>
                  <Clock3 size={12} className="mx-auto text-zinc-300" />
                  <p className="mt-1 text-[10px] font-semibold text-zinc-200">{world.daypart?.name || "—"}</p>
                </div>
                <div>
                  <CalendarDays size={12} className="mx-auto text-red-300" />
                  <p className="mt-1 text-[10px] font-semibold text-zinc-200">{world.event?.name || "—"}</p>
                </div>
              </div>
            </Card>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => onNavigate?.("operations")}
            >
              <Route size={14} /> Ver operações
            </Button>
          </div>
        )}

        {tab === "coverage" && (
          <div className="mt-3 space-y-3">
            {staging.length > 0 && (
              <Card className="sub-card p-3 shadow-none">
                <p className="flex items-center gap-2 text-xs font-bold text-white">
                  <MapPinned size={13} className="text-cyan-300" /> Pontos de apoio ativos
                </p>
                <div className="mt-2 space-y-1.5">
                  {staging.map((area) => (
                    <div key={area.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-2 py-2">
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">{area.name}</p>
                        <p className="font-mono text-[9px] text-zinc-600">{secondsLeft(area.expires_at)} restantes · cap. {area.capacity_teams}</p>
                      </div>
                      <Button
                        size="iconCompact"
                        variant="outline"
                        disabled={!!busy}
                        aria-label="Remover ponto de apoio"
                        onClick={() => act(`delete-${area.id}`, () => deleteStagingArea(area.id))}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {(operational.coverage || []).map((row) => (
              <Card key={row.district} className="sub-card p-3 shadow-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{row.district}</p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                      {row.profile?.name || "Zona"} · anel {Number(row.profile?.ring || 0) + 1}
                    </p>
                  </div>
                  <Button
                    size="compact"
                    variant="outline"
                    disabled={!!busy || !Number.isFinite(Number(row.lat))}
                    onClick={() => createStaging(row)}
                  >
                    <Plus size={11} /> Apoio
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-mono text-[9px] text-zinc-600">Operações</p>
                    <p className="text-xs font-bold text-zinc-200">{row.active_operations}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] text-zinc-600">Atenção</p>
                    <p className="text-xs font-bold text-zinc-200">{Math.round(row.attention || 0)}%</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] text-zinc-600">Pressão</p>
                    <p className="text-xs font-bold text-zinc-200">{Math.round(row.pressure || 0)}%</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === "rules" && rules && (
          <div className="mt-3 space-y-3">
            <Card className="sub-card p-3 shadow-none">
              <p className="flex items-center gap-2 text-xs font-bold text-white">
                <SlidersHorizontal size={13} className="text-sky-300" /> Limites de automação
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                Estas regras definem a margem que futuros tenentes/automatismos devem respeitar. Nada é despachado automaticamente sem passar estes limites.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[10px] text-zinc-500">
                  Risco automático máx.
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    max={3}
                    value={rules.max_auto_risk}
                    onChange={(e) => setRules({ ...rules, max_auto_risk: Number(e.target.value) })}
                  />
                </label>
                <label className="text-[10px] text-zinc-500">
                  Chance mínima %
                  <Input
                    className="mt-1"
                    type="number"
                    min={55}
                    max={95}
                    value={Math.round(Number(rules.min_auto_chance || 0.75) * 100)}
                    onChange={(e) => setRules({ ...rules, min_auto_chance: Number(e.target.value) / 100 })}
                  />
                </label>
                <label className="text-[10px] text-zinc-500">
                  Calor máximo
                  <Input
                    className="mt-1"
                    type="number"
                    min={20}
                    max={90}
                    value={rules.max_heat}
                    onChange={(e) => setRules({ ...rules, max_heat: Number(e.target.value) })}
                  />
                </label>
                <label className="text-[10px] text-zinc-500">
                  Equipas em reserva
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    max={3}
                    value={rules.reserve_teams}
                    onChange={(e) => setRules({ ...rules, reserve_teams: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant={rules.auto_low_risk ? "success" : "outline"}
                  onClick={() => setRules({ ...rules, auto_low_risk: !rules.auto_low_risk })}
                >
                  <ShieldCheck size={12} /> Baixo risco {rules.auto_low_risk ? "ativo" : "inativo"}
                </Button>
                <Button variant="outline" disabled={!!busy} onClick={saveRules}>
                  <Gauge size={12} /> Guardar
                </Button>
              </div>
            </Card>

            <Card className="sub-card p-3 shadow-none">
              <p className="text-xs font-bold text-white">Planos de despacho</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                Perfis reutilizáveis. Servem de base às recomendações e à futura gestão regional automática.
              </p>
              <div className="mt-2 space-y-1.5">
                {Object.entries(operational.presets || {}).map(([key, preset]) => (
                  <div key={key} className="rounded-lg border border-white/[0.06] px-2.5 py-2">
                    <p className="text-xs font-semibold text-zinc-200">{preset.name || key}</p>
                    <p className="mt-0.5 font-mono text-[9px] text-zinc-600">
                      chance ≥ {Math.round(Number(preset.min_chance || 0) * 100)}% · calor ≤ {preset.max_heat ?? "—"} · reserva {preset.reserve_teams ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
