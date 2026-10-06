import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, formatApiErrorDetail } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { PanelWatermark } from "./hud";
import {
  RadioTower, CloudRain, Newspaper, Skull, Building2, Users, Trophy, Clock3,
  ShieldAlert, Eye, Bomb, Handshake, TrendingUp, Coins, Dices, MessageCircle,
  HeartPulse, RefreshCw, Zap, Landmark, Send, ArrowUpCircle, Flag, UserX,
} from "lucide-react";

const TABS = [
  ["pulse", "Pulso", RadioTower],
  ["news", "Notícias", Newspaper],
  ["rivals", "Rivais", Skull],
  ["business", "Negócios", Building2],
  ["social", "Rede", Users],
];

const pct = (value) => `${Number(value || 0) >= 0 ? "+" : ""}${Math.round(Number(value || 0) * 100)}%`;
const nfmt = (value) => Number(value || 0).toLocaleString("pt-PT");
const timeLeft = (seconds) => {
  const s = Math.max(0, Number(seconds || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};

const ActionButton = ({ children, onClick, disabled, tone = "default" }) => (
  <Button
    type="button"
    size="compact"
    variant={tone === "danger" ? "destructive" : tone === "good" ? "success" : "outline"}
    disabled={disabled}
    onClick={onClick}
    className="font-mono uppercase tracking-[0.08em]"
  >
    {children}
  </Button>
);

export const CityPanel = ({
  open,
  onOpenChange,
  initialTab = "pulse",
  visibleTabs = null,
  title = "Mundo",
  description = "Pulso urbano, acontecimentos, rivais e rede local.",
}) => {
  const { state, refresh: refreshGame } = useGame();
  const [tab, setTab] = useState(initialTab);
  const [city, setCity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [chat, setChat] = useState("");
  const [allianceName, setAllianceName] = useState("");
  const [allianceCode, setAllianceCode] = useState("");
  const [rouletteChoice, setRouletteChoice] = useState("red");
  const [bet, setBet] = useState(500);
  const scopedTabs = visibleTabs?.length ? TABS.filter(([key]) => visibleTabs.includes(key)) : TABS;

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/game/city/state");
      setCity(data);
    } catch (e) {
      if (!silent) toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Falha ao carregar a cidade");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    const id = setInterval(() => load(true), 15000);
    return () => clearInterval(id);
  }, [open, load]);

  const act = async (key, path, payload = {}, success) => {
    if (busy) return;
    setBusy(key);
    try {
      const requestId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { data } = await api.post(`/game/city/${path}`, { ...payload, request_id: requestId });
      if (success) toast.success(typeof success === "function" ? success(data) : success);
      await Promise.all([load(true), refreshGame()]);
      return data;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      return null;
    } finally {
      setBusy("");
    }
  };

  const world = city?.world;
  const season = city?.season;
  const businesses = useMemo(() => city?.businesses || [], [city?.businesses]);
  const catalog = useMemo(() => city?.business_catalog || {}, [city?.business_catalog]);
  const rivalActions = city?.rival_actions || {};
  const playerLevel = Number(state?.player?.level || 1);
  const cleanMoney = Number(state?.player?.clean_money || 0);
  const ownedByType = useMemo(
    () => Object.fromEntries(Object.keys(catalog).map((key) => [key, businesses.filter((b) => b.type_key === key).length])),
    [catalog, businesses]
  );

  const playCasino = async (game) => {
    const data = await act(
      `casino-${game}`,
      "casino/play",
      { game, bet: Math.max(100, Math.min(5000, Number(bet || 0))), ...(game === "roulette" ? { choice: rouletteChoice } : {}) }
    );
    if (!data) return;
    if (game === "roulette") {
      toast(data.net >= 0
        ? `Roleta: ${data.number} ${data.color} · ${fmtMoney(data.net)} líquidos`
        : `Roleta: ${data.number} ${data.color} · ${fmtMoney(Math.abs(data.net))} perdidos`);
    } else {
      toast(data.net >= 0
        ? `Blackjack: ${data.player_value} vs ${data.dealer_value} · ${fmtMoney(data.net)} líquidos`
        : `Blackjack: ${data.player_value} vs ${data.dealer_value} · ${fmtMoney(Math.abs(data.net))} perdidos`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel w-full overflow-y-auto sm:max-w-xl" data-testid="city-panel">
        <SheetHeader>
          <PanelWatermark icon={RadioTower} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <RadioTower size={18} className="text-red-400" /> {title}
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            {description}
          </SheetDescription>
        </SheetHeader>

        {scopedTabs.length > 1 && (
          <Tabs value={tab} onValueChange={setTab} className="mt-3">
            <TabsList
              className="grid h-auto w-full gap-1"
              style={{ gridTemplateColumns: `repeat(${scopedTabs.length}, minmax(0, 1fr))` }}
            >
              {scopedTabs.map(([key, label, Icon]) => (
                <TabsTrigger key={key} value={key} className="min-w-0 gap-1 px-1 py-2 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <Icon size={11} /><span className="hidden min-[430px]:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {loading && !city ? (
          <div className="flex items-center justify-center gap-2 py-16 font-mono text-xs text-zinc-500">
            <RefreshCw size={15} className="animate-spin" /> A sincronizar a cidade…
          </div>
        ) : !city ? null : (
          <>
            {tab === "pulse" && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Card className="sub-card p-3 shadow-none">
                    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-zinc-500"><CloudRain size={11} /> Tempo</p>
                    <p className="mt-1 text-sm font-bold text-white">{world?.weather?.name}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{world?.weather?.description}</p>
                  </Card>
                  <Card className="sub-card p-3 shadow-none">
                    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-zinc-500"><Clock3 size={11} /> Período</p>
                    <p className="mt-1 text-sm font-bold text-white">{world?.daypart?.name}</p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-500">
                      Trânsito ×{Number(world?.modifiers?.travel_mult || 1).toFixed(2)} · Polícia ×{Number(world?.modifiers?.police_mult || 1).toFixed(2)}
                    </p>
                  </Card>
                </div>

                <Card className="sub-card border-amber-500/15 p-3 shadow-none">
                  <div className="flex items-start gap-2">
                    <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{world?.event?.name}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{world?.event?.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(world?.modifiers?.chance || {}).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="border-white/10 font-mono text-[10px] text-zinc-400">
                            {key} {pct(value)}
                          </Badge>
                        ))}
                        <Badge variant="outline" className="border-white/10 font-mono text-[10px] text-zinc-400">recompensa {pct((world?.modifiers?.reward_mult || 1) - 1)}</Badge>
                        <Badge variant="outline" className="border-white/10 font-mono text-[10px] text-zinc-400">calor {pct((world?.modifiers?.heat_mult || 1) - 1)}</Badge>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="sub-card p-3 shadow-none">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-white"><Clock3 size={13} className="text-sky-400" /> Calendário da cidade</p>
                  <div className="space-y-1">
                    {(city.calendar || []).slice(0, 5).map((slot) => (
                      <div key={`${slot.key}-${slot.starts_at}`} className={`flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[10px] ${slot.active ? "bg-sky-500/10 text-sky-200" : "bg-white/[0.025] text-zinc-500"}`}>
                        <span className="w-14 shrink-0">{slot.active ? "AGORA" : new Date(slot.starts_at).toLocaleTimeString("pt-PT", { hour:"2-digit", minute:"2-digit" })}</span>
                        <span className="min-w-0 flex-1 truncate">{slot.name}</span>
                        <span className="uppercase text-zinc-600">{slot.severity}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="sub-card p-3 shadow-none">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-white"><Trophy size={13} className="text-amber-400" /> Temporada {season?.number}</p>
                    <span className="font-mono text-[10px] text-zinc-500">{timeLeft(season?.remaining_s)} restantes</span>
                  </div>
                  {season?.last_reward && (
                    <div className="mb-2 rounded-md border border-amber-500/15 bg-amber-500/[0.05] px-2 py-1.5 font-mono text-[10px] text-amber-200">
                      {season.last_reward.season_id} · #{season.last_reward.rank} · +{fmtMoney(season.last_reward.clean)} · +{nfmt(season.last_reward.respect)} respeito
                    </div>
                  )}
                  <div className="space-y-1">
                    {(season?.leaderboard || []).slice(0, 8).map((row) => (
                      <div key={row.player_id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[10px] ${row.is_you ? "bg-red-500/10 text-red-200" : "bg-white/[0.025] text-zinc-400"}`}>
                        <span className="w-5 text-zinc-600">#{row.rank}</span>
                        <span className="min-w-0 flex-1 truncate">{row.org_name}</span>
                        <span className="font-bold text-zinc-200">{nfmt(row.points)} pts</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="sub-card p-3 shadow-none">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold text-white"><HeartPulse size={13} className="text-rose-400" /> Estado do chefe</p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-500">Saúde {city.boss?.health}% · Stress {city.boss?.stress}%</p>
                      {city.boss?.sentence_until && <p className="mt-1 font-mono text-[10px] text-red-300">Detido até {new Date(city.boss.sentence_until).toLocaleTimeString("pt-PT", { hour:"2-digit", minute:"2-digit" })}</p>}
                      {city.boss?.hospital_until && <p className="mt-1 font-mono text-[10px] text-amber-300">Hospital até {new Date(city.boss.hospital_until).toLocaleTimeString("pt-PT", { hour:"2-digit", minute:"2-digit" })}</p>}
                    </div>
                    {(city.boss?.hospital_until || city.boss?.sentence_until || Number(city.boss?.health || 100) < 100 || Number(city.boss?.stress || 0) >= 35) && (
                      <ActionButton
                        tone="good"
                        disabled={!!busy || cleanMoney < Number(city.boss?.recovery_cost || 0)}
                        onClick={() => act("boss-recover", "boss/recover", {}, "Chefe recuperado")}
                      >
                        Recuperar · {fmtMoney(city.boss?.recovery_cost || 0)}
                      </ActionButton>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {tab === "news" && (
              <div className="mt-3 space-y-1.5">
                {(city.news || []).map((item) => (
                  <Card key={item.id} className="sub-card p-3 shadow-none">
                    <div className="flex items-start gap-2">
                      <Newspaper size={14} className="mt-0.5 shrink-0 text-zinc-500" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">{item.headline}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{item.body}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase text-zinc-600">{item.kind} · {new Date(item.ts).toLocaleString("pt-PT")}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {tab === "rivals" && (
              <div className="mt-3 space-y-2">
                {(city.rivals || []).map((rival) => (
                  <Card key={rival.id} className="sub-card p-3 shadow-none">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{rival.name}</p>
                        <p className="font-mono text-[10px] text-zinc-500">{rival.style} · foco {rival.focus} · relação {rival.relation}</p>
                      </div>
                      <Badge variant="outline" className={`shrink-0 font-mono text-[10px] ${rival.threat >= 65 ? "border-red-500/30 text-red-300" : rival.threat >= 35 ? "border-amber-500/30 text-amber-300" : "border-emerald-500/30 text-emerald-300"}`}>
                        ameaça {rival.threat}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px] text-zinc-500">
                      <span>Poder <b className="text-zinc-300">{rival.power}</b></span>
                      <span>Hostilidade <b className="text-zinc-300">{rival.hostility}</b></span>
                      <span>Intel <b className="text-zinc-300">{rival.intel}</b></span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <ActionButton disabled={!!busy || cleanMoney < Number(rivalActions.recon?.cost || 0)} onClick={() => act(`recon-${rival.id}`, "rivals/action", { rival_id:rival.id, action:"recon" })}><Eye size={11} className="mr-1" /> Recon · {fmtMoney(rivalActions.recon?.cost || 0)}</ActionButton>
                      <ActionButton tone="danger" disabled={!!busy || cleanMoney < Number(rivalActions.sabotage?.cost || 0)} onClick={() => act(`sabotage-${rival.id}`, "rivals/action", { rival_id:rival.id, action:"sabotage" })}><Bomb size={11} className="mr-1" /> Sabotar · {fmtMoney(rivalActions.sabotage?.cost || 0)}</ActionButton>
                      <ActionButton disabled={!!busy || cleanMoney < Number(rivalActions.pressure?.cost || 0)} onClick={() => act(`pressure-${rival.id}`, "rivals/action", { rival_id:rival.id, action:"pressure" })}><TrendingUp size={11} className="mr-1" /> Pressão · {fmtMoney(rivalActions.pressure?.cost || 0)}</ActionButton>
                      <ActionButton tone="good" disabled={!!busy || cleanMoney < Number(rivalActions.truce?.cost || 0)} onClick={() => act(`truce-${rival.id}`, "rivals/action", { rival_id:rival.id, action:"truce" })}><Handshake size={11} className="mr-1" /> Trégua · {fmtMoney(rivalActions.truce?.cost || 0)}</ActionButton>
                      <ActionButton tone="good" disabled={!!busy || cleanMoney < Number(rivalActions.alliance?.cost || 0)} onClick={() => act(`alliance-${rival.id}`, "rivals/action", { rival_id:rival.id, action:"alliance" })}>Acordo · {fmtMoney(rivalActions.alliance?.cost || 0)}</ActionButton>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {tab === "business" && (
              <div className="mt-3 space-y-3">
                <Card className="sub-card p-3 shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold text-white"><Coins size={13} className="text-emerald-400" /> Caixa empresarial</p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-500">
                        {fmtMoney(city.business_totals?.unclaimed_clean)} limpos · {fmtMoney(city.business_totals?.unclaimed_dirty)} sujos · +{Number(city.business_totals?.pending_heat || 0).toFixed(1)} calor
                      </p>
                    </div>
                    <ActionButton tone="good" disabled={!!busy || businesses.length === 0} onClick={() => act("collect", "businesses/collect", {}, "Receitas recolhidas")}>
                      Recolher
                    </ActionButton>
                  </div>
                </Card>

                {businesses.length > 0 && (
                  <div className="space-y-1.5">
                    {businesses.map((b) => (
                      <Card key={b.id} className="sub-card p-3 shadow-none">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-white">{b.name} <span className="font-mono text-[10px] text-zinc-500">LV {b.level}</span></p>
                            <p className="mt-1 font-mono text-[10px] text-zinc-500">{fmtMoney(b.projection?.clean)} + {fmtMoney(b.projection?.dirty)} por recolher · segurança {b.security}</p>
                          </div>
                          {(() => {
                            const upgradeCost = Math.round(Number(b.config?.price || 0) * (.42 + Number(b.level || 1) * .18));
                            return (
                              <ActionButton
                                disabled={!!busy || b.level >= Number(b.config?.max_level || 5) || cleanMoney < upgradeCost}
                                onClick={() => act(`upgrade-${b.id}`, "businesses/upgrade", { business_id:b.id }, `${b.name} melhorado`)}
                              >
                                <ArrowUpCircle size={11} className="mr-1" />
                                {b.level >= Number(b.config?.max_level || 5) ? "Máx." : <>Melhorar · {fmtMoney(upgradeCost)}</>}
                              </ActionButton>
                            );
                          })()}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                <div>
                  <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">Expandir rede</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {Object.entries(catalog).map(([key, cfg]) => {
                      const copies = Number(ownedByType[key] || 0);
                      const estimated = Math.round(Number(cfg.price || 0) * (1 + businesses.length * .08 + copies * .12));
                      return (
                        <Card key={key} className="sub-card flex flex-col p-3 shadow-none">
                          <p className="text-xs font-bold text-white">{cfg.name}</p>
                          <p className="mt-1 min-h-8 text-[10px] leading-relaxed text-zinc-500">{cfg.description}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-zinc-400">{fmtMoney(estimated)} · N{cfg.min_level || 1}</span>
                            <ActionButton
                              disabled={!!busy || playerLevel < Number(cfg.min_level || 1) || cleanMoney < estimated}
                              onClick={() => act(`buy-${key}`, "businesses/buy", { type_key:key }, `${cfg.name} adquirido`)}
                            >
                              {playerLevel < Number(cfg.min_level || 1) ? `Nível ${cfg.min_level}` : "Comprar"}
                            </ActionButton>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === "social" && (
              <div className="mt-3 space-y-3">
                <Card className="sub-card p-3 shadow-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold text-white"><Zap size={13} className="text-red-400" /> PvP opt-in</p>
                      <p className="mt-1 text-[10px] text-zinc-500">{playerLevel < 15 ? "Desbloqueia no nível 15." : "Consentimento obrigatório · cooldown de 6h por rival · retornos decrescentes anti-farm."}</p>
                    </div>
                    <Switch checked={!!city.social?.pvp_opt_in} disabled={!!busy || playerLevel < 15} onCheckedChange={(enabled) => act("pvp", "social/pvp", { enabled })} />
                  </div>

                  {(city.social?.pvp_challenges || []).filter((c) => c.defender_id && c.status === "pending").length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">Desafios pendentes</p>
                      {(city.social?.pvp_challenges || []).filter((c) => c.status === "pending").map((challenge) => (
                        <div key={challenge.id} className="flex items-center gap-2 rounded-md bg-black/25 px-2 py-2">
                          <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-300">
                            {challenge.attacker_name} → {challenge.defender_name}
                          </span>
                          {challenge.is_incoming && (
                            <>
                              <ActionButton
                                tone="good"
                                disabled={!!busy}
                                onClick={() => act(`accept-${challenge.id}`, "social/pvp/accept", { challenge_id:challenge.id }, (d) => `Conflito resolvido: ${d.winner_name} venceu`)}
                              >
                                Aceitar
                              </ActionButton>
                              <ActionButton
                                disabled={!!busy}
                                onClick={() => act(`decline-${challenge.id}`, "social/pvp/decline", { challenge_id:challenge.id }, "Desafio recusado")}
                              >
                                Recusar
                              </ActionButton>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!!city.social?.pvp_opt_in && (city.social?.pvp_players || []).length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">Organizações disponíveis</p>
                      {(city.social?.pvp_players || []).slice(0, 8).map((player) => (
                        <div key={player.player_id} className="flex items-center gap-2 rounded-md bg-black/25 px-2 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] font-bold text-zinc-200">{player.org_name}</p>
                            <p className="font-mono text-[10px] text-zinc-600">LV {player.level} · {nfmt(player.respect)} respeito</p>
                          </div>
                          <ActionButton
                            tone="danger"
                            disabled={!!busy}
                            onClick={() => act(
                              `challenge-${player.player_id}`,
                              "social/pvp/challenge",
                              { defender_player_id:player.player_id },
                              (d) => d.winner_name ? `Conflito resolvido: ${d.winner_name} venceu` : "Desafio PvP enviado"
                            )}
                          >
                            Desafiar
                          </ActionButton>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="sub-card p-3 shadow-none">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-white"><Landmark size={13} className="text-cyan-400" /> Aliança</p>
                  {city.social?.alliance ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-white">{city.social.alliance.name}</p>
                          <p className="font-mono text-[10px] text-zinc-500">
                            Código {city.social.alliance.code} · {nfmt(city.social.alliance.season_points || 0)} pts época · {(city.social.alliance.members || []).length} membros
                          </p>
                        </div>
                        <ActionButton
                          tone="danger"
                          disabled={!!busy || (!!city.social.alliance.is_leader && (city.social.alliance.members || []).length > 1)}
                          onClick={() => act("alliance-leave", "social/alliance/leave", {}, "Saíste da aliança")}
                        >
                          {!!city.social.alliance.is_leader && (city.social.alliance.members || []).length > 1 ? "Transfere liderança" : "Sair"}
                        </ActionButton>
                      </div>

                      {(city.social.alliance.members || []).length > 0 && (
                        <div className="space-y-1 border-t border-white/[0.06] pt-2">
                          {(city.social.alliance.members || []).map((member) => (
                            <div key={member.player_id} className="flex items-center gap-2 rounded-md bg-black/25 px-2 py-1.5">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[10px] font-bold text-zinc-200">
                                  {member.org_name}{member.is_you ? " · tu" : ""}
                                </p>
                                <p className="font-mono text-[10px] text-zinc-600">
                                  N{member.level} · {nfmt(member.respect)} respeito {member.is_leader ? "· líder" : ""}
                                </p>
                              </div>
                              {!!city.social.alliance.is_leader && !member.is_you && (
                                <div className="flex gap-1">
                                  <ActionButton
                                    disabled={!!busy}
                                    onClick={() => act(
                                      `alliance-transfer-${member.player_id}`,
                                      "social/alliance/transfer",
                                      { player_id:member.player_id },
                                      `Liderança transferida para ${member.org_name}`
                                    )}
                                  >
                                    Liderar
                                  </ActionButton>
                                  <ActionButton
                                    tone="danger"
                                    disabled={!!busy}
                                    onClick={() => act(
                                      `alliance-kick-${member.player_id}`,
                                      "social/alliance/kick",
                                      { player_id:member.player_id },
                                      `${member.org_name} removida da aliança`
                                    )}
                                  >
                                    Expulsar
                                  </ActionButton>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <Input value={allianceName} onChange={(e) => setAllianceName(e.target.value)} placeholder="Nome da nova aliança" size="compact" />
                        <ActionButton disabled={!!busy || allianceName.trim().length < 3} onClick={async () => { const d=await act("alliance-create","social/alliance/create",{name:allianceName.trim()},"Aliança criada"); if(d)setAllianceName(""); }}>Criar</ActionButton>
                      </div>
                      <div className="flex gap-2">
                        <Input value={allianceCode} onChange={(e) => setAllianceCode(e.target.value.toUpperCase())} maxLength={12} placeholder="Código de convite" size="compact" className="font-mono uppercase" />
                        <ActionButton disabled={!!busy || allianceCode.trim().length < 4} onClick={async () => { const d=await act("alliance-join","social/alliance/join",{code:allianceCode.trim()},"Entraste na aliança"); if(d)setAllianceCode(""); }}>Entrar</ActionButton>
                      </div>
                    </div>
                  )}
                </Card>

                {(city.social?.alliance_leaderboard || []).length > 0 && (
                  <Card className="sub-card p-3 shadow-none">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-white"><Trophy size={13} className="text-amber-400" /> Classificação de alianças</p>
                    <div className="mt-2 space-y-1">
                      {(city.social.alliance_leaderboard || []).slice(0, 10).map((row, index) => (
                        <div key={row.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[10px] ${row.is_yours ? "bg-cyan-500/10 text-cyan-200" : "bg-black/20 text-zinc-400"}`}>
                          <span className="w-5 text-zinc-600">#{index + 1}</span>
                          <span className="min-w-0 flex-1 truncate">{row.name}</span>
                          <span>{row.members} membros</span>
                          <span className="font-bold text-zinc-200">{nfmt(row.points)} pts</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <Card className="sub-card p-3 shadow-none">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-white"><MessageCircle size={13} className="text-sky-400" /> Frequência da cidade</p>
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-md bg-black/25 p-2">
                    {(city.social?.chat || []).map((m) => {
                      const own = String(m.player_id || "") === String(state?.player?.id || "");
                      return (
                        <div key={m.id} className="group flex items-start gap-1 rounded px-1 py-0.5 hover:bg-white/[0.03]">
                          <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-zinc-400">
                            <b className="text-zinc-200">{m.org_name}:</b> {m.message}
                          </p>
                          {!own && m.player_id && (
                            <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                              <Button variant="bare" size="bare"
                                type="button"
                                title="Denunciar mensagem"
                                aria-label="Denunciar mensagem"
                                disabled={!!busy}
                                onClick={() => act(`report-${m.id}`, "social/chat/report", {
                                  message_id:m.id,
                                  reason:"Conteúdo impróprio, abusivo ou contrário às regras",
                                }, "Mensagem denunciada")}
                                className="rounded p-1 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                              >
                                <Flag size={10} />
                              </Button>
                              <Button variant="bare" size="bare"
                                type="button"
                                title="Bloquear organização"
                                aria-label="Bloquear organização"
                                disabled={!!busy}
                                onClick={() => act(`block-${m.player_id}`, "social/chat/block", {
                                  player_id:m.player_id,
                                  blocked:true,
                                }, `${m.org_name} foi bloqueada no chat`)}
                                className="rounded p-1 text-zinc-600 hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-30"
                              >
                                <UserX size={10} />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input value={chat} onChange={(e) => setChat(e.target.value)} maxLength={280} placeholder="Mensagem…" size="compact" />
                    <Button size="iconCompact" variant="outline" disabled={!!busy || !chat.trim()} onClick={async () => { const d=await act("chat","social/chat",{message:chat.trim()}); if(d)setChat(""); }}><Send size={12} /></Button>
                  </div>
                </Card>

                <Card className="sub-card p-3 shadow-none">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-white"><Dices size={13} className="text-amber-400" /> Casino clandestino</p>
                  <p className="mt-1 text-[10px] text-zinc-500">Apostas entre 100 € e 5 000 € usando apenas dinheiro do jogo.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Input type="number" min={100} max={5000} value={bet} onChange={(e) => setBet(e.target.value)} size="compact" className="w-28" />
                    <Select value={rouletteChoice} onValueChange={setRouletteChoice}>
                      <SelectTrigger size="compact" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="red">Vermelho</SelectItem>
                        <SelectItem value="black">Preto</SelectItem>
                        <SelectItem value="green">Zero</SelectItem>
                      </SelectContent>
                    </Select>
                    <ActionButton disabled={!!busy} onClick={() => playCasino("roulette")}>Roleta</ActionButton>
                    <ActionButton disabled={!!busy} onClick={() => playCasino("blackjack")}>Blackjack</ActionButton>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
