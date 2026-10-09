import { useMemo } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, Banknote, Bell, BrainCircuit,
  CarFront, ChevronRight, CircleDot, Coins, Crosshair, Crown, Flame,
  Gauge, Landmark, LayoutDashboard, MapPinned, Radio, Search, Settings2,
  ShieldAlert, Skull, Swords, Target, TrendingUp, Users, Warehouse, Zap,
} from "lucide-react";

/**
 * SUBMUNDO / BLACKLIST
 * Presentation-only command surface. All data comes from the canonical game
 * state; every action delegates to GamePage, the sole navigation owner.
 */
const euro = (amount) => new Intl.NumberFormat("pt-PT", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
}).format(Number(amount) || 0);

const number = (amount) => new Intl.NumberFormat("pt-PT", {
  maximumFractionDigits: 0,
}).format(Number(amount) || 0);

const prettyDate = (iso) => {
  if (!iso) return "AGORA";
  const value = new Date(iso);
  return Number.isNaN(value.valueOf())
    ? "AGORA"
    : value.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
};

const navigation = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard, special: true },
  { id: "map", label: "Mapa tático", icon: MapPinned },
  { id: "operations", label: "Operações", icon: Crosshair },
  { id: "opscenter", label: "Central de despacho", icon: Radio },
  { id: "teams", label: "Equipas", icon: Users },
  { id: "employees", label: "Operacionais", icon: Skull },
  { id: "fleet", label: "Frota", icon: CarFront },
  { id: "weapons", label: "Arsenal", icon: Swords },
  { id: "empire", label: "Finanças", icon: Banknote },
  { id: "properties", label: "Propriedades", icon: Warehouse },
  { id: "world", label: "Cidade viva", icon: Target },
  { id: "mastermind", label: "Grandes golpes", icon: Crown, minLevel: 10 },
  { id: "intel", label: "Inteligência", icon: BrainCircuit },
  { id: "settings", label: "Definições", icon: Settings2 },
];

export function NoirCommandRail({
  onDashboard, onMap, onNavigate, onSearch, currentPanel,
  deckOpen, level = 1, alerts = 0, orgName = "",
}) {
  return (
    <aside className="noir-command-rail" aria-label="Navegação do império" data-testid="noir-command-rail">
      <button
        type="button" className="noir-rail-brand"
        aria-label="Abrir centro de comando" onClick={onDashboard}
      >
        <span className="noir-rail-crest"><Crown size={25} strokeWidth={1.7} /></span>
        <span className="noir-rail-wordmark">SUB<span>MUNDO</span><small>BLACKLIST / 01</small></span>
      </button>
      <div className="noir-rail-org" title={orgName}>
        <div className="noir-rail-org-symbol"><Skull size={15} /></div>
        <div className="noir-rail-org-copy">
          <span>ORGANIZAÇÃO</span>
          <strong>{orgName || "O TEU IMPÉRIO"}</strong>
        </div>
        <span className="noir-rail-org-level">{String(level).padStart(2, "0")}</span>
      </div>
      <nav className="noir-rail-nav" aria-label="Destinos principais">
        {navigation.map((item, index) => {
          const active = item.id === "dashboard" ? deckOpen : (
            item.id === "map" ? !deckOpen && !currentPanel : currentPanel === item.id
          );
          const locked = Boolean(item.minLevel && Number(level) < item.minLevel);
          const Icon = item.icon;
          return (
            <div key={item.id}>
              {(index === 2 || index === 4 || index === 8 || index === 12) && (
                <div className="noir-rail-divider" aria-hidden="true" />
              )}
              <button
                className={`noir-rail-link ${active ? "is-active" : ""}`}
                type="button"
                aria-current={active ? "page" : undefined}
                disabled={locked}
                title={locked ? `Desbloqueia no nível ${item.minLevel}` : item.label}
                onClick={item.id === "dashboard" ? onDashboard : item.id === "map" ? onMap : () => onNavigate(item.id)}
              >
                <Icon size={17} strokeWidth={1.85} />
                <span>{item.label}</span>
                {item.id === "operations" && alerts > 0 && <i aria-label={`${alerts} alertas`}>{alerts}</i>}
                {locked && <small>NV {item.minLevel}</small>}
              </button>
            </div>
          );
        })}
      </nav>
      <button type="button" className="noir-rail-search" onClick={onSearch}>
        <Search size={17} />
        <span>LOCALIZAR SISTEMA</span>
        <kbd>⌕</kbd>
      </button>
      <div className="noir-rail-footer"><span className="noir-signal-dot" /> SISTEMA OPERACIONAL <span>© SUBMUNDO</span></div>
    </aside>
  );
}

export function NoirMobileBrand({ onDashboard, deckOpen, orgName, onSearch }) {
  return (
    <div className="noir-mobile-brand">
      <button className="noir-mobile-brand-main" type="button" onClick={onDashboard}
        aria-current={deckOpen ? "page" : undefined} data-testid="noir-mobile-home">
        <span className="noir-mobile-brand-mark"><Crown size={18} /></span>
        <span className="noir-mobile-brand-type"><b>SUBMUNDO</b><small>COMMAND / CENTRAL</small></span>
      </button>
      <span className="noir-mobile-online"><span className="noir-signal-dot" /> {orgName || "ONLINE"}</span>
      <button className="noir-mobile-search" type="button" aria-label="Pesquisar sistemas" onClick={onSearch}><Search size={19} /></button>
    </div>
  );
}

const Metric = ({ icon: Icon, label, value, detail, tone = "neutral", progress }) => (
  <div className={`noir-metric noir-metric--${tone}`}>
    <div className="noir-metric-top">
      <span className="noir-metric-symbol"><Icon size={17} strokeWidth={1.8} /></span>
      <span className="noir-metric-barcode" aria-hidden="true">///</span>
    </div>
    <span className="noir-metric-label">{label}</span>
    <strong className="noir-metric-value">{value}</strong>
    <span className="noir-metric-detail">{detail}</span>
    {typeof progress === "number" && (
      <div className="noir-metric-progress" role="progressbar" aria-label={label} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </div>
    )}
  </div>
);

const ModuleHeading = ({ eyebrow, title, action, onAction }) => (
  <div className="noir-module-heading">
    <div><span className="noir-overline">{eyebrow}</span><h2>{title}</h2></div>
    {onAction && <button type="button" onClick={onAction}>{action || "ABRIR"} <ArrowUpRight size={15} /></button>}
  </div>
);

const MissionPhase = ({ phase }) => {
  const labels = {
    en_route: "EM TRÂNSITO", operating: "EM EXECUÇÃO",
    returning: "A REGRESSAR", done: "CONCLUÍDA",
  };
  return <span className={`noir-phase noir-phase--${phase || "idle"}`}><span className="noir-signal-dot" />{labels[phase] || "EM CURSO"}</span>;
};

export function NoirCommandDeck({
  state, serverNow, onNavigate, onMap, onSelectOpp, onSearch,
  alerts = 0, realtimeConnected = false,
}) {
  const player = state?.player || {};
  const level = Number(player.level || 1);
  const heat = Number(player.heat || 0);
  const rawMissions = state?.missions || [];
  const missions = useMemo(() => rawMissions.filter((m) => m.phase !== "done"), [rawMissions]);
  const available = useMemo(
    () => (state?.opportunities || []).filter((o) =>
      o.status === "active" && Number(o.min_level || 1) <= level
    ).slice(0, 3),
    [state?.opportunities, level],
  );
  const events = useMemo(() => (state?.events || []).slice(0, 5), [state?.events]);
  const crewReady = (state?.teams || []).filter((t) => t.status === "idle").length;
  const territories = player.territories && typeof player.territories === "object"
    ? Object.keys(player.territories).length : 0;
  const policeLabel = heat >= 80 ? "RISCO EXTREMO" : heat >= 60 ? "VIGILÂNCIA INTENSA"
    : heat >= 35 ? "SOB OBSERVAÇÃO" : "SITUAÇÃO ESTÁVEL";

  return (
    <main className="noir-command-deck" data-testid="noir-command-deck" aria-label="Centro de comando da organização">
      <div className="noir-deck-content">
        <header className="noir-deck-topline">
          <div className="noir-deck-breadcrumb"><CircleDot size={12} /> SUBMUNDO <ChevronRight size={12} /> COMMAND CENTER <span>/</span> <b>VISÃO GERAL</b></div>
          <div className="noir-deck-signal"><span className="noir-signal-dot" /> {realtimeConnected ? "REDE EM DIRETO" : "SISTEMA OPERACIONAL"} <span className="noir-deck-topline-separator" /> PORTUGAL / PT</div>
        </header>

        <section className="noir-hero" aria-labelledby="noir-command-title">
          <div className="noir-hero-aura" aria-hidden="true" />
          <div className="noir-hero-watermark" aria-hidden="true">S</div>
          <div className="noir-hero-main">
            <div className="noir-hero-kicker"><span className="noir-hero-kicker-line" /> BEM-VINDO AO TEU DOMÍNIO <span>— 01 / CENTRAL</span></div>
            <h1 id="noir-command-title">O PODER <span>NÃO SE PEDE.</span><br />CONQUISTA-SE.</h1>
            <p>O teu império criminal, numa única central. Controla a cidade, coordena as tuas equipas e transforma cada oportunidade em influência.</p>
            <div className="noir-hero-actions">
              <button type="button" className="noir-button-primary" onClick={() => onNavigate("operations")}>
                <Crosshair size={18} /> PLANEAR OPERAÇÃO <ArrowUpRight size={16} />
              </button>
              <button type="button" className="noir-button-outline" onClick={onMap}>
                <MapPinned size={17} /> EXPLORAR MAPA <ArrowRight size={16} />
              </button>
            </div>
          </div>
          <div className="noir-hero-identity">
            <span>FICHA DE ORGANIZAÇÃO / 001</span>
            <div className="noir-hero-identity-crest"><Crown size={38} strokeWidth={1.4}/></div>
            <strong>{player.org_name || "ORGANIZAÇÃO"}</strong>
            <div><small>CLASSIFICAÇÃO</small><b>NÍVEL {String(level).padStart(2, "0")}</b></div>
            <div><small>CONTROLO TERRITORIAL</small><b>{territories} ZONAS</b></div>
            <span className="noir-hero-identity-seal">ACESSO AUTORIZADO ◆ SUBMUNDO</span>
          </div>
          <div className="noir-hero-bottom"><span>SYS://SUBMUNDO/ORGANIZAÇÃO/{String(level).padStart(2, "0")}</span><span><span className="noir-signal-dot" /> TODOS OS SISTEMAS MONITORIZADOS</span></div>
        </section>

        <section className="noir-metrics" aria-label="Indicadores do império">
          <Metric icon={Banknote} label="CAPITAL DISPONÍVEL" value={euro(player.clean_money)} detail="FINANÇAS / DINHEIRO LIMPO" tone="money" />
          <Metric icon={Coins} label="FUNDOS NÃO DECLARADOS" value={euro(player.dirty_money)} detail="ATIVOS / DINHEIRO SUJO" tone="dirty" />
          <Metric icon={TrendingUp} label="RESPEITO" value={number(player.respect)} detail={`PROGRESSÃO / NÍVEL ${level}`} tone="respect" />
          <Metric icon={Flame} label="PRESSÃO POLICIAL" value={`${Math.round(heat)}%`} detail={policeLabel} tone="heat" progress={heat} />
        </section>

        <div className="noir-deck-grid">
          <div className="noir-deck-maincol">
            <section className="noir-panel noir-operations-panel">
              <ModuleHeading eyebrow="01 / INTEL OPERACIONAL" title="ALVOS DISPONÍVEIS" action="VER TODAS" onAction={() => onNavigate("operations")} />
              <div className="noir-ops-list">
                {available.length ? available.map((opp, i) => (
                  <button type="button" className="noir-op-row" key={opp.id} onClick={() => onSelectOpp(opp)}
                    aria-label={`Analisar ${opp.name}, recompensa ${euro(opp.reward)}`}>
                    <span className="noir-op-index">{String(i + 1).padStart(2, "0")}</span>
                    <span className="noir-op-info">
                      <strong>{opp.name || "OPERAÇÃO CONFIDENCIAL"}</strong>
                      <small><Target size={12} /> {opp.district || "Portugal"} <i /> {opp.category || "OPERAÇÃO"}</small>
                    </span>
                    <span className="noir-op-risk"><small>RISCO</small><b>{Number(opp.risk || 0)}/10</b></span>
                    <span className="noir-op-reward"><small>RECOMPENSA</small><b>{euro(opp.reward)}</b></span>
                    <ArrowUpRight className="noir-op-arrow" size={18} />
                  </button>
                )) : (
                  <div className="noir-empty"><Crosshair size={25} /><strong>SEM OPERAÇÕES DISPONÍVEIS</strong><p>O próximo conjunto de oportunidades surgirá na cidade.</p><button type="button" onClick={onMap}>VER MAPA <ArrowRight size={14}/></button></div>
                )}
              </div>
              <div className="noir-module-footer"><span><Zap size={14} /> {available.length} ALVOS EM ANÁLISE</span><span>INTEL ACTUALIZADA PELO SERVIDOR</span></div>
            </section>

            <section className="noir-panel noir-live-panel">
              <ModuleHeading eyebrow="02 / ESTADO EM TEMPO REAL" title="OPERAÇÕES EM CURSO" action="ABRIR CENTRAL" onAction={() => onNavigate("opscenter")} />
              {missions.length ? missions.slice(0, 3).map((mission) => (
                <div className="noir-live-row" key={mission.id}>
                  <div className="noir-live-icon"><Radio size={21}/></div>
                  <div className="noir-live-content"><strong>{mission.opportunity?.name || mission.team_name || "OPERAÇÃO"}</strong><small>{mission.team_name || "EQUIPA"} / {mission.opportunity?.district || "PORTUGAL"}</small></div>
                  <div className="noir-live-right"><MissionPhase phase={mission.phase}/><small>RETORNO {prettyDate(mission.return_at)}</small></div>
                </div>
              )) : (
                <div className="noir-live-empty"><span className="noir-radar"><Radio size={20}/></span><div><strong>NENHUMA EQUIPA NO TERRENO</strong><p>A central está à espera de uma nova ordem de despacho.</p></div><button type="button" onClick={() => onNavigate("teams")}>EQUIPAS <ChevronRight size={15}/></button></div>
              )}
              <div className="noir-live-footnote"><span className="noir-signal-dot" /> LIGAÇÃO À CENTRAL OPERACIONAL <b>{missions.length} ATIVAS</b></div>
            </section>

            <section className="noir-panel noir-actions-panel">
              <ModuleHeading eyebrow="03 / ATALHOS DO IMPÉRIO" title="CENTRAL DE COMANDO" />
              <div className="noir-shortcuts">
                {[
                  { icon: Users, label: "AS TUAS EQUIPAS", sub: "PESSOAL E PRONTIDÃO", panel: "teams" },
                  { icon: CarFront, label: "FROTA E LOGÍSTICA", sub: "VIATURAS E MANUTENÇÃO", panel: "fleet" },
                  { icon: Swords, label: "O TEU ARSENAL", sub: "EQUIPAMENTO E RECURSOS", panel: "weapons" },
                  { icon: Landmark, label: "FINANÇAS", sub: "CONTROLO DE CAPITAL", panel: "empire" },
                ].map(({ icon: Icon, label, sub, panel }) => (
                  <button className="noir-shortcut" key={panel} type="button" onClick={() => onNavigate(panel)}>
                    <Icon size={23} strokeWidth={1.55} /><span><strong>{label}</strong><small>{sub}</small></span><ArrowUpRight size={16}/>
                  </button>
                ))}
              </div>
            </section>
          </div>
          <aside className="noir-deck-sidecol" aria-label="Inteligência e estado">
            <section className="noir-panel noir-threat-panel">
              <div className="noir-threat-top"><span className="noir-overline">SITUAÇÃO / POLÍCIA</span><ShieldAlert size={21}/></div>
              <div className="noir-threat-number">{Math.round(heat)}<span>%</span></div>
              <strong>{policeLabel}</strong>
              <div className="noir-threat-meter" role="progressbar" aria-label="Pressão policial" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0,Math.min(100,heat))}><i style={{ width: `${Math.max(0, Math.min(100, heat))}%` }}/></div>
              <p>{heat >= 60 ? "A atenção das autoridades está elevada. Avalia os riscos antes de agir." : "A atividade atual mantém uma pressão controlada. Continua atento à evolução."}</p>
              <button type="button" onClick={() => onNavigate("empire")}>GERIR EXPOSIÇÃO <ArrowUpRight size={15}/></button>
            </section>

            <section className="noir-panel noir-intel-panel">
              <ModuleHeading eyebrow="04 / TRANSMISSÕES" title="REDE DE INFORMAÇÃO" action="TODOS" onAction={() => onNavigate("intel")} />
              <div className="noir-intel-list">
                {events.length ? events.map((event, i) => (
                  <div className="noir-intel-row" key={event.id || i}>
                    <div className="noir-intel-node"><span /></div>
                    <div><span className="noir-intel-kind">{event.kind || "SISTEMA"} <span>{prettyDate(event.ts)}</span></span><p>{event.message || "Nova atividade registada na organização."}</p></div>
                  </div>
                )) : (
                  <div className="noir-intel-quiet"><Bell size={19}/><p>Sem ocorrências recentes. A rede mantém-se silenciosa.</p></div>
                )}
              </div>
            </section>

            <section className="noir-panel noir-status-panel">
              <span className="noir-overline">INVENTÁRIO / EFETIVOS</span>
              <div><span><Users size={16}/> EQUIPAS DISPONÍVEIS</span><b>{crewReady} / {(state?.teams || []).length}</b></div>
              <div><span><CarFront size={16}/> VEÍCULOS</span><b>{(state?.vehicles || []).length}</b></div>
              <div><span><Warehouse size={16}/> PROPRIEDADES</span><b>{(state?.properties || []).length}</b></div>
              <div><span><Gauge size={16}/> ATENÇÃO NECESSÁRIA</span><b>{alerts}</b></div>
              <button type="button" onClick={onSearch}>EXPLORAR SISTEMAS <Search size={15}/></button>
            </section>
          </aside>
        </div>
        <footer className="noir-deck-footer"><span>SUBMUNDO / COMANDO E CONTROLO</span><span>O IMPÉRIO NÃO DORME. <span>◆</span> PORTUGAL</span></footer>
      </div>
    </main>
  );
}
