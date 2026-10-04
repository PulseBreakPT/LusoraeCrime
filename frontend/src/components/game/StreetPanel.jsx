import { useEffect, useMemo, useState } from "react";
import {
  Activity, BriefcaseBusiness, Car, Check, ChevronRight,
  Clock3, Contact, Gauge, Gavel, MapPinned, RadioTower, Radar,
  ShieldCheck, ShoppingBag, Siren, Sparkles, Star, Target, Trophy,
  Wrench, Zap,
} from "lucide-react";
import { useGame } from "../../context/GameContextV2";
import { fmtDuration, fmtMoney } from "../../lib/game";
import { MiniBar, PanelKicker, PanelWatermark, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";


const TABS = [
  ["radar", "Radar", RadioTower],
  ["territories", "Zonas", MapPinned],
  ["contacts", "Contactos", Contact],
  ["activities", "Atividades", Gauge],
  ["garage", "Garagem", Car],
  ["planning", "Plano", BriefcaseBusiness],
];

const CONTACT_ICONS = {
  fixer: BriefcaseBusiness,
  mechanic: Wrench,
  lawyer: Gavel,
  informant: Radar,
};

const JOB_ICONS = {
  race: Trophy,
  chop_shop: Car,
  smuggling: BriefcaseBusiness,
};

const selectClass = "h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 font-mono text-[10px] text-zinc-200 outline-none focus:border-red-500/50";

const metaByVehicle = (street) => Object.fromEntries(
  (street?.vehicle_meta || []).map((item) => [item.vehicle_id, item])
);

export const StreetPanel = ({ open, onOpenChange }) => {
  const {
    state, serverNow, saveStreetPlan, buyStreetGear, streetTerritoryAction,
    callStreetContact, startStreetActivity, claimStreetActivity, streetGarageAction,
  } = useGame();
  const street = state?.street;
  const [tab, setTab] = useState("radar");
  const [districtKey, setDistrictKey] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [wagerKey, setWagerKey] = useState("standard");
  const [draftPlan, setDraftPlan] = useState({
    approach_key: "balanced", escape_key: "speed", gear_keys: [],
  });

  const vehicles = state?.vehicles || [];
  const districts = street?.districts || [];
  const vehicleMeta = useMemo(() => metaByVehicle(street), [street]);

  useEffect(() => {
    if (!districtKey && districts[0]) setDistrictKey(districts[0].key);
  }, [districtKey, districts]);
  useEffect(() => {
    if (!vehicleId && vehicles[0]) setVehicleId(vehicles[0].id);
  }, [vehicleId, vehicles]);
  useEffect(() => {
    if (street?.plan) setDraftPlan({
      approach_key: street.plan.approach_key || "balanced",
      escape_key: street.plan.escape_key || "speed",
      gear_keys: street.plan.gear_keys || [],
    });
  }, [street?.plan]);

  if (!state) return null;

  const now = serverNow();
  const activeJob = street?.active_job;
  const selectedVehicle = vehicles.find((item) => item.id === vehicleId);
  const selectedDistrict = districts.find((item) => item.key === districtKey);

  const toggleGear = (key) => {
    setDraftPlan((current) => {
      const selected = current.gear_keys.includes(key);
      if (selected) return { ...current, gear_keys: current.gear_keys.filter((item) => item !== key) };
      if (current.gear_keys.length >= 2) return current;
      return { ...current, gear_keys: [...current.gear_keys, key] };
    });
  };

  const startJob = (jobKey) => startStreetActivity({
    job_key: jobKey,
    district_key: districtKey,
    vehicle_id: vehicleId,
    wager_key: jobKey === "race" ? wagerKey : null,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sub-panel sm:max-w-xl" data-testid="street-panel">
        <SheetHeader>
          <PanelWatermark icon={Radar} />
          <PanelKicker>Cidade Viva · Rede de Rua</PanelKicker>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Radar size={18} className="text-cyan-300" /> Central Urbana
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Território, contactos, atividades clandestinas e veículos sob vigilância.
          </SheetDescription>
        </SheetHeader>

        {!street ? (
          <Card className="mt-5 sub-card p-5 text-center">
            <Activity className="mx-auto animate-pulse text-cyan-300" size={22} />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              A sincronizar a rede urbana…
            </p>
          </Card>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              {TABS.map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  data-testid={`street-tab-${key}`}
                  className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    tab === key ? "bg-red-600/20 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  }`}
                >
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>

            {tab === "radar" && (
              <RadarTab street={street} now={now} />
            )}

            {tab === "territories" && (
              <TerritoriesTab
                districts={districts}
                onAction={(key, action) => streetTerritoryAction({ district_key: key, action })}
              />
            )}

            {tab === "contacts" && (
              <ContactsTab
                street={street}
                vehicles={vehicles}
                vehicleId={vehicleId}
                setVehicleId={setVehicleId}
                onCall={(contactKey) => callStreetContact({
                  contact_key: contactKey,
                  vehicle_id: contactKey === "mechanic" ? vehicleId : null,
                })}
              />
            )}

            {tab === "activities" && (
              <ActivitiesTab
                street={street}
                activeJob={activeJob}
                vehicles={vehicles}
                vehicleMeta={vehicleMeta}
                vehicleId={vehicleId}
                setVehicleId={setVehicleId}
                districts={districts}
                districtKey={districtKey}
                setDistrictKey={setDistrictKey}
                wagerKey={wagerKey}
                setWagerKey={setWagerKey}
                onStart={startJob}
                onClaim={() => claimStreetActivity({ job_id: activeJob.id })}
              />
            )}

            {tab === "garage" && (
              <GarageTab
                vehicles={vehicles}
                vehicleMeta={vehicleMeta}
                onAction={(id, action) => streetGarageAction({ vehicle_id: id, action })}
              />
            )}

            {tab === "planning" && (
              <PlanningTab
                street={street}
                draft={draftPlan}
                setDraft={setDraftPlan}
                toggleGear={toggleGear}
                onBuy={(key) => buyStreetGear({ gear_key: key, quantity: 1 })}
                onSave={() => saveStreetPlan(draftPlan)}
              />
            )}

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[9px] uppercase tracking-wider text-zinc-600">
              <span>{selectedDistrict?.name || "Sem zona"}</span>
              <span>{selectedVehicle?.name || "Sem veículo"}</span>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

const RadarTab = ({ street, now }) => {
  const wanted = street.wanted;
  const eventRemaining = Math.max(0, (Date.parse(street.event.ends_at) - now) / 1000);
  return (
    <div className="mt-4 space-y-3">
      <Card className="sub-card overflow-hidden p-4" data-testid="wanted-level-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">Nível de procurado</p>
            <div className="mt-2 flex gap-1" aria-label={`${wanted.stars} de 5 estrelas`}>
              {[0, 1, 2, 3, 4].map((index) => (
                <Star
                  key={index}
                  size={20}
                  className={index < wanted.stars ? "fill-amber-400 text-amber-300" : "text-zinc-800"}
                />
              ))}
            </div>
          </div>
          <Badge className="border-red-500/30 bg-red-500/10 font-mono text-red-300">
            {Math.round(wanted.heat)}% calor
          </Badge>
        </div>
        {wanted.search_active ? (
          <div className="mt-3 rounded-lg border border-red-500/25 bg-red-500/5 p-2">
            <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-red-300">
              <Siren size={12} className="animate-pulse" /> Busca policial ativa · {fmtDuration(wanted.remaining_s)}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">Evita veículos notórios e atividades agressivas até a busca perder força.</p>
          </div>
        ) : (
          <p className="mt-3 font-mono text-[10px] text-emerald-400">Sem cerco ativo nesta zona.</p>
        )}
      </Card>

      <Card className="sub-card p-4" data-testid="street-rank-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">Reputação de rua</p>
            <p className="mt-1 text-sm font-bold text-white">{street.rank.name}</p>
          </div>
          <span className="font-mono text-lg font-bold text-cyan-300">{street.rank.rep}</span>
        </div>
        <MiniBar value={street.rank.progress_pct} color="#22D3EE" className="mt-3" height="h-1.5" />
        <p className="mt-1 text-right font-mono text-[9px] text-zinc-600">
          {street.rank.next_rep ? `Próximo nível em ${street.rank.next_rep}` : "Nível máximo"}
        </p>
      </Card>

      <SectionHeader icon={Sparkles} label="Evento urbano" />
      <Card className="sub-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-white">{street.event.name}</p>
          <span className="font-mono text-[9px] text-zinc-500">{fmtDuration(eventRemaining)}</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{street.event.description}</p>
        <div className="mt-3 grid grid-cols-3 gap-1 text-center font-mono text-[9px]">
          <Modifier label="Sucesso" value={street.event.success} pct />
          <Modifier label="Pagamento" value={street.event.reward_mult - 1} pct />
          <Modifier label="Calor" value={street.event.heat_mult - 1} pct inverse />
        </div>
      </Card>

      <SectionHeader icon={RadioTower} label="Scanner policial" />
      <Card className="sub-card p-4">
        <div className="grid grid-cols-2 gap-2">
          <Info label="Força na zona" value={street.scanner.force} />
          <Info label="Alerta" value={street.scanner.alert} />
          <Info label="Pressão máxima" value={street.scanner.hot_district || "Sem sinal"} />
          <Info
            label="Inteligência"
            value={street.scanner.intel_active ? `Ativa · ${fmtDuration(street.scanner.intel_remaining_s)}` : "Normal"}
            accent={street.scanner.intel_active}
          />
        </div>
      </Card>
    </div>
  );
};

const TerritoriesTab = ({ districts, onAction }) => (
  <div className="mt-4 space-y-3">
    <SectionHeader icon={MapPinned} label="Influência territorial" />
    <p className="text-[10px] leading-relaxed text-zinc-500">
      Trabalhos bem-sucedidos aumentam influência. Aos 100 pontos podes assumir a zona; níveis superiores geram rendimento e melhoram atividades locais.
    </p>
    {districts.map((district) => {
      const canClaim = !district.controlled && district.influence >= 100;
      const reinforceNeed = 90 + district.tier * 20;
      const canReinforce = district.controlled && district.tier < 3 && district.influence >= reinforceNeed;
      return (
        <Card key={district.key} className="sub-card p-3" data-testid={`street-district-${district.key}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-white">{district.name}</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase text-zinc-500">
                {district.controlled ? `Controlo nível ${district.tier}` : "Zona aberta"} · {fmtMoney(district.income_per_h)}/h
              </p>
            </div>
            <Badge variant="outline" className={district.controlled ? "border-emerald-500/30 text-emerald-300" : "border-white/10 text-zinc-500"}>
              {Math.round(district.influence)} influência
            </Badge>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between font-mono text-[8px] uppercase text-zinc-600">
              <span>Influência</span><span>{Math.round(district.influence)}/150</span>
            </div>
            <MiniBar value={(district.influence / 150) * 100} color="#22D3EE" height="h-1" />
          </div>
          <div className="mt-2">
            <div className="mb-1 flex justify-between font-mono text-[8px] uppercase text-zinc-600">
              <span>Pressão rival</span><span>{Math.round(district.rival_pressure)}%</span>
            </div>
            <MiniBar value={district.rival_pressure} color={district.rival_pressure >= 70 ? "#EF4444" : "#F59E0B"} height="h-1" />
          </div>
          <div className="mt-3 flex gap-2">
            {!district.controlled && (
              <Button size="sm" className="h-8 flex-1 text-[9px]" disabled={!canClaim} onClick={() => onAction(district.key, "claim")}>
                <Target size={11} /> Assumir · {fmtMoney(5000)}
              </Button>
            )}
            {district.controlled && district.tier < 3 && (
              <Button size="sm" variant="outline" className="h-8 flex-1 text-[9px]" disabled={!canReinforce} onClick={() => onAction(district.key, "reinforce")}>
                <ShieldCheck size={11} /> Consolidar
              </Button>
            )}
            {district.controlled && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 flex-1 text-[9px]"
                disabled={district.rival_pressure < 5 || district.defend_remaining_s > 0}
                onClick={() => onAction(district.key, "defend")}
              >
                <Siren size={11} /> {district.defend_remaining_s > 0 ? fmtDuration(district.defend_remaining_s) : "Defender"}
              </Button>
            )}
          </div>
        </Card>
      );
    })}
  </div>
);

const ContactsTab = ({ street, vehicles, vehicleId, setVehicleId, onCall }) => (
  <div className="mt-4 space-y-3">
    <SectionHeader icon={Contact} label="Rede de contactos" />
    <p className="text-[10px] leading-relaxed text-zinc-500">
      Cada favor aumenta a relação. Os contactos têm recarga própria e produzem efeitos imediatos no mundo.
    </p>
    {street.contacts.map((contact) => {
      const Icon = CONTACT_ICONS[contact.key] || Contact;
      return (
        <Card key={contact.key} className={`sub-card p-3 ${contact.unlocked ? "" : "opacity-55"}`}>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40">
              <Icon size={16} className="text-cyan-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-white">{contact.name}</p>
                <span className="font-mono text-[9px] text-zinc-500">Favor {contact.favor}</span>
              </div>
              <p className="font-mono text-[9px] uppercase text-red-300/70">{contact.role}</p>
              <p className="mt-1 text-[10px] text-zinc-500">{contact.description}</p>
            </div>
          </div>
          {contact.key === "mechanic" && contact.unlocked && (
            <select className={`${selectClass} mt-3`} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
            </select>
          )}
          <Button
            size="sm"
            variant="outline"
            className="mt-3 h-8 w-full text-[9px]"
            disabled={!contact.unlocked || contact.remaining_s > 0 || (contact.key === "mechanic" && !vehicleId)}
            onClick={() => onCall(contact.key)}
          >
            {!contact.unlocked
              ? `Desbloqueia no nível ${contact.unlock_rank}`
              : contact.remaining_s > 0
              ? `Disponível em ${fmtDuration(contact.remaining_s)}`
              : "Pedir favor"}
          </Button>
        </Card>
      );
    })}
  </div>
);

const ActivitiesTab = ({
  street, activeJob, vehicles, vehicleMeta, vehicleId, setVehicleId,
  districts, districtKey, setDistrictKey, wagerKey, setWagerKey, onStart, onClaim,
}) => {
  if (activeJob) {
    const ready = activeJob.status === "ready";
    return (
      <div className="mt-4 space-y-3">
        <SectionHeader icon={Activity} label="Atividade em curso" />
        <Card className="sub-card p-4" data-testid="street-active-job">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-white">{activeJob.name}</p>
              <p className="font-mono text-[9px] uppercase text-zinc-500">
                {activeJob.district_name} · {activeJob.vehicle_name}
              </p>
            </div>
            <Badge className={ready ? "bg-emerald-500/15 text-emerald-300" : "bg-cyan-500/15 text-cyan-300"}>
              {ready ? "Resultado pronto" : fmtDuration(activeJob.remaining_s)}
            </Badge>
          </div>
          <MiniBar value={activeJob.progress_pct} color={ready ? "#34D399" : "#22D3EE"} className="mt-4" height="h-2" />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Info label="Chance" value={`${Math.round(activeJob.chance * 100)}%`} />
            <Info label="Recompensa" value={fmtMoney(activeJob.reward)} />
            <Info label="Plano" value={activeJob.approach_key} />
          </div>
          <Button className="mt-4 w-full" disabled={!ready} onClick={onClaim}>
            {ready ? <><Check size={14} /> Recolher resultado</> : <><Clock3 size={14} /> Operação no terreno</>}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <SectionHeader icon={Gauge} label="Preparar atividade" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="font-mono text-[9px] uppercase text-zinc-500">
          Zona
          <select className={`${selectClass} mt-1`} value={districtKey} onChange={(event) => setDistrictKey(event.target.value)}>
            {districts.map((district) => <option key={district.key} value={district.key}>{district.name}</option>)}
          </select>
        </label>
        <label className="font-mono text-[9px] uppercase text-zinc-500">
          Veículo
          <select className={`${selectClass} mt-1`} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            {vehicles.map((vehicle) => {
              const meta = vehicleMeta[vehicle.id] || {};
              return <option key={vehicle.id} value={vehicle.id}>{vehicle.name}{meta.impounded ? " · apreendido" : ""}</option>;
            })}
          </select>
        </label>
      </div>
      <label className="block font-mono text-[9px] uppercase text-zinc-500">
        Aposta para corridas
        <select className={`${selectClass} mt-1`} value={wagerKey} onChange={(event) => setWagerKey(event.target.value)}>
          {street.wagers.map((wager) => (
            <option key={wager.key} value={wager.key} disabled={!wager.unlocked}>
              {wager.name} · {fmtMoney(wager.cost)}
            </option>
          ))}
        </select>
      </label>

      {street.activities.map((job) => {
        const Icon = JOB_ICONS[job.key] || Activity;
        const meta = vehicleMeta[vehicleId] || {};
        const vehicle = vehicles.find((item) => item.id === vehicleId);
        const blocked = !job.unlocked || !vehicleId || meta.impounded || (vehicle && vehicle.condition < 35);
        return (
          <Card key={job.key} className={`sub-card p-3 ${job.unlocked ? "" : "opacity-55"}`}>
            <div className="flex items-start gap-3">
              <Icon size={17} className="mt-0.5 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-white">{job.name}</p>
                  <span className="font-mono text-[9px] text-zinc-500">{fmtDuration(job.duration_s)}</span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{job.description}</p>
                <p className="mt-2 font-mono text-[9px] text-zinc-400">
                  Base {Math.round(job.base_success * 100)}% · {fmtMoney(job.reward_min)}–{fmtMoney(job.reward_max)}
                </p>
              </div>
            </div>
            <Button size="sm" className="mt-3 h-8 w-full text-[9px]" disabled={blocked} onClick={() => onStart(job.key)}>
              {!job.unlocked ? `Desbloqueia no nível ${job.unlock_rank}` : <><ChevronRight size={12} /> Iniciar em {districts.find((item) => item.key === districtKey)?.name}</>}
            </Button>
          </Card>
        );
      })}
    </div>
  );
};

const GarageTab = ({ vehicles, vehicleMeta, onAction }) => (
  <div className="mt-4 space-y-3">
    <SectionHeader icon={Car} label="Garagem clandestina" />
    <p className="text-[10px] leading-relaxed text-zinc-500">
      A notoriedade aumenta em atividades e operações normais, elevando o risco de perseguição. Matrículas frias limpam o histórico visual.
    </p>
    {vehicles.map((vehicle) => {
      const meta = vehicleMeta[vehicle.id] || {};
      return (
        <Card key={vehicle.id} className="sub-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-white">{vehicle.name}</p>
              <p className="font-mono text-[9px] uppercase text-zinc-500">
                Condição {Math.round(vehicle.condition)}% · Combustível {Math.round(vehicle.fuel_l)}/{Math.round(vehicle.tank_l)} L
              </p>
            </div>
            {meta.insured && <Badge className="bg-emerald-500/10 text-emerald-300"><ShieldCheck size={10} /> Seguro</Badge>}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between font-mono text-[8px] uppercase text-zinc-600">
              <span>Notoriedade</span><span>{Math.round(meta.notoriety || 0)}%</span>
            </div>
            <MiniBar value={meta.notoriety || 0} color={(meta.notoriety || 0) >= 60 ? "#EF4444" : "#F59E0B"} height="h-1" />
          </div>
          {meta.impounded && (
            <p className="mt-2 flex items-center gap-1 font-mono text-[9px] text-red-300">
              <Siren size={10} /> Apreendido durante {fmtDuration(meta.impound_remaining_s)}
            </p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-1">
            <Button size="sm" variant="outline" className="h-8 px-1 text-[8px]" disabled={!meta.notoriety} onClick={() => onAction(vehicle.id, "plates")}>
              Matrículas
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-1 text-[8px]" disabled={meta.insured} onClick={() => onAction(vehicle.id, "insure")}>
              Segurar
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-1 text-[8px]" disabled={!meta.impounded} onClick={() => onAction(vehicle.id, "recover")}>
              Recuperar
            </Button>
          </div>
        </Card>
      );
    })}
  </div>
);

const PlanningTab = ({ street, draft, setDraft, toggleGear, onBuy, onSave }) => (
  <div className="mt-4 space-y-4">
    <div>
      <SectionHeader icon={Target} label="Abordagem" />
      <div className="mt-2 grid grid-cols-1 gap-2">
        {street.approaches.map((item) => (
          <ChoiceCard
            key={item.key}
            item={item}
            selected={draft.approach_key === item.key}
            onClick={() => item.unlocked && setDraft((current) => ({ ...current, approach_key: item.key }))}
          />
        ))}
      </div>
    </div>

    <div>
      <SectionHeader icon={Zap} label="Plano de fuga" />
      <div className="mt-2 grid grid-cols-1 gap-2">
        {street.escape_plans.map((item) => (
          <ChoiceCard
            key={item.key}
            item={item}
            selected={draft.escape_key === item.key}
            onClick={() => item.unlocked && setDraft((current) => ({ ...current, escape_key: item.key }))}
          />
        ))}
      </div>
    </div>

    <div>
      <SectionHeader icon={ShoppingBag} label="Equipamento consumível" />
      <p className="mt-1 text-[10px] text-zinc-500">Compra unidades e prepara até dois itens. Só são consumidos ao iniciar uma atividade compatível.</p>
      <div className="mt-2 space-y-2">
        {street.gear_catalog.map((item) => {
          const selected = draft.gear_keys.includes(item.key);
          return (
            <Card key={item.key} className={`sub-card p-3 ${item.unlocked ? "" : "opacity-55"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-white">{item.name}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">{item.description}</p>
                  <p className="mt-1 font-mono text-[9px] text-zinc-400">Em armazém: {item.owned}</p>
                </div>
                <Badge variant="outline" className="shrink-0 border-white/10 text-zinc-300">{fmtMoney(item.current_price)}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="h-8 text-[9px]" disabled={!item.unlocked} onClick={() => onBuy(item.key)}>
                  Comprar
                </Button>
                <Button
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="h-8 text-[9px]"
                  disabled={!item.unlocked || (!selected && item.owned < 1) || (!selected && draft.gear_keys.length >= 2)}
                  onClick={() => toggleGear(item.key)}
                >
                  {selected ? <><Check size={11} /> Preparado</> : "Preparar"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>

    <Button className="w-full" onClick={onSave}>
      <BriefcaseBusiness size={14} /> Guardar plano operacional
    </Button>
  </div>
);

const ChoiceCard = ({ item, selected, onClick }) => (
  <button
    type="button"
    disabled={!item.unlocked}
    onClick={onClick}
    className={`rounded-xl border p-3 text-left transition-colors ${
      selected ? "border-red-500/50 bg-red-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
    } ${item.unlocked ? "" : "opacity-45"}`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-bold text-white">{item.name}</span>
      {selected && <Check size={13} className="text-red-300" />}
    </div>
    <p className="mt-1 text-[10px] text-zinc-500">{item.description}</p>
    <div className="mt-2 flex gap-3 font-mono text-[8px] uppercase text-zinc-600">
      <span>Sucesso {signedPct(item.success)}</span>
      {item.reward_mult != null && <span>Pagamento {signedPct(item.reward_mult - 1)}</span>}
      {item.cost > 0 && <span>Custo {fmtMoney(item.cost)}</span>}
    </div>
  </button>
);

const Modifier = ({ label, value, pct, inverse }) => {
  const positive = inverse ? value <= 0 : value >= 0;
  return (
    <div className="rounded border border-white/10 bg-black/30 p-2">
      <p className="text-zinc-600">{label}</p>
      <p className={positive ? "text-emerald-300" : "text-red-300"}>{pct ? signedPct(value) : value}</p>
    </div>
  );
};

const Info = ({ label, value, accent }) => (
  <div className="rounded-lg border border-white/10 bg-black/25 p-2">
    <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">{label}</p>
    <p className={`mt-1 truncate font-mono text-[10px] font-bold ${accent ? "text-cyan-300" : "text-zinc-300"}`}>{value}</p>
  </div>
);

const signedPct = (value) => {
  const pct = Math.round(Number(value || 0) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
};
