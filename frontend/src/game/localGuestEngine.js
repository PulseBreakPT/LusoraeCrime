import { LOCAL_CATALOG, LOCAL_GUEST_SAVE_VERSION } from "./localGuestCatalog";
import { propertyMarketPrice } from "../lib/propertyMarket";
import { ensureLocalCity, advanceLocalCity, handleLocalCityRequest, localCityWorld, localBusinessChance, localBossLeadership } from "./livingCity";
import { guardReward, passivePortfolioScale } from "./economyDirector";

const MODE_KEY = "submundo_guest_mode_v2";
const SAVE_KEY = "submundo_guest_save_v2";
const SESSION_KEY = "submundo_guest_session_v2";
const OFFLINE_SIMULATION_MAX_S = 28 * 24 * 3600;
const OFFLINE_PAYROLL_MAX_CYCLES = 5;

const clone = (v) => JSON.parse(JSON.stringify(v));
const nowIso = () => new Date().toISOString();
const uid = (prefix = "id") =>
  `${prefix}_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const money = (n) => Math.max(0, Math.round(Number(n) || 0));

const lisbonFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone:"Europe/Lisbon", year:"numeric", month:"2-digit", day:"2-digit",
  hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23",
});
const lisbonParts = (date) => Object.fromEntries(
  lisbonFormatter.formatToParts(date)
    .filter((p)=>p.type!=="literal")
    .map((p)=>[p.type,Number(p.value)])
);
const lisbonOffsetMs = (date) => {
  const p=lisbonParts(date);
  return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-date.getTime();
};
const lisbonWallToUtc = (wallMs) => {
  let utc=wallMs-lisbonOffsetMs(new Date(wallMs));
  utc=wallMs-lisbonOffsetMs(new Date(utc));
  return new Date(utc);
};
const nextWeeklySettlementIso = (from=Date.now()) => {
  const current=new Date(from);
  const p=lisbonParts(current);
  const localDay=new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay();
  let days=(1-localDay+7)%7; // Monday
  if(days===0 && (p.hour>20 || (p.hour===20 && (p.minute>0 || p.second>0)))) days=7;
  if(days===0 && p.hour===20 && p.minute===0 && p.second===0) days=7;
  const wall=Date.UTC(p.year,p.month-1,p.day+days,20,0,0);
  return lisbonWallToUtc(wall).toISOString();
};
const isMonday20Lisbon = (value) => {
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return false;
  const p=lisbonParts(d);
  const day=new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay();
  return day===1 && p.hour===20 && p.minute===0;
};

const normalizeRisk = (value) => {
  const n = Number(value) || 1;
  // v1 do modo convidado gravava uma pseudo-percentagem (29/40/51/62)
  // onde toda a UI do SUBMUNDO espera uma escala ordinal de 1 a 5.
  if (n > 5) return clamp(Math.round((n - 18) / 11), 1, 5);
  return clamp(Math.round(n), 1, 5);
};

const normalizeSavedRisk = (save) => {
  for (const collection of ["opportunities", "missions", "history"]) {
    for (const item of save[collection] || []) {
      item.risk = normalizeRisk(item.risk);
      if (item.opportunity?.risk != null) {
        item.opportunity.risk = normalizeRisk(item.opportunity.risk);
      }
    }
  }
  return save;
};

const fail = (status, detail) => {
  const error = new Error(detail);
  error.response = { status, data: { detail } };
  throw error;
};

const parseBody = (payload) => {
  if (payload == null) return {};
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch (_e) { return {}; }
  }
  return payload;
};

const rankThresholds = LOCAL_CATALOG.level_thresholds || [0, 400, 1200, 2800, 5500, 9500, 15000, 22000, 31000, 42000];
const levelForRespect = (respect) => {
  let level = 1;
  rankThresholds.forEach((threshold, index) => {
    if (respect >= threshold) level = index + 1;
  });
  return level;
};

const attrsFor = (role) => {
  const base = { forca:4, inteligencia:4, discricao:4, conducao:4, tiro:4, hack:4, negociacao:4, sangue_frio:4, resistencia:4 };
  const sp = LOCAL_CATALOG.specializations[role];
  (sp?.attrs || []).forEach((key, index) => { base[key] = 7 - Math.min(index, 2); });
  return base;
};

const makeEmployee = (role, teamId = null, index = 0) => {
  const sp = LOCAL_CATALOG.specializations[role] || LOCAL_CATALOG.specializations.assaltante;
  const names = ["Rui Matos","Inês Rocha","Diogo Nunes","Marta Reis","Tiago Neves","Sara Lopes","André Costa","Leonor Dias","Miguel Pires","Beatriz Ramos"];
  return {
    id: uid("emp"), name: names[index % names.length], role_key: role, spec: sp.spec,
    rarity: "comum", rank: "recruta", level: 1, xp: 0, age: 24 + (index * 3) % 18,
    salary: sp.salary, loyalty: 72, morale: 74, fatigue: 0, attrs: attrsFor(role),
    talents: [], team_id: teamId, weapon_id: null, status: "idle", status_until: null,
    history: [], betrayal_risk: 0.04,
  };
};

const makeCandidate = (role, index = 0) => {
  const e = makeEmployee(role, null, index + 4);
  return {
    ...e, id: uid("cand"), cost: 2200 + index * 650, min_respect: index * 150,
    source: ["rua","bares","empresas","contactos"][index % 4],
  };
};

const makeVehicle = (modelKey, teamId = null) => {
  const model = LOCAL_CATALOG.vehicle_models[modelKey] || LOCAL_CATALOG.vehicle_models.usado;
  return {
    id: uid("veh"), name: model.name, model_key: modelKey, team_id: teamId, property_id: null,
    price: model.price, speed: model.speed, condition: 100, fuel_type: model.fuel_type,
    tank_l: model.tank_l, fuel_l: model.tank_l, cons: model.cons, km: 0,
    status: "idle", transfer: null, refueling_until: null,
    paint_key: null,
  };
};

const makeTeam = () => ({
  id: uid("team"), name: "Crew Alfa", spec: "assalto", status: "idle", vehicle_id: null,
  missions_done: 0, streak: 0, category_missions: {}, roster_missions: 0,
  last_type_key: null, last_type_at: null, repeat_type_count: 0,
  available_at: null, roster_stable_since: nowIso(), emblem_key: null,
});

const makeDistricts = (lat, lng) => {
  const labels = ["Centro","Norte","Sul","Este","Oeste","Industrial","Ribeirinha","Comercial","Residencial","Antiga","Portuária","Serra","Baixa","Alta","Parque","Periferia"];
  return labels.map((label, i) => {
    const ring = i < 5 ? 0.012 : i < 11 ? 0.026 : 0.045;
    const angle = (Math.PI * 2 * i) / labels.length + 0.25;
    return {
      key: `d${i + 1}`, name: `${label} ${i + 1}`,
      lat: lat + Math.sin(angle) * ring, lng: lng + Math.cos(angle) * ring,
      named: true,
    };
  });
};

const oppTypes = Object.entries(LOCAL_CATALOG.opportunity_types);

const OPERATION_PROFILE_LABELS = {
  confrontation:"Confronto", mobility:"Mobilidade", digital:"Digital", stealth:"Furtivo", influence:"Influência",
};
const OPERATION_PROFILE_RULES = [
  ["digital",["hack","ciber","phishing","cartoes","dados","ddos","cript","servidor","semafor"]],
  ["mobility",["transporte","entrega","rota","carga","contrabando","porto","frota"]],
  ["stealth",["infiltr","fantasma","vigilancia","espion","encoberta","obra_arte","museu"]],
  ["influence",["suborno","chantag","acordo","imprensa","protecao","boato","diplomat","leilao"]],
  ["confrontation",["assalto","roubo","emboscada","guerra","sequestro","resgate","assassinato","ataque"]],
];
const operationProfileOf = (typeKey, category) => {
  const key=String(typeKey||"").toLowerCase();
  for(const [profile,tokens] of OPERATION_PROFILE_RULES){
    if(tokens.some((token)=>key.includes(token))) return profile;
  }
  return {assalto:"confrontation",logistica:"mobility",tecnica:"digital",influencia:"influence",especial:"stealth"}[category]||"confrontation";
};
const operationProfileEffect = (save, opp, members, vehicle) => {
  const profile=opp.profile||operationProfileOf(opp.type_key,opp.category);
  const roleSets={
    digital:new Set(["hacker","criptografo","engenheiro_social","falsificador"]),
    mobility:new Set(["motorista","piloto","estafeta","contrabandista"]),
    stealth:new Set(["espiao","arrombador","falsificador","informador"]),
    influence:new Set(["negociador","advogado","chantagista","relacoes_publicas","informador"]),
    confrontation:new Set(["assaltante","seguranca","franco_atirador","arrombador"]),
  };
  const attrSets={digital:["hack","inteligencia"],mobility:["conducao","discricao"],stealth:["discricao","sangue_frio"],influence:["negociacao","sangue_frio"],confrontation:["tiro","forca"]};
  const attrs=attrSets[profile]||["sangue_frio"];
  const values=members.flatMap((m)=>attrs.map((a)=>Number(m.attrs?.[a]||0)));
  const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  const specialist=members.some((m)=>roleSets[profile]?.has(m.role_key));
  let delta=(avg-5)*.007+(specialist?.025:-.012);
  const model=LOCAL_CATALOG.vehicle_models[vehicle?.model_key]||{};
  if(profile==="stealth"){
    if(Number(model.discretion||50)>=70) delta+=.015;
    const loud=members.some((m)=>{
      const w=(save.weapons||[]).find((x)=>x.id===m.weapon_id);
      return w && LOCAL_CATALOG.weapon_models[w.model_key]?.loud;
    });
    if(loud) delta-=.02;
  }else if(profile==="mobility"){
    delta+=clamp((Number(vehicle?.condition??100)-70)/1500,-.015,.02);
  }else if(profile==="confrontation"&&members.length){
    const armed=members.filter((m)=>m.weapon_id).length;
    delta+=(armed/members.length-.5)*.025;
  }
  return {profile,label:OPERATION_PROFILE_LABELS[profile]||profile,delta:clamp(delta,-.06,.07)};
};

const shuffle = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const geoDistanceKm = (a, b) => {
  if (!a || !b) return 0;
  const lat1 = Number(a.lat), lng1 = Number(a.lng), lat2 = Number(b.lat), lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return 0;
  const r = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
};

const missionRewardForOpportunity = (save, risk, category, distKm, rare, seedIndex = 0) => {
  const meta = LOCAL_CATALOG.economy_meta?.mission_rewards || {};
  const base = Number(meta.base_by_risk?.[risk] || 2500);
  const orgLevel = Math.max(1, Math.min(100, Number(save.player.level || 1)));
  const earlyLevel = Math.min(10, orgLevel);
  const levelMult = 1
    + Math.max(0, earlyLevel - 1) * (meta.org_level_per_level || 0.12)
    + Math.max(0, orgLevel - 10) * (meta.org_level_late || 0.018);
  const categoryMult = Number(meta.category_mult?.[category] || 1);
  const distanceMult = 1 + Math.min(0.25, Math.max(0, Number(distKm) || 0) * 0.02);
  const rareMult = rare ? Number(meta.rare_mult || 1.6) : 1;
  const variation = 0.92 + ((seedIndex * 7) % 17) / 100;
  const raw = base * levelMult * categoryMult * distanceMult * rareMult * variation;
  const rounded = Math.round(raw / 100) * 100;
  const lateLevels = Math.max(0, Math.min(100, orgLevel) - 10);
  const rewardCap = Number(meta.max || 90000) + lateLevels * Number(meta.max_late_per_level || 2500);
  return Math.max(Number(meta.min || 1500), guardReward(clamp(rounded, Number(meta.min || 1500), rewardCap), orgLevel, "operation"));
};

const makeOpportunities = (save, count = 5) => {
  if (!save.player.hq) return [];
  const districts = (save.player.districts || []).filter((d) => isFiniteGeoPoint(d));
  const now = Date.now();
  const level = Number(save.player.level || 1);
  const eligibleTypes = oppTypes.filter(([, cfg]) => Number(cfg.min_level || 1) <= level);
  if (!eligibleTypes.length) return [];

  const amount = Math.min(5, Math.max(0, count));
  const active = (save.opportunities || []).filter((o) => o.status === "active");
  const activeTypes = new Set(active.map((o) => o.type_key).filter(Boolean));
  const activeDistricts = new Set(active.map((o) => o.district_key || o.district).filter(Boolean));
  const recentTypes = [...(save.player.recent_spawn_type_keys || [])].slice(-12);
  const recentDistricts = [...(save.player.recent_spawn_district_keys || [])].slice(-12);

  const typePool = shuffle(eligibleTypes);
  const districtPool = shuffle(districts.length ? districts : [save.player.hq]);
  const generatedTypes = [];
  const generatedDistricts = [];
  const generated = [];
  const reservedPoints = active
    .filter((o) => isFiniteGeoPoint(o))
    .map((o) => ({ lat: Number(o.lat), lng: Number(o.lng) }));

  const pickType = () => {
    const used = new Set(generatedTypes);
    const fresh = typePool.filter(([key]) =>
      !activeTypes.has(key) && !used.has(key) && !recentTypes.includes(key)
    );
    const nonActive = typePool.filter(([key]) => !activeTypes.has(key) && !used.has(key));
    const unique = typePool.filter(([key]) => !used.has(key));
    const pool = fresh.length ? fresh : nonActive.length ? nonActive : unique.length ? unique : typePool;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const pickDistrict = () => {
    const used = new Set(generatedDistricts);
    const keyOf = (d) => d.key || d.name || "hq";
    const fresh = districtPool.filter((d) =>
      !activeDistricts.has(keyOf(d)) && !used.has(keyOf(d)) && !recentDistricts.includes(keyOf(d))
    );
    const nonActive = districtPool.filter((d) => !activeDistricts.has(keyOf(d)) && !used.has(keyOf(d)));
    const unique = districtPool.filter((d) => !used.has(keyOf(d)));
    const pool = fresh.length ? fresh : nonActive.length ? nonActive : unique.length ? unique : districtPool;
    return pool[Math.floor(Math.random() * pool.length)] || save.player.hq;
  };

  const pointNearDistrict = (district) => {
    let candidate = { lat: Number(district.lat), lng: Number(district.lng) };
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radiusKm = 0.35 + Math.random() * 1.05;
      const lat = Number(district.lat) + (radiusKm / 111) * Math.sin(angle);
      const cos = Math.max(0.25, Math.cos(Number(district.lat) * Math.PI / 180));
      const lng = Number(district.lng) + (radiusKm / (111 * cos)) * Math.cos(angle);
      candidate = { lat, lng };
      if (reservedPoints.every((p) => geoDistanceKm(candidate, p) >= 0.5)) break;
    }
    reservedPoints.push(candidate);
    return candidate;
  };

  for (let i = 0; i < amount; i += 1) {
    const [typeKey, cfg] = pickType();
    const district = pickDistrict();
    const districtKey = district.key || district.name || "hq";
    const point = pointNearDistrict(district);
    generatedTypes.push(typeKey);
    generatedDistricts.push(districtKey);

    const tier = clamp(Number(cfg.risk || 1), 1, 5);
    const distKm = Math.max(0.2, geoDistanceKm(save.player.hq, point));
    const rare = Math.random() < 0.14 || (i === amount - 1 && Math.random() < 0.35);
    const reward = missionRewardForOpportunity(save, tier, cfg.category, distKm, rare, i + Math.floor(Math.random() * 17));

    generated.push({
      id: uid("opp"), type_key: typeKey, name: cfg.name, category: cfg.category,
      profile: operationProfileOf(typeKey,cfg.category),
      description: "Oportunidade disponível nesta zona.",
      district: district.name || "Zona operacional", district_key: districtKey,
      lat: point.lat, lng: point.lng,
      risk: tier, reward,
      respect: 25 + tier * 20,
      pays: Math.random() < 0.18 ? "clean" : "dirty",
      min_level: Number(cfg.min_level || 1),
      min_members: tier >= 3 ? 2 : 1, status: "active", rare,
      required_models: [], police_force: Math.random() < 0.68 ? "PSP" : "GNR",
      created_at: new Date(now - Math.floor(Math.random() * 30000)).toISOString(),
      expires_at: new Date(now + (14 + Math.floor(Math.random() * 18)) * 60000).toISOString(),
      duration_s: 18 + tier * 6 + Math.floor(Math.random() * 15),
      dist_km: Number(distKm.toFixed(2)),
    });
  }

  save.player.recent_spawn_type_keys = [...recentTypes, ...generatedTypes].slice(-12);
  save.player.recent_spawn_district_keys = [...recentDistricts, ...generatedDistricts].slice(-12);
  return generated;
};

const initialMastermind = () => ({
  xp:0, bounty:0, intel:{}, active_heist:null, target_cooldowns:{},
  market:{holdings:{chips:0,art:0,medical:0,cipher:0},raid_log:[]},
  caches_collected:[], cache_cooldowns:{}, cache_completion_claimed:false, history:[],
});

const createInitialSave = () => {
  const team = makeTeam();
  const vehicle = makeVehicle("usado", team.id);
  team.vehicle_id = vehicle.id;
  const employees = [makeEmployee("assaltante", team.id, 0), makeEmployee("motorista", team.id, 1)];
  const now = Date.now();
  return {
    version: LOCAL_GUEST_SAVE_VERSION,
    created_at: new Date(now).toISOString(),
    last_tick: now,
    user: {
      id:"guest-local", email:"", name:"Império Convidado", role:"player",
      providers:["guest"], has_password:false, is_guest:true, disclaimer_accepted:false,
    },
    player: {
      id:"guest-player", org_name:"Império Convidado", clean_money:100000, dirty_money:5000,
      respect:0, level:1, heat:0, hq:null, districts:[], region:"",
      priorities:{active:"equilibrio"}, favorite_types:[], owned_cosmetics:[],
      extra_vehicle_slots:0, extra_employee_slots:0, vip_until:null, hq_skin_key:null,
      next_payroll_at:nextWeeklySettlementIso(now), pool_refresh_at:null,
      stats:{
        missions_total:0, missions_success:0, missions_partial:0, missions_failure:0, missions_police:0,
        missions_failed:0, total_earned:0, earned_dirty:0, earned_clean:0, fines_paid:0,
        laundered_total:0, by_category:{}, success_by_category:{}, high_value_ops:0,
        ops_dispatched:0, recruits_hired:0, recruits_informador:0, trainings_completed:0,
        employees_promoted:0, employees_rested:0, bonuses_paid:0, vehicles_bought:0,
        vehicles_repaired:0, vehicles_refueled:0, properties_bought:0, properties_upgraded:0,
        teams_created:0, bribes_paid:0, raids_survived:0, _local_stats_version:3,
      },
    },
    teams:[team], employees, candidates:[
      makeCandidate("hacker",0), makeCandidate("mecanico",1), makeCandidate("negociador",2), makeCandidate("seguranca",3),
    ],
    vehicles:[vehicle], weapons:[], properties:[], opportunities:[], missions:[], history:[],
    events:[
      {id:uid("evt"),kind:"system",message:"Modo convidado local iniciado. O jogo funciona sem servidor.",ts:nowIso()},
      {id:uid("evt"),kind:"team",message:"Crew Alfa está pronta com dois operacionais e um Sedan Usado.",ts:nowIso()},
    ],
    transactions:[], quests:[], mastermind:initialMastermind(),
  };
};

const ensureOrganizationSave = (save) => {
  const org = LOCAL_CATALOG.organization || {};
  save.player.inventory ||= {};
  Object.keys(org.supplies || {}).forEach((key) => {
    save.player.inventory[key] = Math.max(0, Number(save.player.inventory[key] || 0));
  });
  save.player.departments ||= {};
  save.player.territories ||= {};
  save.player.prestige_items ||= [];
  save.player.governance ||= {};
  save.player.organization_policy ||= {
    reserve_cash:25000,
    max_single_spend_pct:.35,
    stock_targets:{},
    weekly_budgets:{supplies:0,fleet:0,infrastructure:0,territory:0,people:0},
    automation:{enabled:false,auto_restock:false,renew_insurance:false,preventive_service:false},
  };
  save.organization_audit ||= [];
  (save.teams || []).forEach((team) => {
    team.doctrine ||= "balanced";
    team.policies ||= { abort_below_pct:0, protect_injured:true, auto_use_medical:true, auto_use_armor:true };
    team.loadout ||= {};
  });
  (save.vehicles || []).forEach((vehicle) => {
    vehicle.km_total = Number(vehicle.km_total ?? vehicle.km ?? 0);
    vehicle.last_service_km = Number(vehicle.last_service_km || 0);
    vehicle.tires_pct = Number(vehicle.tires_pct ?? 100);
    vehicle.insurance_until ||= null;
    vehicle.inspection_due_at ||= null;
    vehicle.notoriety = Number(vehicle.notoriety || 0);
    vehicle.seized_until ||= null;
  });
  (save.weapons || []).forEach((weapon) => {
    weapon.ammo_loaded = Number(weapon.ammo_loaded ?? weapon.loaded_rounds ?? 0);
    if (!Array.isArray(weapon.upgrades)) {
      const legacy = weapon.upgrades || {};
      weapon.upgrades = Object.entries(legacy).flatMap(([key,count]) =>
        Array.from({ length:Math.max(0,Number(count||0)) }, () => ({ key, installed_at:nowIso() }))
      );
    }
  });
  (save.properties || []).forEach((property) => {
    property.security_level = Number(property.security_level || 0);
    property.storage_level = Number(property.storage_level || 0);
    property.operations_level = Number(property.operations_level || 0);
    property.staff_employee_ids ||= [];
    property.staff_roles ||= {};
    property.staff_effectiveness = Number(property.staff_effectiveness || 0);
  });
  (save.employees || []).forEach((employee) => {
    employee.stationed_property_id ||= null;
  });
  return save;
};

const orgInventoryCapacity = (save) => {
  const org = LOCAL_CATALOG.organization || {};
  const hqLevel = Number(save.player.hq?.level || 1);
  let cap = 60 + hqLevel * 20 + Number(save.player.departments?.logistica || 0) * 40;
  for (const property of save.properties || []) {
    const level = Math.max(1, Number(property.level || 1));
    if (property.type_key === "armazem") cap += 90 * level;
    else if (property.type_key === "centro_logistico") cap += 140 * level;
    else if (property.type_key === "arsenal") cap += 45 * level;
    else if (["garagem","esconderijo"].includes(property.type_key)) cap += 20 * level;
    cap += Number(property.storage_level || 0) * 45;
  }
  return Math.max(0, Math.round(cap));
};

const orgInventoryUsed = (save) => {
  const supplies = LOCAL_CATALOG.organization?.supplies || {};
  return Object.entries(supplies).reduce(
    (sum,[key,cfg]) => sum + Number(cfg.space || 0) * Number(save.player.inventory?.[key] || 0),
    0
  );
};

const orgTerritoryIncome = (save) => {
  const tiers = LOCAL_CATALOG.organization?.territory_tiers || {};
  return Object.values(save.player.territories || {}).reduce((sum,info) => {
    const cfg = tiers[Number(info?.tier || 0)] || {};
    const pressure = clamp(Number(info?.pressure || 0),0,100);
    return sum + Math.trunc(Number(cfg.income_h || 0) * (1 - pressure / 160));
  },0);
};

const orgProtectionCost = (save) =>
  save.player.level < 5 ? 0 : 25000 + (save.employees?.length || 0) * 1000 + (save.properties?.length || 0) * 2000;

const GUEST_RIVALS=[
  {key:"vibora",name:"Víbora",style:"agressiva"},
  {key:"consorcio",name:"Consórcio",style:"financeira"},
  {key:"fantasmas",name:"Fantasmas",style:"furtiva"},
  {key:"linha_vermelha",name:"Linha Vermelha",style:"territorial"},
  {key:"atlas",name:"Atlas",style:"logística"},
];
const guestRivalProfile=(district)=>{
  const seed=String(district||"zona").split("").reduce((sum,ch,index)=>sum+(index+1)*ch.charCodeAt(0),0);
  const base=GUEST_RIVALS[seed%GUEST_RIVALS.length];
  return {...base,strength:42+(seed%37)};
};

const guestLogisticsMult=(save)=>Math.max(.70,1-Number(save.player.departments?.logistica||0)*.06);

const guestOrgPolicy=(save)=>({
  reserve_cash:Math.max(0,Number(save.player.organization_policy?.reserve_cash??25000)),
  max_single_spend_pct:clamp(Number(save.player.organization_policy?.max_single_spend_pct??.35),.05,1),
  stock_targets:{...(save.player.organization_policy?.stock_targets||{})},
  weekly_budgets:{
    supplies:Math.max(0,Number(save.player.organization_policy?.weekly_budgets?.supplies||0)),
    fleet:Math.max(0,Number(save.player.organization_policy?.weekly_budgets?.fleet||0)),
    infrastructure:Math.max(0,Number(save.player.organization_policy?.weekly_budgets?.infrastructure||0)),
    territory:Math.max(0,Number(save.player.organization_policy?.weekly_budgets?.territory||0)),
    people:Math.max(0,Number(save.player.organization_policy?.weekly_budgets?.people||0)),
  },
  automation:{
    enabled:!!save.player.organization_policy?.automation?.enabled,
    auto_restock:!!save.player.organization_policy?.automation?.auto_restock,
    renew_insurance:!!save.player.organization_policy?.automation?.renew_insurance,
    preventive_service:!!save.player.organization_policy?.automation?.preventive_service,
  },
});

const guestOrgIntelligence=(save)=>{
  ensureOrganizationSave(save);
  const org=LOCAL_CATALOG.organization||{};
  const policy=guestOrgPolicy(save);
  const inventory=save.player.inventory||{};
  const reserved={};
  Object.keys(org.supplies||{}).forEach((key)=>reserved[key]=0);
  (save.teams||[]).forEach((team)=>Object.entries(team.loadout||{}).forEach(([key,qty])=>{
    if(key in reserved) reserved[key]+=Math.max(0,Number(qty||0));
  }));
  const stock=Object.entries(org.supplies||{}).map(([key,cfg])=>{
    const qty=Number(inventory[key]||0), target=Math.max(Number(policy.stock_targets[key]||0),Number(reserved[key]||0)*3);
    const ratio=target>0?qty/target:1;
    return {
      key,name:cfg.name,qty,target,reserved_per_dispatch:reserved[key]||0,
      coverage_dispatches:reserved[key]?Math.round(qty/reserved[key]*10)/10:null,
      status:ratio>=1?"ok":ratio>=.5?"low":"critical",
      reorder_packs:Math.max(0,Math.ceil(Math.max(0,target-qty)/Math.max(1,Number(cfg.pack||1)))),
      buy_price:Math.max(1,Math.trunc(Number(cfg.price||0)*guestLogisticsMult(save))),
      sell_value:Math.trunc(Number(cfg.price||0)*.45),
    };
  });
  const recent=(save.transactions||[]).filter((tx)=>Date.parse(tx.ts||0)>=Date.now()-28*86400000);
  const income=recent.reduce((sum,tx)=>sum+Math.max(0,Number(tx.amount||0)),0);
  const expenses=recent.reduce((sum,tx)=>sum+Math.abs(Math.min(0,Number(tx.amount||0))),0);
  const budgetKind={supply_buy:"supplies",automation_restock:"supplies",vehicle_service:"fleet",vehicle_tires:"fleet",vehicle_insurance:"fleet",vehicle_inspection:"fleet",automation_insurance:"fleet",automation_service:"fleet",property_module:"infrastructure",department_upgrade:"infrastructure",prestige:"infrastructure",territory_claim:"territory",territory_consolidate:"territory",territory_defend:"territory",protection:"people",organization_event:"people",training:"people",bonus:"people"};
  const weeklyTx=(save.transactions||[]).filter((tx)=>Date.parse(tx.ts||0)>=Date.now()-7*86400000);
  const weeklySpend={supplies:0,fleet:0,infrastructure:0,territory:0,people:0};
  weeklyTx.forEach((entry)=>{const category=budgetKind[entry.kind];if(category&&Number(entry.amount||0)<0)weeklySpend[category]+=Math.abs(Number(entry.amount||0));});
  const budgets=Object.entries(policy.weekly_budgets||{}).map(([key,limit])=>{const spent=Math.round(weeklySpend[key]||0);return {key,limit:Number(limit||0),spent,remaining:Number(limit||0)>0?Math.max(0,Number(limit)-spent):null,pct:Number(limit||0)>0?Math.round(spent/Number(limit)*1000)/10:null,status:Number(limit||0)<=0?"unlimited":spent>Number(limit)?"over":spent>=Number(limit)*.8?"warning":"ok"};});
  const gross=(save.employees||[]).reduce((sum,e)=>sum+Number(e.salary||0),0);
  const weeklyBurn=Math.max(1,gross*1.2375,expenses/4);
  const runway=Number(save.player.clean_money||0)/weeklyBurn;
  const financeScore=clamp(runway/8*100,0,100);
  const fleet=(save.vehicles||[]).map((v)=>{
    const condition=Number(v.condition||0),missing=Math.max(0,100-condition);
    const lc=org.vehicle_lifecycle||{};
    const base=Math.max(120,Math.trunc(Number(v.price||LOCAL_CATALOG.vehicle_models?.[v.model_key]?.price||0)*Number(lc.service_base_pct||.018)+missing*8));
    const material=(Number(inventory.service_fluids||0)>0?Number(org.supplies?.service_fluids?.price||0):0)+(missing>=20&&Number(inventory.vehicle_parts||0)>0?Number(org.supplies?.vehicle_parts?.price||0):0);
    const service=Math.max(60,base-Math.trunc(material*.70));
    const insurance=Math.max(80,Math.trunc(Number(v.price||0)*Number(lc.insurance_week_pct||.0012)*4));
    let score=100;
    if(condition<70)score-=(70-condition)*.8;
    if(Number(v.tires_pct??100)<45)score-=(45-Number(v.tires_pct??100))*.7;
    const reasons=[];
    if(condition<60)reasons.push("condição baixa");
    if(Number(v.tires_pct??100)<35)reasons.push("pneus gastos");
    if(!v.insurance_until||Date.parse(v.insurance_until)<=Date.now()){score-=16;reasons.push("sem seguro");}
    return {id:v.id,name:v.name,score:Math.round(clamp(score,0,100)),condition,tires_pct:Number(v.tires_pct??100),reasons,costs:{service,service_base:base,tires:Number(inventory.tire_set||0)>0?0:Number(org.supplies?.tire_set?.price||520),insurance,inspection:Number(lc.inspection_base||85)}};
  });
  const properties=(save.properties||[]).map((p)=>{
    const module_costs={};
    Object.entries(org.property_modules||{}).forEach(([key,cfg])=>{
      const level=Number(p[`${key}_level`]||0);
      module_costs[key]=level>=Number(cfg.max_level||0)?null:Math.trunc(Number(cfg.base_cost||0)*(1+level*.75)*Number(p.market_multiplier||1));
    });
    const staffScore=clamp(Number(p.staff_effectiveness||0)*100,0,100);
    return {id:p.id,name:p.name,score:Math.round(clamp(Number(p.condition||100)*.6+staffScore*.4,0,100)),condition:Number(p.condition||100),staff_score:Math.round(staffScore),staff_count:(p.staff_employee_ids||[]).length,staff_roles:{...(p.staff_roles||{})},module_costs};
  });
  const territories=Object.entries(save.player.territories||{}).map(([district,info])=>{
    const tier=Number(info.tier||1),cfg=org.territory_tiers?.[tier]||{},next=org.territory_tiers?.[tier+1];
    return {district,tier,defense:Number(info.defense||0),pressure:Number(info.pressure||0),score:Math.round(clamp(Number(info.defense||0)*.65+(100-Number(info.pressure||0))*.35,0,100)),rival:{...(info.rival||guestRivalProfile(district))},costs:{defend:Math.max(500,Math.trunc(Number(cfg.defense_weekly||0)*1.5)),consolidate:next?Number(next.cost||0):null}};
  });
  const fleetScore=fleet.length?fleet.reduce((a,v)=>a+v.score,0)/fleet.length:45;
  const propertyScore=properties.length?properties.reduce((a,p)=>a+p.score,0)/properties.length:55;
  const logisticsScore=clamp(100-stock.filter(x=>x.status==="critical").length*8-(orgInventoryUsed(save)/Math.max(1,orgInventoryCapacity(save))>.9?20:0),0,100);
  const territoryScore=territories.length?territories.reduce((a,t)=>a+t.score,0)/territories.length:70;
  const crewScore=save.teams.length?clamp(75+save.teams.filter(t=>t.status==="idle").length/save.teams.length*20,0,100):35;
  const securityScore=clamp(100-Number(save.player.heat||0),0,100);
  const overall=Math.round(financeScore*.24+crewScore*.18+fleetScore*.16+logisticsScore*.15+propertyScore*.12+territoryScore*.10+securityScore*.05);
  const alerts=[];
  if(runway<1.25)alerts.push({severity:"critical",code:"cash_runway",title:"Caixa em risco",detail:`Runway de ${runway.toFixed(1)} semanas.`,tab:"centro"});
  stock.filter(x=>x.status==="critical").slice(0,5).forEach(x=>alerts.push({severity:"critical",code:`stock:${x.key}`,title:`${x.name} crítico`,detail:`Stock ${x.qty} / alvo ${x.target}.`,tab:"stock",entity_id:x.key}));
  fleet.filter(x=>x.score<55).forEach(x=>alerts.push({severity:"critical",code:`vehicle:${x.id}`,title:`${x.name} exige atenção`,detail:x.reasons.join(", ")||"prontidão baixa",tab:"frota",entity_id:x.id}));
  territories.filter(x=>x.defense<35||x.pressure>75).forEach(x=>alerts.push({severity:"critical",code:`territory:${x.district}`,title:`${x.district} instável`,detail:`Defesa ${x.defense}% · pressão ${x.pressure}%.`,tab:"territorios",entity_id:x.district}));
  const deptQuotes={};
  Object.entries(org.departments||{}).forEach(([key,cfg])=>{const level=Number(save.player.departments?.[key]||0);deptQuotes[key]={level,next_cost:level>=Number(cfg.max_level||0)?null:Math.trunc(Number(cfg.base_cost||0)*(1+level*.75))};});
  return {
    health:{score:overall,grade:overall>=92?"SSS":overall>=85?"SS":overall>=78?"S":overall>=68?"A":overall>=55?"B":"C",finance:Math.round(financeScore),crew:Math.round(crewScore),fleet:Math.round(fleetScore),logistics:Math.round(logisticsScore),properties:Math.round(propertyScore),territory:Math.round(territoryScore),security:Math.round(securityScore)},
    finance:{cash:Number(save.player.clean_money||0),weekly_burn:Math.round(weeklyBurn),runway_weeks:Math.round(runway*10)/10,income_28d:Math.round(income),expenses_28d:Math.round(expenses),reserve_cash:policy.reserve_cash,available_above_reserve:Math.max(0,Number(save.player.clean_money||0)-policy.reserve_cash),budgets},
    organization:{score:(save.employees.length*8+save.teams.length*18+save.vehicles.length*6+save.properties.length*22),dimensions:{power:Math.min(100,save.employees.length*8),influence:Math.min(100,territories.length*14),logistics:Math.round(logisticsScore),security:Math.round(securityScore),management:Math.round((financeScore+crewScore+propertyScore)/3)}},
    quotes:{departments:deptQuotes,protection:orgProtectionCost(save),territory_claim:Number(org.territory_tiers?.[1]?.cost||0)},
    storage:{used:Number(orgInventoryUsed(save).toFixed(2)),capacity:orgInventoryCapacity(save),pct:Math.round(orgInventoryUsed(save)/Math.max(1,orgInventoryCapacity(save))*1000)/10},
    stock,fleet,properties,territories,teams:(save.teams||[]).map(t=>({id:t.id,name:t.name,score:t.status==="idle"?90:82,status:t.status,doctrine:t.doctrine||"balanced",reasons:[]})),
    alerts,alert_counts:{critical:alerts.filter(a=>a.severity==="critical").length,warning:0,info:0},
    recommendations:alerts.slice(0,5).map(a=>({title:a.title,reason:a.detail,tab:a.tab,entity_id:a.entity_id,confidence:.9,action:"review"})),
    policy,
  };
};

const loadSave = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return ensureOrganizationSave(createInitialSave());
    const save = JSON.parse(raw);
    if (!save || typeof save !== "object") return createInitialSave();
    if (!save.version) save.version = 1;
    save.mastermind ||= initialMastermind();
    save.transactions ||= [];
    save.events ||= [];
    save.history ||= [];
    save.quests ||= [];
    normalizeSavedRisk(save);
    normalizeSavedEvents(save);
    normalizeSavedStats(save);
    normalizeSavedEconomy(save);
    ensureOrganizationSave(save);
    ensureLocalCity(save);
    save.version = LOCAL_GUEST_SAVE_VERSION;
    // Normalization/migration must not consume offline time. Persist the
    // migrated shape while preserving last_tick; tick() owns elapsed-time
    // simulation and only the post-tick save advances the clock.
    persist(save, false);
    return save;
  } catch (_e) {
    return createInitialSave();
  }
};

const persist = (save, touchTick = true) => {
  if (touchTick) save.last_tick = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
};

const addEvent = (save, kind, message) => {
  save.events.unshift({ id:uid("evt"), kind, message, ts:nowIso() });
  save.events = save.events.slice(0, 40);
};

const normalizeSavedEvents = (save) => {
  save.events = (save.events || []).map((event) => ({
    ...event,
    kind: event.kind || event.type || "system",
    message: typeof event.message === "string"
      ? event.message
      : typeof event.text === "string"
      ? event.text
      : "",
  }));
  return save;
};

const normalizeSavedStats = (save) => {
  const defaults = {
    missions_total:0, missions_success:0, missions_partial:0, missions_failure:0, missions_police:0,
    missions_failed:0, total_earned:0, earned_dirty:0, earned_clean:0, fines_paid:0,
    laundered_total:0, by_category:{}, success_by_category:{}, high_value_ops:0,
    ops_dispatched:0, recruits_hired:0, recruits_informador:0, trainings_completed:0,
    employees_promoted:0, employees_rested:0, bonuses_paid:0, vehicles_bought:0,
    vehicles_repaired:0, vehicles_refueled:0, properties_bought:0, properties_upgraded:0,
    teams_created:0, bribes_paid:0, raids_survived:0, _local_stats_version:3,
  };
  const previous = save.player?.stats || {};
  const stats = { ...defaults, ...previous };
  stats.by_category = { ...(previous.by_category || {}) };
  stats.success_by_category = { ...(previous.success_by_category || {}) };

  if (Number(previous._local_stats_version || 0) < 3) {
    const terminal = (save.history || []).filter((mission) =>
      ["success","partial","failure","police"].includes(mission.outcome)
    );
    const count = (outcome) => terminal.filter((mission) => mission.outcome === outcome).length;
    const maxStat = (key, value) => {
      stats[key] = Math.max(Number(stats[key] || 0), Number(value || 0));
    };

    maxStat("missions_total", terminal.length);
    maxStat("missions_success", count("success"));
    maxStat("missions_partial", count("partial"));
    maxStat("missions_failure", count("failure"));
    maxStat("missions_police", count("police"));
    stats.missions_failed = Math.max(Number(stats.missions_failed || 0), Number(stats.missions_failure || 0));

    const derivedByCategory = {};
    const derivedSuccessByCategory = {};
    let highValue = 0;
    for (const mission of terminal) {
      const category = mission.category || mission.opportunity?.category;
      if (category) derivedByCategory[category] = (derivedByCategory[category] || 0) + 1;
      if (mission.outcome === "success" && category) {
        derivedSuccessByCategory[category] = (derivedSuccessByCategory[category] || 0) + 1;
      }
      if (mission.outcome === "success" && Number(mission.pending_reward || mission.reward || 0) >= 8000) {
        highValue += 1;
      }
    }
    for (const [category, value] of Object.entries(derivedByCategory)) {
      stats.by_category[category] = Math.max(Number(stats.by_category[category] || 0), value);
    }
    for (const [category, value] of Object.entries(derivedSuccessByCategory)) {
      stats.success_by_category[category] = Math.max(Number(stats.success_by_category[category] || 0), value);
    }
    maxStat("high_value_ops", highValue);
    maxStat("ops_dispatched", terminal.length + (save.missions || []).length);

    let earnedClean = 0;
    let earnedDirty = 0;
    for (const transaction of save.transactions || []) {
      if (transaction.kind !== "mission_reward" || Number(transaction.amount || 0) <= 0) continue;
      if (transaction.wallet === "clean") earnedClean += Number(transaction.amount || 0);
      if (transaction.wallet === "dirty") earnedDirty += Number(transaction.amount || 0);
    }
    maxStat("earned_clean", earnedClean);
    maxStat("earned_dirty", earnedDirty);
    maxStat("total_earned", earnedClean + earnedDirty);
    stats._local_stats_version = 3;
  }

  save.player.stats = stats;
  return save;
};

const isFiniteGeoPoint = (point) =>
  !!point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));

const scaleRoadPlan = (route, durationS) => {
  if (!route || route.unavailable || !Array.isArray(route.latlngs) || route.latlngs.length < 2) return null;
  const rawTimes = Array.isArray(route.times) && route.times.length === route.latlngs.length
    ? route.times.map((value) => Math.max(0, Number(value) || 0))
    : null;
  const rawTotal = rawTimes?.[rawTimes.length - 1] || Number(route.duration) || 0;
  const target = Math.max(1, Number(durationS) || rawTotal || 1);
  const times = rawTimes && rawTotal > 0
    ? rawTimes.map((value) => value * target / rawTotal)
    : route.latlngs.map((_, index) => target * index / Math.max(1, route.latlngs.length - 1));
  times[times.length - 1] = target;
  return {
    latlngs: route.latlngs.map((point) => [Number(point[0]), Number(point[1])]),
    times,
    duration: target,
    distance: Math.max(0, Number(route.distance) || 0),
    source: route.source || "OSRM / OpenStreetMap",
    estimated: route.estimated !== false,
    liveTraffic: false,
    unavailable: false,
  };
};

const routeTravelSeconds = (route, vehicle) => {
  const model = LOCAL_CATALOG.vehicle_models[vehicle?.model_key] || {};
  const speed = Math.max(4, Number(vehicle?.speed || model.speed || 10));
  const condition = clamp(Number(vehicle?.condition ?? 100), 0, 100);
  const effectiveSpeed = speed * (0.6 + 0.4 * Math.pow(condition / 100, 1.35));
  const roadMeters = Math.max(0, Number(route?.distance) || 0);
  return Math.max(20, roadMeters > 0 ? roadMeters / effectiveSpeed : 20);
};

const vehicleOriginFor = (save, vehicle) => {
  const property = vehicle?.property_id
    ? (save.properties || []).find((p) => p.id === vehicle.property_id)
    : null;
  const source = isFiniteGeoPoint(property) ? property : save.player?.hq;
  if (!isFiniteGeoPoint(source)) return null;
  return { lat: Number(source.lat), lng: Number(source.lng) };
};

const normalizeSavedMissionGeometry = (save) => {
  const repair = (mission) => {
    if (!mission || typeof mission !== "object") return mission;
    const vehicle = (save.vehicles || []).find((v) => v.id === mission.vehicle_id);
    const opportunity = (save.opportunities || []).find((o) => o.id === mission.opportunity_id);

    let target = mission.target;
    if (!isFiniteGeoPoint(target) && isFiniteGeoPoint(opportunity)) {
      target = { lat: Number(opportunity.lat), lng: Number(opportunity.lng) };
    }

    let origin = mission.origin;
    if (!isFiniteGeoPoint(origin)) {
      origin = vehicleOriginFor(save, vehicle);
    }
    if (!isFiniteGeoPoint(origin) && isFiniteGeoPoint(target)) origin = { ...target };
    if (!isFiniteGeoPoint(target) && isFiniteGeoPoint(origin)) target = { ...origin };

    if (isFiniteGeoPoint(origin)) mission.origin = origin;
    if (isFiniteGeoPoint(target)) mission.target = target;
    mission.depart_at ||= mission.started_at || mission.arrive_at || nowIso();
    mission.started_at ||= mission.depart_at;
    mission.origin_property_id ??= vehicle?.property_id || null;
    return mission;
  };

  save.missions = (save.missions || []).map(repair);
  save.history = (save.history || []).map(repair);
};

const normalizeSavedEconomy = (save) => {
  const previousEconomyVersion = Number(save.version || 1);
  for (const employee of save.employees || []) {
    const role = LOCAL_CATALOG.specializations[employee.role_key];
    if (role?.salary) employee.salary = role.salary;
  }
  for (const candidate of save.candidates || []) {
    const role = LOCAL_CATALOG.specializations[candidate.role_key];
    if (role?.salary) candidate.salary = role.salary;
  }
  for (const vehicle of save.vehicles || []) {
    const model = LOCAL_CATALOG.vehicle_models[vehicle.model_key];
    if (!model) continue;
    vehicle.price = model.price;
    vehicle.fuel_type = model.fuel_type;
    vehicle.tank_l = model.tank_l;
    vehicle.cons = model.cons;
    vehicle.seats = model.seats;
    vehicle.discretion = model.discretion;
    vehicle.fuel_l = clamp(Number(vehicle.fuel_l) || model.tank_l, 0, model.tank_l);
  }
  for (const weapon of save.weapons || []) {
    const model = LOCAL_CATALOG.weapon_models[weapon.model_key];
    if (!model) continue;
    weapon.price = model.price;
    weapon.maintenance_cost = model.maintenance_cost;
  }
  for (const property of save.properties || []) {
    const type = LOCAL_CATALOG.property_types[property.type_key];
    if (!type?.price) continue;
    property.price = type.price;
    if (!property.purchase_price) {
      const market = propertyMarketPrice(type.price, property.lat, property.lng);
      property.purchase_price = market.price;
      property.market_zone = market.zone;
      property.market_multiplier = market.multiplier;
    }
  }
  if (
    previousEconomyVersion < 4
    && !(save.properties || []).length
    && Number(save.player?.clean_money || 0) < 100000
  ) {
    save.player.clean_money = 100000;
    addEvent(save, "system", "Capital de transição atualizado para a economia Portugal 2026: 100 000 € limpos.");
  }
  normalizeSavedMissionGeometry(save);
  if (previousEconomyVersion < 5 || !isMonday20Lisbon(save.player?.next_payroll_at)) {
    save.player.next_payroll_at = nextWeeklySettlementIso(Date.now());
    if (previousEconomyVersion < 5) {
      addEvent(save, "system", "Fecho de custos fixos migrado para segunda-feira às 20:00 (hora de Portugal).");
    }
  }
  return save;
};

const tx = (save, kind, amount, wallet, text) => {
  save.transactions.unshift({
    id:uid("tx"),kind,amount, wallet, text, ts:nowIso(),
    balance: wallet === "clean" ? save.player.clean_money : save.player.dirty_money,
  });
  save.transactions = save.transactions.slice(0, 150);
};

const chargeClean = (save, amount, reason = "Operação") => {
  amount = money(amount);
  if (save.player.clean_money < amount) fail(400, "Dinheiro limpo insuficiente");
  save.player.clean_money -= amount;
  tx(save, "expense", -amount, "clean", reason);
};

const calcCaps = (save) => {
  const hideouts = save.properties
    .filter((p) => p.type_key === "esconderijo")
    .reduce((sum, p) => sum + ((LOCAL_CATALOG.property_types[p.type_key]?.cap_employees || 0) * p.level), 0);
  const garages = save.properties
    .filter((p) => ["garagem","centro_logistico"].includes(p.type_key))
    .reduce((sum, p) => sum + ((LOCAL_CATALOG.property_types[p.type_key]?.cap_vehicles || 0) * p.level), 0);
  return {
    employees:{used:save.employees.length,max:4 + hideouts + (save.player.extra_employee_slots || 0)},
    vehicles:{used:save.vehicles.length,max:2 + garages + (save.player.extra_vehicle_slots || 0)},
    teams:{used:save.teams.length,max:save.player.level<=10
      ? Math.max(1,Math.min(6,1 + Math.floor(save.player.level / 2)))
      : Math.min(15,6 + Math.floor((save.player.level-10)/10))},
    dirty_money:{used:money(save.player.dirty_money),max:80000 + Math.max(0,Math.min(save.player.level,10)-1)*8000 + Math.max(0,save.player.level-10)*12000},
  };
};

const updateLevel = (save) => {
  save.player.level = levelForRespect(save.player.respect);
  if(save.player.level>100) save.player.level=100;
};

const rollFrom = (text) => {
  let h = 2166136261;
  for (let i=0;i<text.length;i+=1) { h ^= text.charCodeAt(i); h = Math.imul(h,16777619); }
  return (h >>> 0) / 4294967296;
};

const consecutiveRepeatCount = (team, opp, nowMs = Date.now()) => {
  if (!team || team.last_type_key !== opp?.type_key || !team.last_type_at) return 0;
  const last = Date.parse(team.last_type_at);
  if (!Number.isFinite(last)) return 0;
  const resetMin = Number(LOCAL_CATALOG.economy_meta?.mission_rewards?.repeat_reset_min || 60);
  if (nowMs - last < 0 || nowMs - last > resetMin * 60000) return 0;
  return Number(team.repeat_type_count || 0) + 1;
};

const missionChance = (save, opp, team) => {
  const members = save.employees.filter((e)=>e.team_id===team.id && e.status==="idle" && e.fatigue < 90);
  const skill = members.length ? members.reduce((sum,e)=>{
    const a=e.attrs||{}; return sum + ((a.forca||0)+(a.inteligencia||0)+(a.discricao||0)+(a.tiro||0)+(a.hack||0)+(a.negociacao||0))/6;
  },0)/members.length : 0;
  const vehicle = save.vehicles.find((v)=>v.id===team.vehicle_id);
  const risk = normalizeRisk(opp.risk);
  let chance = 0.54 + skill * 0.035 - risk * 0.045 - save.player.heat * 0.0015;
  if (team.spec === opp.category) chance += 0.08;
  if (members.length >= (opp.min_members || 1)) chance += 0.04;
  if (vehicle) chance += clamp((vehicle.condition-50)/500, -0.1, 0.1);
  chance += operationProfileEffect(save,opp,members,vehicle).delta;
  const cityWorld=localCityWorld(save);
  chance += Number(cityWorld.modifiers?.chance?.[opp.category]||0);
  chance += localBusinessChance(save,opp.category);
  chance += Number(localBossLeadership(save).chance_delta||0);
  return clamp(chance,0.08,0.95);
};

const finalizeMission = (save, mission) => {
  const team = save.teams.find((t)=>t.id===mission.team_id);
  const vehicle = save.vehicles.find((v)=>v.id===mission.vehicle_id);
  const members = save.employees.filter((e)=>mission.member_ids.includes(e.id));
  const effectiveChance=clamp(Number(mission.success_chance??mission.chance??.5)+Number(mission.live_chance_delta||0),.02,.98);
  const success = rollFrom(mission.id) <= effectiveChance;
  if (team) {
    team.status="idle"; team.available_at=null; team.missions_done=(team.missions_done||0)+1;
    team.streak = success ? Math.max(0,(team.streak||0))+1 : Math.min(0,(team.streak||0))-1;
    team.category_missions ||= {};
    team.category_missions[mission.category]=(team.category_missions[mission.category]||0)+1;
  }
  members.forEach((e)=>{e.status="idle";e.fatigue=clamp((e.fatigue||0)+(success?14:22),0,100);e.xp=(e.xp||0)+(success?55:20);});
  if(vehicle){
    vehicle.condition=clamp(vehicle.condition-(success?2.5:6),0,100);
    vehicle.fuel_l=clamp(vehicle.fuel_l-mission.fuel_needed,0,vehicle.tank_l);
    vehicle.km=(vehicle.km||0)+mission.distance_km*2;
  }
  mission.phase="done"; mission.outcome=success?"success":"failure"; mission.return_at=nowIso();
  save.opportunities = save.opportunities.filter((o) => o.id !== mission.opportunity_id);
  normalizeSavedStats(save);
  const stats = save.player.stats;
  stats.missions_total=(stats.missions_total||0)+1;
  stats.by_category ||= {};
  stats.by_category[mission.category]=(stats.by_category[mission.category]||0)+1;
  if(success){
    const reward=money(Number(mission.reward||0)*Number(mission.decision_reward_mult||1));
    if(mission.pays==="clean") save.player.clean_money += reward;
    else save.player.dirty_money += reward;
    const risk = normalizeRisk(mission.risk);
    save.player.respect += Math.max(20, risk * 24);
    const pulseHeat=Number(mission.world_pulse?.applied_heat_mult||1);
    const cityHeat=Number(mission.city_heat_mult||mission.city_world?.modifiers?.heat_mult||1);
    save.player.heat=clamp(save.player.heat + risk * 2.2 * pulseHeat * cityHeat,0,100);
    stats.missions_success=(stats.missions_success||0)+1;
    stats.success_by_category ||= {};
    stats.success_by_category[mission.category]=(stats.success_by_category[mission.category]||0)+1;
    stats.total_earned=(stats.total_earned||0)+reward;
    if(mission.pays==="clean") stats.earned_clean=(stats.earned_clean||0)+reward;
    else stats.earned_dirty=(stats.earned_dirty||0)+reward;
    if(reward>=8000) stats.high_value_ops=(stats.high_value_ops||0)+1;
    mission.pending_reward=reward; mission.pending_pays=mission.pays;
    tx(save,"mission_reward",reward,mission.pays==="clean"?"clean":"dirty",mission.opportunity?.name || "Operação");
    addEvent(save,"success",`${team?.name||"Equipa"} concluiu ${mission.opportunity?.name||"a operação"} com sucesso.`);
  } else {
    const risk = normalizeRisk(mission.risk);
    const pulseHeat=Number(mission.world_pulse?.applied_heat_mult||1);
    const cityHeat=Number(mission.city_heat_mult||mission.city_world?.modifiers?.heat_mult||1);
    save.player.heat=clamp(save.player.heat + risk * 4.5 * pulseHeat * cityHeat,0,100);
    stats.missions_failure=(stats.missions_failure||0)+1;
    stats.missions_failed=stats.missions_failure;
    mission.pending_reward=0; mission.pending_pays=mission.pays;
    addEvent(save,"warning",`${team?.name||"Equipa"} falhou ${mission.opportunity?.name||"a operação"}.`);
  }
  updateLevel(save);
  save.history.unshift(clone(mission)); save.history=save.history.slice(0,30);
};

const tick = (save) => {
  advanceLocalCity(save);
  const now=Date.now();
  const previous=Number(save.last_tick||now);
  const rawElapsed=Math.max(0,(now-previous)/1000);
  const elapsed=Math.min(OFFLINE_SIMULATION_MAX_S,rawElapsed);

  save.employees.forEach((e)=>{
    if(e.status_until && Date.parse(e.status_until)<=now){
      if(e.status==="resting") e.fatigue=Math.max(0,(e.fatigue||0)-55);
      if(e.status==="training"){e.xp=(e.xp||0)+80;e.level=Math.min(10,(e.level||1)+1);}
      if(["resting","training","healing"].includes(e.status)) e.status="idle";
      e.status_until=null;
    }
  });
  save.vehicles.forEach((v)=>{
    if(v.refueling_until && Date.parse(v.refueling_until)<=now){v.fuel_l=v.tank_l;v.refueling_until=null;}
    if(v.transfer?.ends_at && Date.parse(v.transfer.ends_at)<=now){v.property_id=v.transfer.to_property_id||null;v.transfer=null;}
  });
  save.properties.forEach((p)=>{
    if(p.upgrading_until && Date.parse(p.upgrading_until)<=now){p.level=Math.min(LOCAL_CATALOG.property_max_level,p.level+1);p.upgrading_until=null;}
  });
  if(save.player.hq?.upgrading_until && Date.parse(save.player.hq.upgrading_until)<=now){
    save.player.hq.level=Math.min(LOCAL_CATALOG.hq_max_level,save.player.hq.level+1);
    save.player.hq.upgrading_until=null;
  }

  for(const mission of [...save.missions]){
    const t=now;
    if(t < Date.parse(mission.arrive_at)) mission.phase="en_route";
    else if(t < Date.parse(mission.finish_at)){
      mission.phase="operating";
      if(mission.decision?.status==="pending"&&t>Date.parse(mission.decision.expires_at))mission.decision.status="expired";
    }
    else if(t < Date.parse(mission.return_at)) mission.phase="returning";
    else {
      finalizeMission(save,mission);
      save.missions=save.missions.filter((m)=>m.id!==mission.id);
    }
  }

  const heist=save.mastermind?.active_heist;
  if(heist?.current_prep?.status==="running" && Date.parse(heist.current_prep.finish_at)<=now){
    heist.current_prep.status="ready";
  }
  if(heist?.finale?.status==="running" && Date.parse(heist.finale.finish_at)<=now) heist.finale.status="ready";

  if(save.player.hq){
    const level=Number(save.player.level||1);
    save.opportunities=save.opportunities.filter((o)=>
      o.status==="taken" || (Date.parse(o.expires_at)>now && Number(o.min_level||1)<=level)
    );
    const activeCount=save.opportunities.filter((o)=>o.status==="active").length;
    if(activeCount<5){
      save.opportunities.push(...makeOpportunities(save,5-activeCount));
    }
    const active=save.opportunities.filter((o)=>o.status==="active").slice(0,5);
    const taken=save.opportunities.filter((o)=>o.status==="taken");
    save.opportunities=[...active,...taken];
  }

  const passiveHours=elapsed/3600;
  if(passiveHours>0.01){
    let cleanRate=orgTerritoryIncome(save),dirtyRate=0;
    save.properties.forEach((p)=>{
      const cfg=LOCAL_CATALOG.property_types[p.type_key]||{};
      cleanRate += (cfg.passive_clean||0)*p.level;
      dirtyRate += (cfg.passive_dirty||0)*p.level;
    });
    const passiveScale=passivePortfolioScale(save.player.level,1,cleanRate,dirtyRate);
    const clean=cleanRate*passiveHours*passiveScale;
    const dirty=dirtyRate*passiveHours*passiveScale;
    if(clean){save.player.clean_money += clean;}
    if(dirty){save.player.dirty_money += dirty;}
    save.player.heat=clamp(save.player.heat-elapsed/900,0,100);
  }

  let payrollAt=Date.parse(save.player.next_payroll_at||0);
  if(!payrollAt || !isMonday20Lisbon(save.player.next_payroll_at)){
    save.player.next_payroll_at=nextWeeklySettlementIso(now);
    payrollAt=Date.parse(save.player.next_payroll_at);
  }
  if(rawElapsed>OFFLINE_SIMULATION_MAX_S){
    const windowStart=now-OFFLINE_SIMULATION_MAX_S*1000;
    if(payrollAt && payrollAt<windowStart){
      save.player.next_payroll_at=nextWeeklySettlementIso(windowStart-1000);
      payrollAt=Date.parse(save.player.next_payroll_at);
    }
  }
  let settlements=0;
  while(payrollAt && now>=payrollAt && settlements<OFFLINE_PAYROLL_MAX_CYCLES){
    settlements+=1;
    const economy=LOCAL_CATALOG.economy_meta||{};
    const propMeta=LOCAL_CATALOG.property_meta||{};
    const gross=save.employees.reduce((s,e)=>s+(e.salary||0),0);
    const employerSs=Math.round(gross*(economy.employer_social_security_rate||0.2375));
    const fleetWeekly=Math.round(save.vehicles.reduce(
      (sum,v)=>sum+((economy.vehicle_annual_fixed_costs?.[v.model_key]||0)/52),0
    ));
    const propertyWeekly=Math.round(save.properties.reduce((sum,p)=>{
      const cfg=LOCAL_CATALOG.property_types[p.type_key]||{};
      const basis=Number(p.purchase_price||cfg.price||0);
      return sum+basis*Math.max(1,Number(p.level||1))*(propMeta.maintenance_pct_per_week||0.00056);
    },0));
    const total=gross+employerSs+fleetWeekly+propertyWeekly;
    if(save.player.clean_money>=total){
      save.player.clean_money-=total;
      save.properties.forEach((p)=>{
        p.condition=clamp((p.condition??100)+(propMeta.condition_recovery_per_week||3),0,100);
      });
      tx(save,"weekly_costs",-total,"clean","Fecho semanal — salários + TSU + frota + imóveis");
      addEvent(save,"system",`Fecho semanal pago: ${total.toLocaleString("pt-PT")} € (salários ${gross.toLocaleString("pt-PT")} € + TSU ${employerSs.toLocaleString("pt-PT")} € + frota ${fleetWeekly.toLocaleString("pt-PT")} € + imóveis ${propertyWeekly.toLocaleString("pt-PT")} €).`);
    } else {
      save.employees.forEach((e)=>{e.morale=clamp((e.morale||70)-10,0,100);e.loyalty=clamp((e.loyalty||70)-8,0,100);});
      save.properties.forEach((p)=>{
        p.condition=clamp((p.condition??100)-(propMeta.condition_decay_missed_week||8),0,100);
      });
      addEvent(save,"warning",`Sem fundos para o fecho semanal de ${total.toLocaleString("pt-PT")} €; moral e condição dos imóveis baixaram.`);
    }
    save.player.next_payroll_at=nextWeeklySettlementIso(payrollAt+1000);
    payrollAt=Date.parse(save.player.next_payroll_at);
  }
  save.last_tick=now;
  return save;
};

const MM_TARGETS=[
  {key:"auction",name:"Leilão da Meia-Noite",description:"Obras raras mudam de mãos numa rede privada.",base_reward:90000,base_success:.68,heat:18,unlock_rank:1,min_org_level:10,
   preps:[{key:"routes",name:"Rotas de saída",cost:1800,duration_s:12,required:true},{key:"inside",name:"Ajuda interna",cost:2600,duration_s:14,required:true},{key:"signals",name:"Silenciar alarmes",cost:2200,duration_s:13,required:false}]},
  {key:"estuary",name:"Reserva do Estuário",description:"Carga financeira protegida em trânsito.",base_reward:175000,base_success:.58,heat:26,unlock_rank:2,min_org_level:25,
   preps:[{key:"tracker",name:"Rastrear comboio",cost:3200,duration_s:15,required:true},{key:"vehicle",name:"Veículo de apoio",cost:4500,duration_s:17,required:true},{key:"inside",name:"Credenciais",cost:3000,duration_s:14,required:false}]},
  {key:"sovereign",name:"Nó Soberano",description:"Infraestrutura cifrada com segurança máxima.",base_reward:310000,base_success:.48,heat:34,unlock_rank:3,min_org_level:40,
   preps:[{key:"keys",name:"Chaves de acesso",cost:6500,duration_s:18,required:true},{key:"network",name:"Mapa de rede",cost:5200,duration_s:18,required:true},{key:"escape",name:"Janela de fuga",cost:4800,duration_s:16,required:true}]},
  {key:"freeport",name:"Cofre do Freeport",description:"Ativos de alto valor circulam entre armazéns seguros.",base_reward:470000,base_success:.42,heat:38,unlock_rank:4,min_org_level:55,
   preps:[{key:"rotation",name:"Rotação de Segurança",cost:18000,duration_s:20,required:true},{key:"registry",name:"Registo Fantasma",cost:24000,duration_s:22,required:true},{key:"exit",name:"Janela de Saída",cost:28000,duration_s:24,required:true}]},
  {key:"consortium",name:"Bolsa do Consórcio",description:"Uma câmara privada liquida operações de várias redes.",base_reward:650000,base_success:.38,heat:44,unlock_rank:6,min_org_level:70,
   preps:[{key:"counterparty",name:"Contraparte",cost:30000,duration_s:25,required:true},{key:"ledger",name:"Livro Paralelo",cost:36000,duration_s:27,required:true},{key:"mesh",name:"Malha de Rotas",cost:42000,duration_s:29,required:true}]},
  {key:"archive",name:"Arquivo Soberano",description:"Documentos e chaves críticas circulam numa infraestrutura redundante.",base_reward:900000,base_success:.35,heat:50,unlock_rank:8,min_org_level:85,
   preps:[{key:"identity",name:"Malha de Identidades",cost:45000,duration_s:30,required:true},{key:"coldroute",name:"Rota Fria",cost:52000,duration_s:32,required:true},{key:"relay",name:"Relé de Saída",cost:60000,duration_s:34,required:true}]},
  {key:"submundo",name:"Operação SUBMUNDO",description:"O golpe final exige nível 100 e domínio máximo do Mastermind.",base_reward:1250000,base_success:.32,heat:58,unlock_rank:10,min_org_level:100,
   preps:[{key:"national",name:"Mapa Nacional",cost:70000,duration_s:35,required:true},{key:"ghost",name:"Cadeia Fantasma",cost:85000,duration_s:38,required:true},{key:"final",name:"Janela Final",cost:100000,duration_s:42,required:true}]},
];
const MM_APPROACHES=[
  {key:"silent",name:"Silencioso",unlock_rank:1},{key:"infiltration",name:"Infiltração",unlock_rank:2},
  {key:"shock",name:"Choque",unlock_rank:3},{key:"ghost",name:"Fantasma",unlock_rank:5},
  {key:"distributed",name:"Distribuído",unlock_rank:8},
];
const MM_FENCES=[
  {key:"quick",name:"Liquidação Rápida",unlock_rank:1},{key:"discreet",name:"Rede Discreta",unlock_rank:2},
  {key:"exclusive",name:"Comprador Exclusivo",unlock_rank:3},{key:"consortium",name:"Consórcio Privado",unlock_rank:6},
  {key:"sovereign",name:"Mesa Soberana",unlock_rank:9},
];
const MM_GOODS=[
  {key:"chips",name:"Microchips Selados",description:"Componentes compactos com procura constante.",unlock_rank:1,space:1,base_price:900},
  {key:"art",name:"Caixas de Arte",description:"Peças valiosas e volumosas.",unlock_rank:2,space:3,base_price:2600},
  {key:"medical",name:"Malas Clínicas",description:"Material médico escasso.",unlock_rank:2,space:2,base_price:1700},
  {key:"cipher",name:"Chaves Cifradas",description:"Credenciais digitais raras.",unlock_rank:3,space:1,base_price:4200},
  {key:"metals",name:"Metais Raros",description:"Carga compacta de elevado valor.",unlock_rank:4,space:2,base_price:11800},
  {key:"prototype",name:"Módulos Protótipo",description:"Tecnologia de circulação restrita.",unlock_rank:6,space:3,base_price:18500},
  {key:"bonds",name:"Títulos Selados",description:"Ativos de elevada liquidez.",unlock_rank:8,space:4,base_price:32000},
  {key:"keys",name:"Chaves Soberanas",description:"Mercadoria de endgame.",unlock_rank:10,space:5,base_price:52000},
];

const mastermindRank=(xp)=>{
  const ranks=[[0,"Planeador"],[180,"Coordenador"],[520,"Arquiteto"],[1100,"Mastermind"],[2100,"Estratega"],[3600,"Diretor"],[5800,"Soberano"],[8800,"Arquiteto Nacional"],[12600,"Lenda"],[17500,"SUBMUNDO"]];
  let idx=0;ranks.forEach((r,i)=>{if(xp>=r[0])idx=i;});
  const cur=ranks[idx],next=ranks[idx+1];
  return {level:idx+1,name:cur[1],xp,next_name:next?.[1]||null,next_xp:next?.[0]||null,
    progress_pct:next?clamp((xp-cur[0])/(next[0]-cur[0])*100,0,100):100};
};

const publicHeist=(save)=>{
  const h=save.mastermind.active_heist;if(!h)return null;
  const required=h.preps.filter(p=>p.required);
  return {...clone(h),readiness:{
    required_done:required.filter(p=>p.status==="complete").length,required_total:required.length,
    ready:required.length>0&&required.every(p=>p.status==="complete")&&!h.current_prep,
    team:!!h.team_id,vehicle:!!h.vehicle_id,approach:!!h.approach_key,fence:!!h.fence_key,
  }};
};

const mastermindSnapshot=(save)=>{
  if(!save.player.hq)return {hq_pending:true,server_time:nowIso()};
  const m=save.mastermind,rank=mastermindRank(m.xp||0);
  const active=publicHeist(save);
  if(active?.current_prep){
    const total=Math.max(1,(Date.parse(active.current_prep.finish_at)-Date.parse(active.current_prep.started_at))/1000);
    const remaining=Math.max(0,(Date.parse(active.current_prep.finish_at)-Date.now())/1000);
    active.current_prep.remaining_s=remaining;active.current_prep.progress_pct=clamp((1-remaining/total)*100,0,100);
  }
  if(active?.finale){
    const total=Math.max(1,(Date.parse(active.finale.finish_at)-Date.parse(active.finale.started_at))/1000);
    const remaining=Math.max(0,(Date.parse(active.finale.finish_at)-Date.now())/1000);
    active.finale.remaining_s=remaining;active.finale.progress_pct=clamp((1-remaining/total)*100,0,100);
  }
  const used=MM_GOODS.reduce((sum,g)=>sum+(m.market.holdings[g.key]||0)*g.space,0);
  const capacity=30+(save.player.hq.level||1)*10+save.properties.length*6;
  return {
    server_time:nowIso(),rank,
    targets:MM_TARGETS.map(t=>({...clone(t),
      unlocked:rank.level>=t.unlock_rank&&save.player.level>=t.min_org_level,
      rank_unlocked:rank.level>=t.unlock_rank,org_unlocked:save.player.level>=t.min_org_level,
      intel_cost:1500*t.unlock_rank,cooldown_remaining_s:0,intel:m.intel[t.key]||null,intel_active:!!m.intel[t.key]})),
    approaches:MM_APPROACHES.map(x=>({...x,unlocked:rank.level>=x.unlock_rank})),
    fences:MM_FENCES.map(x=>({...x,unlocked:rank.level>=x.unlock_rank})),
    active_heist:active,
    market:{goods:MM_GOODS.map((g,i)=>{
      const wave=((Math.floor(Date.now()/900000)+i*3)%9)-4,changePct=wave*3;
      return {...g,price:Math.round(g.base_price*(1+changePct/100)),change_pct:changePct,
        trend:changePct>0?"up":changePct<0?"down":"flat",owned:m.market.holdings[g.key]||0,
        unlocked:rank.level>=g.unlock_rank};
    }),capacity,used,raid_risk_pct:Math.round(3+save.player.heat*.2+(m.bounty||0)*.1),raid_log:m.market.raid_log||[]},
    bounty:{value:m.bounty||0,tier:Math.min(4,Math.floor((m.bounty||0)/25)),name:(m.bounty||0)>=75?"Caçada total":(m.bounty||0)>=50?"Esquadrão rival":(m.bounty||0)>=25?"Rastreio ativo":(m.bounty||0)>0?"Rumores":"Sem contrato",progress_pct:m.bounty||0,hunter_remaining_s:0,payoff_cost:Math.max(2000,(m.bounty||0)*180)},
    caches:{districts:(save.player.districts||[]).slice(0,8).map(d=>({...d,signature:`SIG-${d.key.toUpperCase()}`,collected:m.caches_collected.includes(d.key),remaining_s:0})),collected:m.caches_collected.length,total:Math.min(8,(save.player.districts||[]).length),completion_claimed:!!m.cache_completion_claimed},
    history:m.history||[],balances:{clean_money:save.player.clean_money,dirty_money:save.player.dirty_money,heat:save.player.heat},
  };
};

const LOCAL_WORLD_PULSES=[
  {key:"cash_window",label:"Dinheiro na rua",category:"assalto",description:"Alvos de assalto estão a movimentar mais numerário, mas a exposição também subiu.",reward_mult:1.18,heat_mult:1.12},
  {key:"cold_routes",label:"Rotas frias",category:"logistica",description:"Menos fiscalização nas rotas logísticas. O lucro melhora e o calor cresce mais devagar.",reward_mult:1.14,heat_mult:.88},
  {key:"digital_noise",label:"Ruído digital",category:"tecnica",description:"Infraestruturas digitais estão mais vulneráveis durante esta janela operacional.",reward_mult:1.17,heat_mult:.96},
  {key:"open_doors",label:"Portas abertas",category:"influencia",description:"Contactos e intermediários estão mais recetivos. Operações de influência pagam melhor.",reward_mult:1.15,heat_mult:.90},
];

const localWorldPulse=(at=Date.now())=>{
  const slotMs=4*60*60*1000;
  const slot=Math.floor(at/slotMs);
  const pulse={...LOCAL_WORLD_PULSES[slot%LOCAL_WORLD_PULSES.length]};
  const starts=slot*slotMs;
  return {...pulse,starts_at:new Date(starts).toISOString(),ends_at:new Date(starts+slotMs).toISOString(),
    reward_bonus_pct:Math.round((pulse.reward_mult-1)*100),heat_delta_pct:Math.round((pulse.heat_mult-1)*100)};
};

const localMissionDecision=(category,risk,arriveAt,finishAt)=>{
  const start=Date.parse(arriveAt), finish=Date.parse(finishAt), duration=Math.max(0,finish-start);
  if(duration<35000)return null;
  const riskScale=clamp((Number(risk||1)-1)/4,0,1);
  const labels={
    assalto:["A segurança mudou de posição","Forçar a entrada","Mudar o plano"],
    logistica:["A rota de saída ficou congestionada","Manter a rota rápida","Desviar por secundárias"],
    tecnica:["Foi detetado um sistema adicional","Explorar o acesso","Isolar e continuar"],
    influencia:["O intermediário mudou as condições","Pressionar o contacto","Fechar acordo seguro"],
  }[category]||["O terreno mudou","Aproveitar a abertura","Consolidar posição"];
  return {status:"pending",title:labels[0],description:"A equipa aguarda uma decisão tática. Ignorar mantém o plano original.",
    opens_at:new Date(start+duration*.28).toISOString(),expires_at:new Date(start+duration*.78).toISOString(),choice:null,
    options:[
      {id:"steady",label:"Manter plano",description:"Sem alterar risco, recompensa ou calor.",chance_delta:0,reward_mult:1,heat_delta:0,fatigue_delta:0},
      {id:"push",label:labels[1],description:"Melhor retorno em troca de mais risco.",chance_delta:-(.025+.02*riskScale),reward_mult:1.15,heat_delta:3+3*riskScale,fatigue_delta:3+2*riskScale},
      {id:"safe",label:labels[2],description:"Mais controlo em troca de parte da recompensa.",chance_delta:.035+.015*riskScale,reward_mult:.88,heat_delta:-(1.5+1.5*riskScale),fatigue_delta:1.5},
    ]};
};

const localRetention=(save,caps)=>{
  const pulse=localWorldPulse();
  const moves=[];
  const liveDecision=save.missions.find(m=>{
    const d=m.decision; if(!d||d.status!=="pending")return false;
    const now=Date.now(); return now>=Date.parse(d.opens_at)&&now<=Date.parse(d.expires_at);
  });
  if(liveDecision)moves.push({id:"live-decision",horizon:"agora",priority:100,title:`Decisão em ${liveDecision.team_name}`,
    description:liveDecision.decision.title,panel:"operations",focus_test_id:null,progress:{value:1,target:1,pct:100},tone:"red"});
  else {
    const ready=save.teams.filter(t=>t.status==="idle"&&t.vehicle_id).length;
    const opps=save.opportunities.filter(o=>o.status==="active").length;
    if(ready&&opps)moves.push({id:"dispatch-next",horizon:"agora",priority:90,title:"Há trabalho pronto",
      description:`${ready} equipa(s) pronta(s) e ${opps} oportunidade(s) disponíveis.`,panel:"operations",focus_test_id:null,
      progress:{value:ready,target:ready,pct:100},tone:"cyan"});
    else if(!save.teams.length)moves.push({id:"build-first-team",horizon:"agora",priority:88,title:"Monta uma equipa operacional",
      description:"Sem uma equipa não consegues transformar oportunidades em progresso.",panel:"teams",focus_test_id:"team-builder",
      progress:{value:0,target:1,pct:0},tone:"cyan"});
    else if(!ready)moves.push({id:"restore-readiness",horizon:"agora",priority:86,title:"Põe uma equipa pronta",
      description:"Há equipas, mas nenhuma está em condições de receber uma nova ordem.",panel:"teams",focus_test_id:null,
      progress:{value:0,target:save.teams.length,pct:0},tone:"amber"});
    else moves.push({id:"scan-opportunities",horizon:"agora",priority:72,title:"Lê o terreno",
      description:"As equipas estão prontas. Verifica a próxima janela operacional no mapa.",panel:"operations",focus_test_id:null,
      progress:{value:0,target:1,pct:0},tone:"cyan"});
  }
  const tired=[...save.employees].filter(e=>(e.fatigue||0)>=65).sort((a,b)=>b.fatigue-a.fatigue)[0];
  const damaged=[...save.vehicles].filter(v=>(v.condition??100)<45).sort((a,b)=>a.condition-b.condition)[0];
  if(tired)moves.push({id:"fatigue-pressure",horizon:"sessao",priority:80,title:`${tired.name} está no limite`,
    description:`Fadiga a ${Math.round(tired.fatigue)}%.`,panel:"employees",focus_test_id:`employee-card-${tired.id}`,
    progress:{value:tired.fatigue,target:100,pct:tired.fatigue},tone:"amber"});
  else if(damaged)moves.push({id:"fleet-pressure",horizon:"sessao",priority:78,title:`${damaged.name} precisa de oficina`,
    description:`Condição a ${Math.round(damaged.condition)}%.`,panel:"fleet",focus_test_id:`vehicle-card-${damaged.id}`,
    progress:{value:100-damaged.condition,target:100,pct:100-damaged.condition},tone:"amber"});
  else moves.push({id:"dirty-capacity",horizon:"sessao",priority:45,title:"Mantém a tesouraria respirável",
    description:"Evita que o dinheiro sujo bloqueie novas recompensas.",panel:"empire",focus_test_id:save.player.dirty_money?"launder-amount-input":null,
    progress:{value:save.player.dirty_money,target:Math.max(1,caps.dirty_money.max),pct:clamp(save.player.dirty_money/Math.max(1,caps.dirty_money.max)*100,0,100)},tone:"green"});

  const next=rankThresholds[save.player.level]||save.player.respect;
  moves.push({id:"next-level",horizon:"plano",priority:60,title:`Constrói o caminho para o nível ${save.player.level+1}`,
    description:next>save.player.respect?`Faltam ${next-save.player.respect} pontos de progressão.`:"Expande a organização para abrir novas possibilidades.",
    panel:"operations",focus_test_id:null,progress:{value:save.player.respect,target:Math.max(1,next),pct:clamp(save.player.respect/Math.max(1,next)*100,0,100)},tone:"cyan"});

  const completed=save.history.filter(m=>["success","partial","failure","police"].includes(m.outcome));
  const best=[...completed].sort((a,b)=>(b.pending_reward||0)-(a.pending_reward||0))[0];
  const veteran=[...save.employees].sort((a,b)=>(b.missions_done||0)-(a.missions_done||0))[0];
  const car=[...save.vehicles].sort((a,b)=>(b.km_total||b.km||0)-(a.km_total||a.km||0))[0];
  const topTeam=[...save.teams].sort((a,b)=>(b.missions_done||0)-(a.missions_done||0))[0];
  const records=[];
  if(best)records.push({key:"best_mission",label:"Maior saque",value:best.pending_reward||0,detail:`${best.team_name} · ${best.opportunity?.name||"Operação"}`});
  if(veteran)records.push({key:"veteran",label:"Veterano",value:veteran.missions_done||0,detail:veteran.name});
  if(car)records.push({key:"road_car",label:"Mais quilómetros",value:Number(car.km_total||car.km||0),detail:car.name});
  if(topTeam)records.push({key:"top_team",label:"Equipa mais rodada",value:topTeam.missions_done||0,detail:topTeam.name});

  const team_legacy={};
  save.teams.forEach(t=>{
    const n=t.missions_done||0;
    const tier=n>=50?4:n>=25?3:n>=10?2:n>=3?1:0;
    const names=["Nova","Rodada","Estabelecida","Veterana","Lenda"];
    const cats=t.category_missions||{};
    const identity=Object.keys(cats).sort((a,b)=>(cats[b]||0)-(cats[a]||0))[0]||t.spec;
    team_legacy[t.id]={tier,title:names[tier],identity,missions:n,streak:t.streak||0,next_at:[3,10,25,50,null][tier]};
  });
  return {world_pulse:pulse,next_moves:moves.slice(0,3),records,team_legacy,
    active_pressure:{heat:save.player.heat||0,tired_operatives:save.employees.filter(e=>(e.fatigue||0)>=65).length,
      damaged_vehicles:save.vehicles.filter(v=>(v.condition??100)<45).length,
      low_loyalty:save.employees.filter(e=>(e.loyalty??100)<55).length}};
};

const publicState=(save)=>{
  ensureOrganizationSave(save);
  if(!save.player.hq){
    return {hq_pending:true,server_time:nowIso(),player:{
      id:save.player.id,org_name:save.player.org_name,clean_money:save.player.clean_money,
      dirty_money:save.player.dirty_money,level:save.player.level,
    }};
  }
  const caps=calcCaps(save);
  const p=clone(save.player);
  p.next_level_respect=rankThresholds[p.level]||null;
  return {
    server_time:nowIso(),player:p,teams:clone(save.teams),employees:clone(save.employees),
    candidates:clone(save.candidates),vehicles:clone(save.vehicles),weapons:clone(save.weapons),
    properties:clone(save.properties),opportunities:clone(save.opportunities),missions:clone(save.missions),
    history:clone(save.history),events:clone(save.events),quests:clone(save.quests),caps,
    retention:localRetention(save,caps),
    bonuses:{heal:0,legal:0,bribe_discount:0,repair_discount:save.properties.some(p=>p.type_key==="oficina") ? 0.15 : 0},
    ...(()=>{
      const economy=LOCAL_CATALOG.economy_meta||{};
      const gross=save.employees.reduce((s,e)=>s+(e.salary||0),0);
      const employerSs=Math.round(gross*(economy.employer_social_security_rate||0.2375));
      const fleetWeekly=Math.round(save.vehicles.reduce(
        (sum,v)=>sum+((economy.vehicle_annual_fixed_costs?.[v.model_key]||0)/52),0
      ));
      const propMeta=LOCAL_CATALOG.property_meta||{};
      const propertyWeekly=Math.round(save.properties.reduce((sum,p)=>{
        const cfg=LOCAL_CATALOG.property_types[p.type_key]||{};
        const basis=Number(p.purchase_price||cfg.price||0);
        return sum+basis*Math.max(1,Number(p.level||1))*(propMeta.maintenance_pct_per_week||0.00056);
      },0));
      return {
        salary_total:gross,
        weekly_fixed_total:gross+employerSs+fleetWeekly+propertyWeekly,
        weekly_cost_breakdown:{
          gross_salaries:gross,employer_social_security:employerSs,
          fleet_fixed:fleetWeekly,property_fixed:propertyWeekly,
        },
      };
    })(),
    fuel_prices:clone(LOCAL_CATALOG.fuel_prices),
    organization:{
      inventory:clone(save.player.inventory),
      inventory_used:Number(orgInventoryUsed(save).toFixed(2)),
      inventory_capacity:orgInventoryCapacity(save),
      departments:clone(save.player.departments),
      territories:clone(save.player.territories),
      territory_income_h:orgTerritoryIncome(save),
      prestige_items:clone(save.player.prestige_items),
      prestige_effects:{},
      governance:clone(save.player.governance),
      protection_cost:orgProtectionCost(save),
    },
    hot_category:"assalto",
  };
};

const approximatePortugalLand=(lat,lng)=>{
  const mainland=lat>=36.85&&lat<=42.20&&lng>=-9.65&&lng<=-6.00;
  const madeira=lat>=32.55&&lat<=33.20&&lng>=-17.35&&lng<=-16.05;
  const azores=lat>=36.75&&lat<=40.05&&lng>=-31.40&&lng<=-24.60;
  return mainland||madeira||azores;
};

const addStarterWorld=(save,lat,lng)=>{
  save.player.hq={lat,lng,name:"Quartel-General",level:1,upgrading_until:null,upgrade_history:[]};
  save.player.region=lat<34?"Madeira":lng<-20?"Açores":lat>40.7?"Norte":lat<38.0?"Algarve":"Centro";
  save.player.districts=makeDistricts(lat,lng);
  save.opportunities=makeOpportunities(save,5);
  addEvent(save,"system","Quartel-General estabelecido. Já há oportunidades disponíveis na zona.");
};

const refreshCandidates=(save)=>{
  const roles=Object.keys(LOCAL_CATALOG.specializations);
  save.candidates=Array.from({length:6},(_,i)=>makeCandidate(roles[(Date.now()+i*7)%roles.length|0],i));
  save.player.pool_refresh_at=new Date(Date.now()+30*60000).toISOString();
};

const genericOk=(message="Concluído")=>({ok:true,message});

const mutateGame=(save,path,payload)=>{
  const p=parseBody(payload);
  const caps=calcCaps(save);

  if(path==="hq/validate"){
    const valid=approximatePortugalLand(Number(p.lat),Number(p.lng));
    return {valid,label:valid?"Portugal · terra firme":null,locality:valid?"Local selecionado":null,reason:valid?null:"Escolhe um ponto em Portugal continental, Madeira ou Açores."};
  }
  if(path==="hq/place"){
    if(save.player.hq) fail(409,"O Quartel-General já foi estabelecido");
    if(!approximatePortugalLand(Number(p.lat),Number(p.lng))) fail(400,"Localização inválida para o Quartel-General");
    addStarterWorld(save,Number(p.lat),Number(p.lng));return {ok:true,hq:clone(save.player.hq)};
  }
  if(path==="dispatch/preview"){
    const opp=save.opportunities.find(o=>o.id===p.opportunity_id),team=save.teams.find(t=>t.id===p.team_id);
    if(!opp||!team)fail(404,"Operação ou equipa não encontrada");
    const members=save.employees.filter(e=>e.team_id===team.id&&e.status==="idle"&&e.fatigue<90);
    const vehicle=save.vehicles.find(v=>v.id===team.vehicle_id);
    const chance=missionChance(save,opp,team);
    const cityWorld=localCityWorld(save);
    const cityRewardMult=Number(cityWorld.modifiers?.reward_mult||1);
    const cityTravelMult=Number(cityWorld.modifiers?.travel_mult||1);
    const businessChance=localBusinessChance(save,opp.category);
    const bossLeadership=localBossLeadership(save);
    const pulse=localWorldPulse();
    const pulseActive=pulse.category===opp.category;
    const pulseRewardMult=pulseActive?pulse.reward_mult:1;
    const repeatCount=consecutiveRepeatCount(team,opp);
    const repeatMult=Math.pow(Number(LOCAL_CATALOG.economy_meta?.mission_rewards?.repeat_mult||.88),repeatCount);
    const profile=operationProfileEffect(save,opp,members,vehicle);
    return {chance,reward:Math.round(opp.reward*pulseRewardMult*cityRewardMult*repeatMult),reward_bonus_pct:Math.round((pulseRewardMult*cityRewardMult-1)*100),age_decay_pct:0,split_penalty_pct:0,
      repeat_count:repeatCount,repeat_penalty_pct:Math.round((repeatMult-1)*1000)/10,operation_profile:profile.profile,operation_profile_label:profile.label,distance_km:Math.round(opp.dist_km*2*10)/10,
      world_pulse:{...pulse,active_for_mission:pulseActive,applied_reward_mult:pulseRewardMult,applied_heat_mult:pulseActive?pulse.heat_mult:1},
      city_world:cityWorld,business_chance_bonus:businessChance,boss_leadership:bossLeadership,
      fuel_needed:vehicle?Math.max(1,Math.round((opp.dist_km*2*vehicle.cons/100)*10)/10):0,
      eta_s:Math.round((10+opp.dist_km*2)*cityTravelMult),duration_s:opp.duration_s||24,
      breakdown:[
        {key:"base",label:"Base",pct:.5},{key:"team",label:"Competência",pct:(chance-.5)/2},
        {key:"risk",label:"Risco",pct:-(opp.risk||0)/500},{key:"heat",label:"Calor",pct:-save.player.heat/1000},
        {key:"cidade_viva",label:`Cidade Viva: ${cityWorld.weather.name} · ${cityWorld.event.name}`,pct:Number(cityWorld.modifiers?.chance?.[opp.category]||0)},
        ...(businessChance?[{key:"rede_empresarial",label:"Rede empresarial ativa",pct:businessChance}]:[]),
        ...(bossLeadership.chance_delta?[{key:"chefia",label:`Chefia: ${bossLeadership.label}`,pct:bossLeadership.chance_delta}]:[]),
      ],members:members.length};
  }
  if(path==="dispatch/recommend_team"){
    const opp=save.opportunities.find(o=>o.id===p.opportunity_id);
    const ready=save.teams.filter(t=>t.status==="idle"&&t.vehicle_id&&save.employees.some(e=>e.team_id===t.id&&e.status==="idle"&&e.fatigue<90));
    ready.sort((a,b)=>missionChance(save,opp,b)-missionChance(save,opp,a));
    return {team_id:ready[0]?.id||null,chance:ready[0]?missionChance(save,opp,ready[0]):null};
  }
  if(path==="dispatch/recommend_opportunity"||path==="dispatch/recommend_repeat"){
    const team=save.teams.find(t=>t.id===p.team_id);
    const active=save.opportunities.filter(o=>o.status==="active"&&save.player.level>=o.min_level);
    active.sort((a,b)=>missionChance(save,b,team)-missionChance(save,a,team));
    return {opportunity_id:active[0]?.id||null};
  }
  if(path==="dispatch"){
    const opp=save.opportunities.find(o=>o.id===p.opportunity_id),team=save.teams.find(t=>t.id===p.team_id);
    if(!opp||opp.status!=="active")fail(404,"Oportunidade indisponível");
    if(!team||team.status!=="idle")fail(400,"Equipa indisponível");
    const members=save.employees.filter(e=>e.team_id===team.id&&e.status==="idle"&&e.fatigue<90);
    if(!members.length)fail(400,"A equipa não tem membros disponíveis");
    const vehicle=save.vehicles.find(v=>v.id===team.vehicle_id);
    if(!vehicle)fail(400,"A equipa não tem veículo atribuído");
    if(vehicle.condition<30)fail(400,"O veículo precisa de reparação");
    const fuelNeeded=Math.max(1,opp.dist_km*2*vehicle.cons/100);
    if(vehicle.fuel_l<fuelNeeded)fail(400,"Combustível insuficiente para a viagem");
    const start=Date.now();
    const origin=vehicleOriginFor(save,vehicle) || {lat:Number(opp.lat),lng:Number(opp.lng)};
    const target={lat:Number(opp.lat),lng:Number(opp.lng)};
    const rawOutward=p.route_outward;
    const rawInward=p.route_inward;
    const cityWorld=localCityWorld(save);
    const cityTravelMult=Number(cityWorld.modifiers?.travel_mult||1);
    const cityRewardMult=Number(cityWorld.modifiers?.reward_mult||1);
    const baseOutwardTravelS=rawOutward && !rawOutward.unavailable
      ? routeTravelSeconds(rawOutward,vehicle)
      : Math.max(20,(10000+opp.dist_km*1200)/1000);
    const baseInwardTravelS=rawInward && !rawInward.unavailable
      ? routeTravelSeconds(rawInward,vehicle)
      : baseOutwardTravelS;
    const outwardTravelS=Math.max(20,baseOutwardTravelS*cityTravelMult);
    const inwardTravelS=Math.max(20,baseInwardTravelS*cityTravelMult);
    const eta=Math.round(outwardTravelS*1000);
    const ret=Math.round(inwardTravelS*1000);
    const oper=(opp.duration_s||24)*1000;
    const roadOutward=scaleRoadPlan(rawOutward,outwardTravelS);
    const roadInward=scaleRoadPlan(rawInward,inwardTravelS);
    const roadRoundKm=((Number(rawOutward?.distance)||0)+(Number(rawInward?.distance)||0))/1000;
    const missionFuelNeeded=Math.max(1,(roadRoundKm>0?roadRoundKm:opp.dist_km*2)*vehicle.cons/100);
    if(vehicle.fuel_l<missionFuelNeeded)fail(400,"Combustível insuficiente para a viagem rodoviária");
    const departAt=new Date(start).toISOString();
    const arriveAt=new Date(start+eta).toISOString();
    const finishAt=new Date(start+eta+oper).toISOString();
    const returnAt=new Date(start+eta+oper+ret).toISOString();
    const baseChance=missionChance(save,opp,team);
    const pulse=localWorldPulse(start);
    const pulseActive=pulse.category===opp.category;
    const pulseRewardMult=pulseActive?pulse.reward_mult:1;
    const repeatCount=consecutiveRepeatCount(team,opp);
    const repeatMult=Math.pow(Number(LOCAL_CATALOG.economy_meta?.mission_rewards?.repeat_mult||.88),repeatCount);
    const profile=operationProfileEffect(save,opp,members,vehicle);
    const mission={id:uid("mission"),opportunity_id:opp.id,team_id:team.id,team_name:team.name,vehicle_id:vehicle.id,
      member_ids:members.map(e=>e.id),category:opp.category,risk:opp.risk,reward:Math.round(opp.reward*pulseRewardMult*cityRewardMult*repeatMult),pays:opp.pays,
      repeat_type:repeatCount>0,repeat_count:repeatCount,operation_profile:profile.profile,
      fuel_needed:missionFuelNeeded,distance_km:roadRoundKm>0?roadRoundKm/2:opp.dist_km,chance:baseChance,success_chance:baseChance,
      live_chance_delta:0,decision_reward_mult:1,phase:"en_route",
      depart_at:departAt,started_at:departAt,arrive_at:arriveAt,finish_at:finishAt,return_at:returnAt,
      origin,origin_property_id:vehicle.property_id||null,target,
      road_outward:roadOutward,road_inward:roadInward,
      live_log:[],
      decision:localMissionDecision(opp.category,opp.risk,arriveAt,finishAt),
      world_pulse:{...pulse,active_for_mission:pulseActive,applied_reward_mult:pulseRewardMult,applied_heat_mult:pulseActive?pulse.heat_mult:1},
      city_world:cityWorld,city_heat_mult:Number(cityWorld.modifiers?.heat_mult||1),
      opportunity:{id:opp.id,name:opp.name,type_key:opp.type_key,category:opp.category,district:opp.district,
        reward:Math.round(opp.reward*pulseRewardMult*cityRewardMult*repeatMult),risk:opp.risk,heat:Number(opp.heat||0)*Number(cityWorld.modifiers?.heat_mult||1),pays:opp.pays,profile:profile.profile}};
    team.status="on_mission";team.last_type_key=opp.type_key;team.last_type_at=new Date(start).toISOString();team.repeat_type_count=repeatCount;members.forEach(e=>e.status="on_mission");opp.status="taken";save.missions.push(mission);
    normalizeSavedStats(save);
    save.player.stats.ops_dispatched=(save.player.stats.ops_dispatched||0)+1;
    addEvent(save,"dispatch",`${team.name} saiu para ${opp.name}.`);return {ok:true,mission_id:mission.id};
  }
  if(path==="missions/decision"){
    const mission=save.missions.find(m=>m.id===p.mission_id);
    if(!mission)fail(404,"Operação não encontrada");
    const decision=mission.decision;
    if(!decision||decision.status!=="pending")fail(400,"Esta decisão já não está disponível");
    const now=Date.now();
    if(mission.phase!=="operating"||now<Date.parse(decision.opens_at))fail(400,"A janela de decisão ainda não abriu");
    if(now>Date.parse(decision.expires_at)){decision.status="expired";fail(400,"A janela de decisão terminou — a equipa manteve o plano original");}
    const option=(decision.options||[]).find(o=>o.id===p.option_id);
    if(!option)fail(400,"Opção tática inválida");
    mission.live_chance_delta=(mission.live_chance_delta||0)+Number(option.chance_delta||0);
    mission.decision_reward_mult=Number(option.reward_mult||1);
    decision.status="resolved";decision.choice=option.id;decision.choice_label=option.label;decision.resolved_at=nowIso();
    save.player.heat=clamp(save.player.heat+Number(option.heat_delta||0),0,100);
    save.employees.filter(e=>mission.member_ids.includes(e.id)).forEach(e=>{
      e.fatigue=clamp((e.fatigue||0)+Number(option.fatigue_delta||0),0,100);
    });
    mission.live_log ||= [];
    mission.live_log.push({at:nowIso(),speaker:"COMANDO",kind:Number(option.chance_delta||0)>0?"comp_good":Number(option.chance_delta||0)<0?"comp_bad":"radio",
      text:`${option.label} — ordem executada.`,...(Number(option.chance_delta||0)?{pct:Number(option.chance_delta)}:{})});
    addEvent(save,"intel",`${mission.team_name}: decisão tática — ${option.label}.`);
    return {ok:true,choice:option.id,effects:{chance_delta:option.chance_delta||0,reward_mult:option.reward_mult||1,heat_delta:option.heat_delta||0,fatigue_delta:option.fatigue_delta||0}};
  }
  if(path==="missions/recall"){
    const mission=save.missions.find(m=>m.id===p.mission_id);if(!mission)fail(404,"Missão não encontrada");
    const team=save.teams.find(t=>t.id===mission.team_id);if(team)team.status="idle";
    save.employees.filter(e=>mission.member_ids.includes(e.id)).forEach(e=>e.status="idle");
    const opp=save.opportunities.find(o=>o.id===mission.opportunity_id);if(opp)opp.status="active";
    mission.phase="done";mission.outcome="recalled";save.history.unshift(clone(mission));save.missions=save.missions.filter(m=>m.id!==mission.id);
    return {ok:true};
  }
  if(path==="opportunities/favorite"){
    const list=save.player.favorite_types||=[];const i=list.indexOf(p.type_key);if(i>=0)list.splice(i,1);else list.push(p.type_key);return {ok:true};
  }
  if(path==="teams/create"){
    if(caps.teams.used>=caps.teams.max)fail(400,"Limite de equipas atingido");
    const memberIds=[...new Set(p.employee_ids||[])];
    if(memberIds.length>(LOCAL_CATALOG.team_max_members||4))fail(400,"Equipa demasiado grande");
    const members=memberIds.map(id=>save.employees.find(e=>e.id===id));
    if(members.some(e=>!e))fail(404,"Operacional não encontrado");
    if(members.some(e=>e.status!=="idle"||e.team_id))fail(400,"Um ou mais operacionais estão indisponíveis");
    const vehicle=p.vehicle_id?save.vehicles.find(v=>v.id===p.vehicle_id):null;
    if(p.vehicle_id&&!vehicle)fail(404,"Veículo não encontrado");
    if(vehicle?.team_id||vehicle?.transfer)fail(400,"Veículo indisponível");
    const seats=vehicle?(LOCAL_CATALOG.vehicle_models?.[vehicle.model_key]?.seats||0):0;
    if(vehicle&&memberIds.length&&seats&&memberIds.length>seats)fail(400,`O veículo só tem ${seats} lugares`);
    chargeClean(save,LOCAL_CATALOG.team_create_cost,"Formação de equipa");
    const t=makeTeam();
    t.name=`Crew ${String.fromCharCode(65+save.teams.length)}`;
    t.spec=p.spec||"assalto";
    t.vehicle_id=vehicle?.id||null;
    save.teams.push(t);
    members.forEach(e=>{e.team_id=t.id;});
    if(vehicle)vehicle.team_id=t.id;
    return {ok:true,team_id:t.id,team_name:t.name,assigned_members:members.length,vehicle_id:vehicle?.id||null};
  }
  if(path==="teams/equip_emblem"){
    const team=save.teams.find((t)=>t.id===p.team_id);
    if(!team)fail(404,"Equipa não encontrada");
    team.emblem_key=p.emblem_key||null;
    return {ok:true};
  }
  if(path==="employees/recruit"){
    const c=save.candidates.find(x=>x.id===p.candidate_id);if(!c)fail(404,"Candidato não encontrado");
    if(caps.employees.used>=caps.employees.max)fail(400,"Capacidade de operacionais atingida");chargeClean(save,c.cost,"Recrutamento");
    const e={...c,id:uid("emp")};delete e.cost;delete e.min_respect;delete e.source;e.status="idle";save.employees.push(e);save.candidates=save.candidates.filter(x=>x.id!==c.id);return {ok:true,employee_id:e.id};
  }
  if(path==="recruitment/refresh"){chargeClean(save,LOCAL_CATALOG.hr_costs.pool_refresh,"Novos contactos");refreshCandidates(save);return {ok:true};}
  if(path.startsWith("employees/")){
    const e=save.employees.find(x=>x.id===p.employee_id);
    if(path!=="employees/optimize"&&!e)fail(404,"Operacional não encontrado");
    if(path==="employees/assign"){
      if(p.team_id){
        const count=save.employees.filter(x=>x.team_id===p.team_id).length;if(count>=LOCAL_CATALOG.team_max_members)fail(400,"Equipa completa");
      }
      e.team_id=p.team_id||null;return {ok:true};
    }
    if(path==="employees/train"){const course=LOCAL_CATALOG.training_courses[p.course_key];if(!course)fail(400,"Formação inválida");chargeClean(save,course.cost,"Formação");e.status="training";e.status_until=new Date(Date.now()+course.duration_s*1000).toISOString();return {ok:true};}
    if(path==="employees/rest"){e.status="resting";e.status_until=new Date(Date.now()+25000).toISOString();return {ok:true};}
    if(path==="employees/promote"){const idx=LOCAL_CATALOG.ranks.indexOf(e.rank);if(idx>=LOCAL_CATALOG.ranks.length-1)fail(400,"Patente máxima");const cost=LOCAL_CATALOG.hr_costs.promote_base*(idx+1);chargeClean(save,cost,"Promoção");e.rank=LOCAL_CATALOG.ranks[idx+1];e.morale=clamp(e.morale+10,0,100);return {ok:true};}
    if(path==="employees/bonus"){chargeClean(save,1000,"Bónus");e.morale=clamp(e.morale+15,0,100);e.loyalty=clamp(e.loyalty+8,0,100);return {ok:true};}
    if(path==="employees/heal"){chargeClean(save,LOCAL_CATALOG.hr_costs.heal_base,"Tratamento");e.status="idle";e.status_until=null;return {ok:true};}
    if(path==="employees/release"){chargeClean(save,LOCAL_CATALOG.hr_costs.release_base,"Libertação");e.status="idle";e.status_until=null;return {ok:true};}
    if(path==="employees/fire"){save.weapons.forEach(w=>{if(w.employee_id===e.id)w.employee_id=null;});save.employees=save.employees.filter(x=>x.id!==e.id);return {ok:true};}
    if(path==="employees/rename"){e.name=String(p.name||e.name).slice(0,40);return {ok:true};}
    if(path==="employees/optimize"){
      const free=save.employees.filter(x=>!x.team_id&&x.status==="idle");
      for(const t of save.teams.filter(x=>x.status==="idle"))while(free.length&&save.employees.filter(x=>x.team_id===t.id).length<LOCAL_CATALOG.team_max_members)free.shift().team_id=t.id;
      return {ok:true,message:"Operacionais redistribuídos pelas equipas disponíveis."};
    }
  }
  if(path.startsWith("vehicles/")){
    const v=save.vehicles.find(x=>x.id===p.vehicle_id);
    if(["vehicles/buy","vehicles/optimize"].includes(path)===false&&!v)fail(404,"Veículo não encontrado");
    if(path==="vehicles/buy"){const model=LOCAL_CATALOG.vehicle_models[p.model_key];if(!model)fail(400,"Modelo inválido");if(caps.vehicles.used>=caps.vehicles.max)fail(400,"Capacidade da frota atingida");if(save.player.level<model.min_level)fail(400,"Nível insuficiente");chargeClean(save,model.price,"Compra de veículo");const nv=makeVehicle(p.model_key);save.vehicles.push(nv);return {ok:true,vehicle_id:nv.id};}
    if(path==="vehicles/sell"){if(v.team_id)fail(400,"Desatribui o veículo antes de vender");const refund=Math.round(v.price*.4);save.player.clean_money+=refund;tx(save,"vehicle_sale",refund,"clean","Venda de veículo");save.vehicles=save.vehicles.filter(x=>x.id!==v.id);return {ok:true};}
    if(path==="vehicles/refuel"){const liters=Math.max(0,v.tank_l-v.fuel_l),cost=Math.ceil(liters*(LOCAL_CATALOG.fuel_prices[v.fuel_type]||1.7));chargeClean(save,cost,"Combustível");v.fuel_l=v.tank_l;return {ok:true,cost};}
    if(path==="vehicles/repair"){const cost=Math.max(50,Math.round((100-v.condition)*v.price*.003));chargeClean(save,cost,"Reparação");v.condition=100;return {ok:true,cost};}
    if(path==="vehicles/assign"){save.teams.forEach(t=>{if(t.vehicle_id===v.id)t.vehicle_id=null;});if(v.team_id){const old=save.teams.find(t=>t.id===v.team_id);if(old?.vehicle_id===v.id)old.vehicle_id=null;}v.team_id=p.team_id||null;if(p.team_id){const t=save.teams.find(t=>t.id===p.team_id);if(t){if(t.vehicle_id){const old=save.vehicles.find(x=>x.id===t.vehicle_id);if(old)old.team_id=null;}t.vehicle_id=v.id;}}return {ok:true};}
    if(path==="vehicles/transfer"){v.transfer={to_property_id:p.to_property_id||null,ends_at:new Date(Date.now()+12000).toISOString()};return {ok:true};}
    if(path==="vehicles/rename"){v.name=String(p.name||v.name).slice(0,40);return {ok:true};}
    if(path==="vehicles/equip_paint"){v.paint_key=p.paint_key||null;return {ok:true};}
    if(path==="vehicles/optimize"){const free=save.vehicles.filter(x=>!x.team_id&&!x.transfer).sort((a,b)=>b.condition-a.condition);for(const t of save.teams.filter(x=>x.status==="idle"&&!x.vehicle_id)){const nv=free.shift();if(!nv)break;nv.team_id=t.id;t.vehicle_id=nv.id;}return {ok:true,message:"Frota redistribuída pelas equipas sem veículo."};}
  }
  if(path.startsWith("weapons/")){
    const w=save.weapons.find(x=>x.id===p.weapon_id);
    if(!["weapons/buy","weapons/optimize"].includes(path)&&path!=="weapons/unassign"&&!w)fail(404,"Arma não encontrada");
    if(path==="weapons/buy"){const model=LOCAL_CATALOG.weapon_models[p.model_key];if(!model)fail(400,"Arma inválida");if(save.player.level<model.min_level)fail(400,"Nível insuficiente");chargeClean(save,model.price,"Compra de armamento");const nw={id:uid("wpn"),name:model.name,model_key:p.model_key,employee_id:null,condition:100,price:model.price,proficiency:0,jams:0};save.weapons.push(nw);return {ok:true,weapon_id:nw.id};}
    if(path==="weapons/sell"){if(w.employee_id)fail(400,"Desatribui a arma primeiro");const value=Math.round(w.price*.45);save.player.clean_money+=value;save.weapons=save.weapons.filter(x=>x.id!==w.id);return {ok:true};}
    if(path==="weapons/repair"){const cost=Math.max(50,Math.round((100-w.condition)*w.price*.003));chargeClean(save,cost,"Manutenção de arma");w.condition=100;return {ok:true};}
    if(path==="weapons/assign"){save.weapons.forEach(x=>{if(x.employee_id===p.employee_id)x.employee_id=null;});w.employee_id=p.employee_id;const e=save.employees.find(x=>x.id===p.employee_id);if(e)e.weapon_id=w.id;return {ok:true};}
    if(path==="weapons/unassign"){const ew=save.weapons.find(x=>x.employee_id===p.employee_id);if(ew)ew.employee_id=null;const e=save.employees.find(x=>x.id===p.employee_id);if(e)e.weapon_id=null;return {ok:true};}
    if(path==="weapons/auto_assign"){const e=save.employees.find(x=>x.status==="idle"&&!x.weapon_id);if(e){w.employee_id=e.id;e.weapon_id=w.id;}return {ok:true};}
    if(path==="weapons/optimize"){const free=save.weapons.filter(x=>!x.employee_id);const emps=save.employees.filter(x=>x.status==="idle"&&!x.weapon_id);while(free.length&&emps.length){const ww=free.shift(),ee=emps.shift();ww.employee_id=ee.id;ee.weapon_id=ww.id;}return {ok:true,message:"Arsenal distribuído pelos operacionais disponíveis."};}
  }
  if(path.startsWith("properties/")){
    const pr=save.properties.find(x=>x.id===p.property_id);
    if(!["properties/buy","properties/optimize"].includes(path)&&!pr)fail(404,"Propriedade não encontrada");
    if(path==="properties/buy"){
      const cfg=LOCAL_CATALOG.property_types[p.type_key];if(!cfg)fail(400,"Tipo inválido");
      if(save.player.level<cfg.min_level)fail(400,"Nível insuficiente");
      const market=propertyMarketPrice(cfg.price,Number(p.lat),Number(p.lng));
      const starterDiscount=p.type_key==="esconderijo"&&save.properties.length===0;
      const finalPrice=starterDiscount?Math.min(market.price,Number(cfg.price)):market.price;
      chargeClean(save,finalPrice,`Compra de propriedade — ${market.zone}`);
      const nearest=(save.player.districts||[]).slice().sort((a,b)=>{
        const da=(a.lat-Number(p.lat))**2+(a.lng-Number(p.lng))**2;
        const db=(b.lat-Number(p.lat))**2+(b.lng-Number(p.lng))**2;
        return da-db;
      })[0];
      const np={
        id:uid("prop"),type_key:p.type_key,name:cfg.name,district:nearest?.name||"Zona operacional",
        lat:Number(p.lat),lng:Number(p.lng),level:1,price:cfg.price,purchase_price:finalPrice,
        market_zone:market.zone,market_multiplier:market.multiplier,condition:100,upgrading_until:null
      };
      save.properties.push(np);
      addEvent(save,"property",`${cfg.name} comprado por ${finalPrice.toLocaleString("pt-PT")} € (${market.zone} ×${market.multiplier.toFixed(2)}).`);
      return {ok:true,property_id:np.id,price:finalPrice,market_zone:market.zone,market_multiplier:market.multiplier,starter_discount:starterDiscount};
    }
    if(path==="properties/sell"){const basis=Number(pr.purchase_price||pr.price);const value=Math.round(basis*.7*pr.level);save.player.clean_money+=value;save.properties=save.properties.filter(x=>x.id!==pr.id);return {ok:true,value};}
    if(path==="properties/upgrade"){if(pr.level>=LOCAL_CATALOG.property_max_level)fail(400,"Nível máximo");const basis=Number(pr.purchase_price||pr.price);const cost=Math.round(basis*.6*(pr.level+1));chargeClean(save,cost,"Melhoria de propriedade");pr.upgrading_until=new Date(Date.now()+15000).toISOString();return {ok:true,cost};}
    if(path==="properties/rename"){pr.name=String(p.name||pr.name).slice(0,40);return {ok:true};}
    if(path==="properties/optimize")return {ok:true,message:"Portefólio revisto — nenhuma alteração urgente necessária."};
  }
  if(path.startsWith("org/")){
    ensureOrganizationSave(save);
    const org = LOCAL_CATALOG.organization || {};
    const inventory = save.player.inventory;

    if(path==="org/policy"){
      const allowedAuto=["enabled","auto_restock","renew_insurance","preventive_service"];
      save.player.organization_policy={
        reserve_cash:Math.max(0,Math.min(100000000,Number(p.reserve_cash??25000))),
        max_single_spend_pct:clamp(Number(p.max_single_spend_pct??.35),.05,1),
        stock_targets:Object.fromEntries(Object.entries(p.stock_targets||{}).filter(([key])=>org.supplies?.[key]).map(([key,value])=>[key,Math.max(0,Math.min(10000,Number(value||0)))])),
        weekly_budgets:Object.fromEntries(["supplies","fleet","infrastructure","territory","people"].map((key)=>[key,Math.max(0,Math.min(100000000,Number(p.weekly_budgets?.[key]||0)))])),
        automation:Object.fromEntries(allowedAuto.map((key)=>[key,!!p.automation?.[key]])),
      };
      return {ok:true,policy:guestOrgPolicy(save)};
    }

    if(path==="org/automation/run"){
      const policy=guestOrgPolicy(save),actions=[],reserve=Number(policy.reserve_cash||0);
      const intel=guestOrgIntelligence(save);
      const canSpend=(cost)=>Number(save.player.clean_money||0)-cost>=reserve;
      const budgetRows=Object.fromEntries((intel.finance?.budgets||[]).map((row)=>[row.key,{...row}]));
      const budgetAllows=(category,cost)=>{
        const row=budgetRows[category];
        return !row||Number(row.limit||0)<=0||Number(row.spent||0)+Number(cost||0)<=Number(row.limit||0);
      };
      const consumeBudget=(category,cost)=>{if(budgetRows[category])budgetRows[category].spent=Number(budgetRows[category].spent||0)+Number(cost||0);};
      if(policy.automation.auto_restock){
        for(const row of intel.stock){
          if(row.reorder_packs<=0)continue;
          const cfg=org.supplies[row.key],packs=row.reorder_packs,units=Number(cfg.pack||1)*packs;
          const cost=Math.max(1,Math.trunc(Number(cfg.price||0)*packs*guestLogisticsMult(save)));
          const projected={...inventory,[row.key]:Number(inventory[row.key]||0)+units};
          if(!canSpend(cost)||!budgetAllows("supplies",cost)||orgInventoryUsed({...save,player:{...save.player,inventory:projected}})>orgInventoryCapacity(save))continue;
          save.player.clean_money-=cost;consumeBudget("supplies",cost);inventory[row.key]=projected[row.key];tx(save,"automation_restock",-cost,"clean",`Auto-stock — ${cfg.name}`);actions.push({type:"restock",item_key:row.key,units,cost});
        }
      }
      if(policy.automation.renew_insurance){
        for(const v of save.vehicles||[]){
          if(v.insurance_until&&Date.parse(v.insurance_until)-Date.now()>3*86400000)continue;
          const lc=org.vehicle_lifecycle||{},cost=Math.max(80,Math.trunc(Number(v.price||0)*Number(lc.insurance_week_pct||.0012)*4));
          if(!canSpend(cost)||!budgetAllows("fleet",cost))continue;
          save.player.clean_money-=cost;consumeBudget("fleet",cost);v.insurance_until=new Date(Date.now()+Number(lc.insurance_days||28)*86400000).toISOString();
          tx(save,"automation_insurance",-cost,"clean",`Auto-seguro — ${v.name}`);actions.push({type:"insurance",vehicle_id:v.id,cost});
        }
      }
      if(policy.automation.preventive_service){
        for(const v of save.vehicles||[]){
          const assigned=v.team_id?save.teams.find(t=>t.id===v.team_id):null;
          const since=Number(v.km_total||0)-Number(v.last_service_km||0);
          if(assigned&&assigned.status!=="idle")continue;
          if(Number(v.condition||0)>=65&&since<Number(org.vehicle_lifecycle?.service_interval_km||5000)-500)continue;
          const missing=Math.max(0,100-Number(v.condition||0));
          const base=Math.max(120,Math.trunc(Number(v.price||0)*Number(org.vehicle_lifecycle?.service_base_pct||.018)+missing*8));
          const useFluids=Number(inventory.service_fluids||0)>0,useParts=missing>=20&&Number(inventory.vehicle_parts||0)>0;
          const material=(useFluids?Number(org.supplies?.service_fluids?.price||0):0)+(useParts?Number(org.supplies?.vehicle_parts?.price||0):0);
          const cost=Math.max(60,base-Math.trunc(material*.70));
          if(!canSpend(cost)||!budgetAllows("fleet",cost))continue;
          save.player.clean_money-=cost;consumeBudget("fleet",cost);if(useFluids)inventory.service_fluids-=1;if(useParts)inventory.vehicle_parts-=1;
          v.condition=Math.min(100,Number(v.condition||0)+18);v.last_service_km=Number(v.km_total||0);v.missions_since_repair=0;
          tx(save,"automation_service",-cost,"clean",`Auto-revisão — ${v.name}`);actions.push({type:"service",vehicle_id:v.id,cost});
        }
      }
      save.player.organization_automation_last_at=nowIso();
      return {ok:true,actions,cash_after:save.player.clean_money,reserve_cash:reserve};
    }

    if(path==="org/inventory/buy"){
      const cfg=org.supplies?.[p.item_key]; const packs=Math.max(1,Math.min(25,Number(p.packs||1)));
      if(!cfg)fail(400,"Item inválido");
      if(save.player.level<Number(cfg.min_level||1))fail(400,"Nível insuficiente");
      const quantity=Number(cfg.pack||1)*packs;
      const needed=Number(cfg.space||0)*quantity;
      if(orgInventoryUsed(save)+needed>orgInventoryCapacity(save)+1e-9)fail(400,"Armazenamento insuficiente");
      const cost=Math.max(1,Math.trunc(Number(cfg.price||0)*packs*guestLogisticsMult(save)));
      chargeClean(save,cost,`Abastecimento — ${cfg.name}`);
      inventory[p.item_key]=Number(inventory[p.item_key]||0)+quantity;
      return {ok:true,cost,quantity};
    }
    if(path==="org/inventory/sell"){
      const cfg=org.supplies?.[p.item_key]; const packs=Math.max(1,Math.min(25,Number(p.packs||1)));
      if(!cfg)fail(400,"Item inválido");
      const quantity=Number(cfg.pack||1)*packs;
      if(Number(inventory[p.item_key]||0)<quantity)fail(400,"Stock insuficiente");
      const value=Math.trunc(Number(cfg.price||0)*packs*.45);
      inventory[p.item_key]-=quantity; save.player.clean_money+=value;
      tx(save,"sale",value,"clean",`Venda de stock — ${cfg.name}`);
      return {ok:true,value,quantity};
    }

    const team=save.teams.find((x)=>x.id===(p.team_id||p.id));
    if(path==="org/teams/rename"){
      if(!team)fail(404,"Equipa não encontrada"); if(team.status!=="idle")fail(400,"Equipa ocupada");
      team.name=String(p.name||team.name).trim().slice(0,40)||team.name; return {ok:true};
    }
    if(path==="org/teams/doctrine"){
      if(!team)fail(404,"Equipa não encontrada"); if(team.status!=="idle")fail(400,"Equipa ocupada");
      if(!org.team_doctrines?.[p.doctrine])fail(400,"Doutrina inválida");
      team.doctrine=p.doctrine; return {ok:true};
    }
    if(path==="org/teams/policies"){
      if(!team)fail(404,"Equipa não encontrada"); if(team.status!=="idle")fail(400,"Equipa ocupada");
      const next={...(team.policies||{})};
      for(const [key,cfg] of Object.entries(org.team_policies||{})){
        if(!(key in (p.policies||{})))continue;
        if(key==="abort_below_pct") next[key]=clamp(Number(p.policies[key]||0),Number(cfg.min||0),Number(cfg.max||60));
        else next[key]=!!p.policies[key];
      }
      team.policies=next; return {ok:true};
    }
    if(path==="org/teams/loadout"){
      if(!team)fail(404,"Equipa não encontrada"); if(team.status!=="idle")fail(400,"Equipa ocupada");
      const next={};
      for(const [key,qtyRaw] of Object.entries(p.loadout||{})){
        if(!org.supplies?.[key])continue;
        const qty=Math.max(0,Math.min(4,Number(qtyRaw||0)));
        if(qty>Number(inventory[key]||0))fail(400,`Stock insuficiente: ${org.supplies[key].name}`);
        if(qty>0)next[key]=qty;
      }
      team.loadout=next; return {ok:true};
    }
    if(path==="org/teams/preset"){
      if(!team)fail(404,"Equipa não encontrada"); if(team.status!=="idle")fail(400,"Equipa ocupada");
      const preset=org.team_presets?.[p.preset_key];if(!preset)fail(400,"Preset inválido");
      const loadout={},skipped=[];
      (preset.loadout||[]).forEach((key)=>{if(Number(inventory[key]||0)>0)loadout[key]=1;else skipped.push(key);});
      team.doctrine=preset.doctrine||"balanced";
      team.policies={abort_below_pct:0,protect_injured:true,auto_use_medical:true,auto_use_armor:true,...(preset.policies||{})};
      team.loadout=loadout;
      return {ok:true,preset_key:p.preset_key,preset_name:preset.name,doctrine:team.doctrine,policies:{...team.policies},loadout:{...loadout},skipped_out_of_stock:skipped};
    }
    if(path==="org/teams/dissolve"){
      if(!team)fail(404,"Equipa não encontrada"); if(team.status!=="idle")fail(400,"Equipa ocupada");
      save.employees.forEach((e)=>{if(e.team_id===team.id)e.team_id=null;});
      save.vehicles.forEach((v)=>{if(v.team_id===team.id)v.team_id=null;});
      save.teams=save.teams.filter((x)=>x.id!==team.id); return {ok:true};
    }

    const weapon=save.weapons.find((x)=>x.id===(p.id||p.weapon_id));
    if(path==="org/weapons/reload"){
      if(!weapon)fail(404,"Arma não encontrada");
      const model=LOCAL_CATALOG.weapon_models?.[weapon.model_key]||{};
      const ammoKey=org.weapon_ammo?.[weapon.model_key];
      if(!ammoKey)fail(400,"Esta arma não usa munições");
      const cap=Number(model.magazine_capacity||0), loaded=Number(weapon.ammo_loaded||0);
      const need=Math.max(0,cap-loaded), available=Number(inventory[ammoKey]||0), used=Math.min(need,available);
      if(used<=0)fail(400,need<=0?"Carregador cheio":"Sem munições no stock");
      inventory[ammoKey]-=used; weapon.ammo_loaded=loaded+used; return {ok:true,ammo_loaded:weapon.ammo_loaded,used};
    }
    if(path==="org/weapons/upgrade"){
      if(!weapon)fail(404,"Arma não encontrada");
      const cfg=org.weapon_upgrades?.[p.upgrade_key]; if(!cfg)fail(400,"Upgrade inválido");
      if(save.player.level<Number(cfg.min_level||1))fail(400,"Nível insuficiente");
      weapon.upgrades = Array.isArray(weapon.upgrades) ? weapon.upgrades : [];
      const rank=weapon.upgrades.filter((upgrade)=>upgrade?.key===p.upgrade_key).length;
      if(rank>=Number(cfg.max_rank||0))fail(400,"Upgrade no nível máximo");
      const cost=Math.trunc(Number(cfg.cost||0)*(1+rank*.65)); chargeClean(save,cost,`Upgrade de arma — ${cfg.name}`);
      weapon.upgrades.push({key:p.upgrade_key,installed_at:nowIso()}); return {ok:true,cost,rank:rank+1};
    }

    const vehicle=save.vehicles.find((x)=>x.id===p.id);
    if(path==="org/vehicles/service"){
      if(!vehicle)fail(404,"Veículo não encontrado");
      const assigned=vehicle.team_id?save.teams.find((t)=>t.id===vehicle.team_id):null;
      if(assigned&&assigned.status!=="idle")fail(400,"Veículo em operação");
      const lc=org.vehicle_lifecycle||{}, missing=Math.max(0,100-Number(vehicle.condition||0));
      const baseCost=Math.max(120,Math.trunc(Number(vehicle.price||LOCAL_CATALOG.vehicle_models?.[vehicle.model_key]?.price||0)*Number(lc.service_base_pct||.018)+missing*8));
      const useFluids=Number(inventory.service_fluids||0)>0,useParts=missing>=20&&Number(inventory.vehicle_parts||0)>0;
      const material=(useFluids?Number(org.supplies?.service_fluids?.price||0):0)+(useParts?Number(org.supplies?.vehicle_parts?.price||0):0);
      const cost=Math.max(60,baseCost-Math.trunc(material*.70));
      chargeClean(save,cost,"Revisão de veículo");if(useFluids)inventory.service_fluids-=1;if(useParts)inventory.vehicle_parts-=1;
      vehicle.condition=Math.min(100,Number(vehicle.condition||0)+18); vehicle.last_service_km=Number(vehicle.km_total??vehicle.km??0);
      vehicle.notoriety=Math.max(0,Number(vehicle.notoriety||0)-10); return {ok:true,cost,base_cost:baseCost,used_stock:[...(useFluids?["consumíveis"]:[]),...(useParts?["peças"]:[])]};
    }
    if(path==="org/vehicles/tires"){
      if(!vehicle)fail(404,"Veículo não encontrado");
      const tire=org.supplies?.tire_set||{}; let cost=0;
      if(Number(inventory.tire_set||0)>0)inventory.tire_set-=1;
      else{cost=Number(tire.price||520);chargeClean(save,cost,"Jogo de pneus");}
      vehicle.tires_pct=100; return {ok:true,cost};
    }
    if(path==="org/vehicles/insurance"){
      if(!vehicle)fail(404,"Veículo não encontrado");
      const lc=org.vehicle_lifecycle||{}, value=Number(vehicle.price||LOCAL_CATALOG.vehicle_models?.[vehicle.model_key]?.price||0);
      const cost=Math.max(80,Math.trunc(value*Number(lc.insurance_week_pct||.0012)*4));
      chargeClean(save,cost,"Seguro da frota"); vehicle.insurance_until=new Date(Date.now()+Number(lc.insurance_days||28)*86400000).toISOString();
      return {ok:true,cost};
    }
    if(path==="org/vehicles/inspection"){
      if(!vehicle)fail(404,"Veículo não encontrado");
      if(Number(vehicle.condition||0)<55||Number(vehicle.tires_pct??100)<35)fail(400,"Condição ou pneus insuficientes para IPO");
      const lc=org.vehicle_lifecycle||{}, cost=Number(lc.inspection_base||85); chargeClean(save,cost,"Inspeção periódica");
      vehicle.inspection_due_at=new Date(Date.now()+Number(lc.inspection_days||365)*86400000).toISOString(); return {ok:true,cost};
    }

    const property=save.properties.find((x)=>x.id===p.property_id);
    if(path==="org/properties/module"){
      if(!property)fail(404,"Propriedade não encontrada");
      const cfg=org.property_modules?.[p.module_key]; if(!cfg)fail(400,"Módulo inválido");
      const field=`${p.module_key}_level`, level=Number(property[field]||0);
      if(level>=Number(cfg.max_level||0))fail(400,"Módulo no nível máximo");
      const cost=Math.trunc(Number(cfg.base_cost||0)*(1+level*.75)*Number(property.market_multiplier||1));
      chargeClean(save,cost,`Módulo — ${cfg.name}`); property[field]=level+1; return {ok:true,cost,level:level+1};
    }
    if(path==="org/properties/staff"){
      if(!property)fail(404,"Propriedade não encontrada");
      const ids=[...new Set(p.employee_ids||[])].slice(0,4);
      const selected=ids.map((id)=>save.employees.find((e)=>e.id===id));
      if(selected.some((e)=>!e))fail(404,"Operacional não encontrado");
      if(selected.some((e)=>e.status!=="idle"||e.team_id||(e.stationed_property_id&&e.stationed_property_id!==property.id)))fail(400,"Operacional indisponível");
      save.employees.forEach((e)=>{if(e.stationed_property_id===property.id&&!ids.includes(e.id))e.stationed_property_id=null;});
      selected.forEach((e)=>{e.stationed_property_id=property.id;});
      const roleAttrs={security:["forca","tiro","sangue_frio"],operations:["inteligencia","discricao","sangue_frio"],logistics:["conducao","inteligencia","discricao"],management:["negociacao","inteligencia","sangue_frio"]};
      const remaining=new Set(Object.keys(roleAttrs)),roles={},scores=[];
      [...selected].sort((a,b)=>Number(b.level||1)-Number(a.level||1)).forEach((e)=>{
        const choices=remaining.size?[...remaining]:Object.keys(roleAttrs);
        const role=choices.sort((a,b)=>roleAttrs[b].reduce((sum,k)=>sum+Number(e.attrs?.[k]||0),0)-roleAttrs[a].reduce((sum,k)=>sum+Number(e.attrs?.[k]||0),0))[0];
        const raw=roleAttrs[role].reduce((sum,k)=>sum+Number(e.attrs?.[k]||0),0)/(10*roleAttrs[role].length);
        const score=clamp(raw*clamp(Number(e.morale||70)/100,.4,1)*clamp(1-Number(e.fatigue||0)/140,.45,1),0,1);
        roles[e.id]=role;scores.push(score);remaining.delete(role);
      });
      property.staff_employee_ids=ids;property.staff_roles=roles;property.staff_effectiveness=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
      return {ok:true,staff_employee_ids:ids,staff_roles:roles,staff_effectiveness:property.staff_effectiveness};
    }

    if(path==="org/departments/upgrade"){
      const cfg=org.departments?.[p.department_key]; if(!cfg)fail(400,"Departamento inválido");
      const hq=Number(save.player.hq?.level||1), level=Number(save.player.departments[p.department_key]||0);
      if(hq<Number(cfg.unlock_hq||1))fail(400,`Requer QG nível ${cfg.unlock_hq}`);
      if(level>=Number(cfg.max_level||0))fail(400,"Departamento no nível máximo");
      const cost=Math.trunc(Number(cfg.base_cost||0)*(1+level*.75)); chargeClean(save,cost,`Departamento — ${cfg.name}`);
      save.player.departments[p.department_key]=level+1; return {ok:true,cost,level:level+1};
    }

    const tiers=org.territory_tiers||{};
    if(path==="org/territories/claim"){
      const unlock=Number(tiers[1]?.unlock_level||20);
      if(save.player.level<unlock)fail(400,`Requer nível ${unlock}`);
      if(save.player.territories[p.district])fail(400,"Território já controlado");
      const cost=Number(tiers[1]?.cost||55000); chargeClean(save,cost,`Expansão territorial — ${p.district}`);
      save.player.territories[p.district]={tier:1,defense:55,pressure:10,claimed_at:nowIso(),rival:guestRivalProfile(p.district)}; return {ok:true,cost};
    }
    if(path==="org/territories/consolidate"){
      const info=save.player.territories[p.district]; if(!info)fail(404,"Território não controlado");
      const next=tiers[Number(info.tier||1)+1]; if(!next)fail(400,"Território no nível máximo");
      if(save.player.level<Number(next.unlock_level||1))fail(400,`Requer nível ${next.unlock_level}`);
      const cost=Number(next.cost||0); chargeClean(save,cost,`Consolidação territorial — ${p.district}`);
      info.tier=Number(info.tier||1)+1; info.defense=Math.min(100,Number(info.defense||0)+18); info.pressure=Math.max(0,Number(info.pressure||0)-12); return {ok:true,cost};
    }
    if(path==="org/territories/defend"){
      const info=save.player.territories[p.district]; if(!info)fail(404,"Território não controlado");
      const cfg=tiers[Number(info.tier||1)]||{}; const cost=Math.max(500,Math.trunc(Number(cfg.defense_weekly||0)*1.5));
      chargeClean(save,cost,`Defesa territorial — ${p.district}`); info.defense=Math.min(100,Number(info.defense||0)+28); info.pressure=Math.max(0,Number(info.pressure||0)-18); return {ok:true,cost};
    }
    if(path==="org/prestige/buy"){
      const cfg=org.prestige?.[p.item_key]; if(!cfg)fail(400,"Investimento inválido");
      if(save.player.level<Number(cfg.unlock_level||1))fail(400,"Nível insuficiente");
      if(save.player.prestige_items.includes(p.item_key))fail(400,"Investimento já adquirido");
      chargeClean(save,Number(cfg.cost||0),`Prestígio — ${cfg.name}`); save.player.prestige_items.push(p.item_key); return {ok:true,cost:Number(cfg.cost||0)};
    }
    if(path==="org/governance/protection"){
      const cost=orgProtectionCost(save); if(cost<=0)fail(400,"Requer nível 5");
      chargeClean(save,cost,"Proteção institucional"); save.player.governance.protection_until=new Date(Date.now()+30*86400000).toISOString(); save.player.governance.last_cost=cost;
      return {ok:true,cost};
    }
  }

  if(path==="hq/upgrade"){const level=save.player.hq?.level||1;const next=LOCAL_CATALOG.hq_level_benefits[level];if(!next)fail(400,"Quartel-General no nível máximo");if(save.player.level<Number(next.min_org_level||1))fail(400,`Requer organização nível ${next.min_org_level}`);chargeClean(save,next.upgrade_cost,"Melhoria do QG");save.player.hq.upgrading_until=new Date(Date.now()+Math.max(20000,Number(next.upgrade_duration_s||0)*1000)).toISOString();return {ok:true};}
  if(path==="hq/priority"){save.player.priorities.active=p.priority||"equilibrio";return {ok:true};}
  if(path==="hq/equip_skin"){save.player.hq_skin_key=p.skin_key||null;return {ok:true};}
  if(path==="police/bribe"){const cost=Math.max(1200,Math.round(save.player.heat*120));chargeClean(save,cost,"Suborno");save.player.heat=Math.max(0,save.player.heat-28);return {ok:true,cost};}
  if(path==="launder"){const amount=Math.min(money(p.amount),save.player.dirty_money);if(amount<=0)fail(400,"Montante inválido");save.player.dirty_money-=amount;const received=Math.round(amount*(LOCAL_CATALOG.economy_meta?.launder_base_rate||.78));save.player.clean_money+=received;normalizeSavedStats(save);save.player.stats.laundered_total=(save.player.stats.laundered_total||0)+amount;tx(save,"launder",received,"clean","Lavagem");return {ok:true,received};}
  if(path==="settings"){save.player.settings={...(save.player.settings||{}),...p};return {ok:true};}
  if(path==="quests/claim_all")return {ok:true,claimed:0,rewards:[]};
  if(path.startsWith("quests/"))return {ok:true,rewards:[]};
  if(path==="shop/buy_slot"){const key=p.kind==="vehicle"?"extra_vehicle_slots":"extra_employee_slots";const base=p.kind==="vehicle"?LOCAL_CATALOG.shop.slot_cost_vehicle_base:LOCAL_CATALOG.shop.slot_cost_employee_base;const n=save.player[key]||0;const cost=Math.round(base*(1+n*LOCAL_CATALOG.shop.slot_cost_scale_per_unit));chargeClean(save,cost,"Slot extra");save.player[key]=n+1;return {ok:true,cost};}
  if(path==="shop/vip"){const plan=LOCAL_CATALOG.shop.vip_plans[p.plan_key];if(!plan)fail(400,"Plano inválido");chargeClean(save,plan.price,"VIP");save.player.vip_until=new Date(Date.now()+plan.days*86400000).toISOString();return {ok:true};}
  if(path==="shop/cosmetic"){const item=LOCAL_CATALOG.shop[p.category==="vehicle_paint"?"vehicle_paints":p.category==="team_emblem"?"team_emblems":"hq_skins"]?.[p.key];if(!item)fail(400,"Cosmético inválido");chargeClean(save,item.price,"Cosmético");const token=`${p.category}:${p.key}`;if(!save.player.owned_cosmetics.includes(token))save.player.owned_cosmetics.push(token);return {ok:true};}
  if(path==="shop/speedup"){
    const targetKind=p.kind;
    let remainingS=0;
    if(targetKind==="vehicle_refuel"){
      const v=save.vehicles.find(x=>x.id===p.id);if(!v)fail(404,"Veículo não encontrado");
      remainingS=Math.max(0,(Date.parse(v.refueling_until||0)-Date.now())/1000);
      const cost=Math.max(LOCAL_CATALOG.shop.speedup_cost_min,Math.round((remainingS/60)*LOCAL_CATALOG.shop.speedup_cost_per_min));
      chargeClean(save,cost,"Aceleração de abastecimento");v.fuel_l=v.tank_l;v.refueling_until=null;return {ok:true,cost};
    }
    if(targetKind==="vehicle_transfer"){
      const v=save.vehicles.find(x=>x.id===p.id);if(!v)fail(404,"Veículo não encontrado");
      remainingS=Math.max(0,(Date.parse(v.transfer?.ends_at||0)-Date.now())/1000);
      const cost=Math.max(LOCAL_CATALOG.shop.speedup_cost_min,Math.round((remainingS/60)*LOCAL_CATALOG.shop.speedup_cost_per_min));
      chargeClean(save,cost,"Aceleração de transferência");if(v.transfer){v.property_id=v.transfer.to_property_id||null;v.transfer=null;}return {ok:true,cost};
    }
    if(targetKind==="property_upgrade"){
      const pr=save.properties.find(x=>x.id===p.id);if(!pr)fail(404,"Propriedade não encontrada");
      remainingS=Math.max(0,(Date.parse(pr.upgrading_until||0)-Date.now())/1000);
      const cost=Math.max(LOCAL_CATALOG.shop.speedup_cost_min,Math.round((remainingS/60)*LOCAL_CATALOG.shop.speedup_cost_per_min));
      chargeClean(save,cost,"Aceleração de obra");if(pr.upgrading_until){pr.level=Math.min(LOCAL_CATALOG.property_max_level,pr.level+1);pr.upgrading_until=null;}return {ok:true,cost};
    }
    if(targetKind==="hq_upgrade"){
      const hq=save.player.hq;if(!hq)fail(400,"Quartel-General não estabelecido");
      remainingS=Math.max(0,(Date.parse(hq.upgrading_until||0)-Date.now())/1000);
      const cost=Math.max(LOCAL_CATALOG.shop.speedup_cost_min,Math.round((remainingS/60)*LOCAL_CATALOG.shop.speedup_cost_per_min));
      chargeClean(save,cost,"Aceleração do QG");if(hq.upgrading_until){hq.level=Math.min(LOCAL_CATALOG.hq_max_level,hq.level+1);hq.upgrading_until=null;}return {ok:true,cost};
    }
    if(targetKind==="team_reorg"){
      const team=save.teams.find(x=>x.id===p.id);if(!team)fail(404,"Equipa não encontrada");
      remainingS=Math.max(0,(Date.parse(team.available_at||0)-Date.now())/1000);
      const cost=Math.max(LOCAL_CATALOG.shop.speedup_cost_min,Math.round((remainingS/60)*LOCAL_CATALOG.shop.speedup_cost_per_min));
      chargeClean(save,cost,"Aceleração de reorganização");team.available_at=null;return {ok:true,cost};
    }
    return {ok:true,cost:0};
  }

  if(path==="mastermind/heists/intel"){const target=MM_TARGETS.find(x=>x.key===p.target_key);if(!target)fail(404,"Alvo não encontrado");const rank=mastermindRank(save.mastermind.xp||0);if(rank.level<target.unlock_rank)fail(400,"Rank Mastermind insuficiente");if(save.player.level<target.min_org_level)fail(400,`Requer organização nível ${target.min_org_level}`);const cost=1500*target.unlock_rank;chargeClean(save,cost,"Dossiê Mastermind");save.mastermind.intel[target.key]={scouted_at:nowIso(),expires_at:new Date(Date.now()+30*60000).toISOString(),recommended_approach:"silent",recommended_name:"Silencioso",reward_min:Math.round(target.base_reward*.72),reward_max:Math.round(target.base_reward*1.34),risk_note:"Rotas sob vigilância"};return {ok:true};}
  if(path==="mastermind/heists/create"){if(save.mastermind.active_heist)fail(409,"Já existe um grande golpe em preparação");const target=MM_TARGETS.find(x=>x.key===p.target_key);const team=save.teams.find(x=>x.id===p.team_id),vehicle=save.vehicles.find(x=>x.id===p.vehicle_id);if(!target||!team||!vehicle)fail(400,"Configuração incompleta");const rank=mastermindRank(save.mastermind.xp||0);if(rank.level<target.unlock_rank)fail(400,"Rank Mastermind insuficiente");if(save.player.level<target.min_org_level)fail(400,`Requer organização nível ${target.min_org_level}`);const approach=MM_APPROACHES.find(x=>x.key===p.approach_key)||MM_APPROACHES[0],fence=MM_FENCES.find(x=>x.key===p.fence_key)||MM_FENCES[0];save.mastermind.active_heist={id:uid("heist"),target_key:target.key,target_name:target.name,team_id:team.id,team_name:team.name,vehicle_id:vehicle.id,vehicle_name:vehicle.name,approach_key:approach.key,approach_name:approach.name,fence_key:fence.key,fence_name:fence.name,crew_cut_pct:Number(p.crew_cut_pct||20),phase:"planning",preps:target.preps.map(x=>({...x,status:"available",attempts:0})),current_prep:null,finale:null};return {ok:true};}
  if(path==="mastermind/heists/prep/start"){const h=save.mastermind.active_heist;if(!h||h.id!==p.heist_id)fail(404,"Plano não encontrado");if(h.current_prep)fail(409,"Já existe preparação em curso");const prep=h.preps.find(x=>x.key===p.prep_key);if(!prep)fail(404,"Preparação não encontrada");chargeClean(save,prep.cost,"Preparação Mastermind");prep.status="running";prep.attempts=(prep.attempts||0)+1;h.current_prep={...prep,prep_key:prep.key,status:"running",started_at:nowIso(),finish_at:new Date(Date.now()+prep.duration_s*1000).toISOString()};return {ok:true};}
  if(path==="mastermind/heists/prep/claim"){const h=save.mastermind.active_heist;if(!h?.current_prep||h.current_prep.prep_key!==p.prep_key)fail(404,"Preparação não encontrada");if(h.current_prep.status!=="ready")fail(400,"Preparação ainda em curso");const prep=h.preps.find(x=>x.key===p.prep_key);prep.status="complete";h.current_prep=null;return {ok:true,success:true,message:"Preparação concluída."};}
  if(path==="mastermind/heists/launch"){const h=save.mastermind.active_heist;if(!h||h.id!==p.heist_id)fail(404,"Plano não encontrado");if(!h.preps.filter(x=>x.required).every(x=>x.status==="complete"))fail(400,"Conclui as preparações obrigatórias");const target=MM_TARGETS.find(x=>x.key===h.target_key);const gross=guardReward(target.base_reward,save.player.level,"mastermind");const reward=Math.round(gross*(1-h.crew_cut_pct/100));h.finale={status:"running",started_at:nowIso(),finish_at:new Date(Date.now()+25000).toISOString(),chance:clamp(target.base_success+save.mastermind.xp/10000-save.player.heat*.001,0.15,.92),net_reward:reward,loot_capacity_pct:85,complication_name:"Janela Instável",complication_description:"A segurança alterou a rotina no último momento."};h.phase="finale";return {ok:true};}
  if(path==="mastermind/heists/claim"){const h=save.mastermind.active_heist;if(!h?.finale||h.finale.status!=="ready")fail(400,"Resultado ainda não está pronto");const success=rollFrom(h.id)<=h.finale.chance;if(success){save.player.dirty_money+=h.finale.net_reward;save.mastermind.xp+=120;save.player.respect+=180;save.player.heat=clamp(save.player.heat+18,0,100);}else{save.player.heat=clamp(save.player.heat+28,0,100);save.mastermind.bounty=clamp(save.mastermind.bounty+18,0,100);}save.mastermind.history.unshift({id:h.id,target_name:h.target_name,success,reward:success?h.finale.net_reward:0,ts:nowIso()});save.mastermind.active_heist=null;updateLevel(save);return {ok:true,success,reward:success?h.finale.net_reward:0};}
  if(path==="mastermind/heists/abort"){save.mastermind.active_heist=null;return {ok:true};}
  if(path==="mastermind/market/trade"){const good=MM_GOODS.find(x=>x.key===p.good_key);if(!good)fail(404,"Mercadoria inválida");const qty=Math.max(1,Math.floor(p.quantity||1)),price=good.base_price*qty;if(p.action==="buy"){chargeClean(save,price,"Mercado negro");save.mastermind.market.holdings[good.key]=(save.mastermind.market.holdings[good.key]||0)+qty;}else{const have=save.mastermind.market.holdings[good.key]||0;if(have<qty)fail(400,"Quantidade insuficiente");save.mastermind.market.holdings[good.key]-=qty;save.player.clean_money+=Math.round(price*.94);}return {ok:true};}
  if(path==="mastermind/bounty"){if(p.action==="pay"){const cost=Math.max(2000,(save.mastermind.bounty||0)*180);chargeClean(save,cost,"Pagamento a caçadores");save.mastermind.bounty=0;}else{save.mastermind.bounty=Math.max(0,save.mastermind.bounty-25);save.player.heat=clamp(save.player.heat+6,0,100);}return {ok:true};}
  if(path==="mastermind/cache/scan"){if(save.mastermind.caches_collected.includes(p.district_key))fail(400,"Sinal já recolhido");save.mastermind.caches_collected.push(p.district_key);save.player.clean_money+=1800;save.mastermind.xp+=35;return {ok:true,reward:1800};}

  return genericOk();
};

export const isLocalGuestMode = () => localStorage.getItem(MODE_KEY) === "1";

export const enableLocalGuestMode = () => {
  localStorage.setItem(MODE_KEY,"1");
  localStorage.setItem(SESSION_KEY,"active");
  if(!localStorage.getItem(SAVE_KEY)) persist(createInitialSave());
};

export const disableLocalGuestMode = () => {
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem(SESSION_KEY);
};

export const resetLocalGuestGame = () => {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem(SESSION_KEY);
};

export const getLocalGuestUser = () => {
  const save=loadSave();
  return {...clone(save.user),name:save.player.org_name,is_guest:true};
};

export async function localGuestRequest(method,url,payload){
  let save=tick(loadSave());
  const path=String(url||"").replace(/^https?:\/\/[^/]+\/api/,"").replace(/^\/api/,"");
  const verb=String(method||"get").toLowerCase();

  const cityResult=handleLocalCityRequest(save,verb,path,payload||{});
  if(cityResult.handled){persist(save);return {data:cityResult.data,status:200};}

  if(verb==="get"&&path==="/auth/me") return {data:getLocalGuestUser(),status:200};
  if(verb==="post"&&path==="/auth/logout") return {data:{ok:true},status:200};
  if(verb==="post"&&path==="/auth/delete-account"){resetLocalGuestGame();return {data:{ok:true},status:200};}
  if(verb==="post"&&path==="/legal/disclaimer-ack"){save.user.disclaimer_accepted=true;persist(save);return {data:{ok:true},status:200};}
  if(verb==="get"&&path==="/game/catalog") return {data:clone(LOCAL_CATALOG),status:200};
  if(verb==="get"&&path==="/game/state"){persist(save);return {data:publicState(save),status:200};}
  if(verb==="get"&&path==="/game/mastermind/state"){const data=mastermindSnapshot(save);persist(save);return {data,status:200};}
  if(verb==="get"&&path==="/game/transactions") return {data:{transactions:clone(save.transactions)},status:200};
  if(verb==="get"&&path==="/game/org/intelligence"){const data=guestOrgIntelligence(save);persist(save);return {data,status:200};}
  if(verb==="get"&&path==="/game/org/policy"){return {data:guestOrgPolicy(save),status:200};}
  if(verb==="get"&&path.startsWith("/game/org/audit")){
    const match=path.match(/[?&]limit=(\d+)/),limit=Math.max(1,Math.min(200,Number(match?.[1]||50)));
    return {data:{items:clone((save.organization_audit||[]).slice(0,limit))},status:200};
  }
  if(verb==="post"&&path==="/game/org/quote"){
    const intel=guestOrgIntelligence(save),action=payload?.action,p=payload?.payload||{};
    let cost=0,effect="",eligible=true,blocking_reasons=[];
    if(action==="supply_buy"){const row=intel.stock.find(x=>x.key===p.item_key),packs=Math.max(1,Number(p.packs||1));cost=Number(row?.buy_price||0)*packs;effect=row?`+${Number(LOCAL_CATALOG.organization.supplies[p.item_key]?.pack||1)*packs} ${row.name}`:"";if(!row){eligible=false;blocking_reasons.push("Consumível inválido.");}}
    else if(action?.startsWith("vehicle_")){const row=intel.fleet.find(x=>x.id===(p.id||p.vehicle_id));const key=action.replace("vehicle_","");cost=Number(row?.costs?.[key]||0);effect=key;}
    else if(action==="property_module"){const row=intel.properties.find(x=>x.id===p.property_id);cost=Number(row?.module_costs?.[p.module_key]||0);effect=p.module_key;}
    else if(action==="department_upgrade"){cost=Number(intel.quotes.departments?.[p.department_key]?.next_cost||0);effect=p.department_key;}
    else if(action==="territory_claim"){cost=Number(intel.quotes.territory_claim||0);effect="Presença territorial";}
    else if(action==="territory_defend"){const row=intel.territories.find(x=>x.district===p.district);cost=Number(row?.costs?.defend||0);effect="Defesa territorial";}
    else if(action==="territory_consolidate"){const row=intel.territories.find(x=>x.district===p.district);cost=Number(row?.costs?.consolidate||0);effect="Consolidação territorial";}
    else if(action==="protection"){cost=Number(intel.quotes.protection||0);effect="Proteção institucional";}
    else {eligible=false;blocking_reasons.push("Ação não suportada.");}
    if(Number(save.player.clean_money||0)<cost){eligible=false;blocking_reasons.push("Dinheiro limpo insuficiente.");}
    const after=Number(save.player.clean_money||0)-cost,reserve=Number(intel.policy.reserve_cash||0);
    return {data:{action,cost,cash_before:save.player.clean_money,cash_after:after,effect,eligible,blocking_reasons,reserve_cash:reserve,breaks_reserve:cost>0&&after<reserve,concentration_risk:cost>Number(save.player.clean_money||0)*Number(intel.policy.max_single_spend_pct||.35),warnings:[]},status:200};
  }
  if(verb==="get"&&path==="/game/org/finance/summary"){
    ensureOrganizationSave(save);
    const cutoff=Date.now()-30*86400000;
    const recent=(save.transactions||[]).filter((entry)=>Date.parse(entry.ts||0)>=cutoff);
    const income=recent.reduce((sum,entry)=>sum+Math.max(0,Number(entry.amount||0)),0);
    const expenses=recent.reduce((sum,entry)=>sum+Math.abs(Math.min(0,Number(entry.amount||0))),0);
    const propertyValue=(save.properties||[]).reduce((sum,p)=>sum+Number(p.purchase_price||p.price||0)*Number(p.level||1),0);
    const fleetValue=(save.vehicles||[]).reduce((sum,v)=>sum+Number(v.price||LOCAL_CATALOG.vehicle_models?.[v.model_key]?.price||0),0);
    const weaponValue=(save.weapons||[]).reduce((sum,w)=>sum+Number(w.price||LOCAL_CATALOG.weapon_models?.[w.model_key]?.price||0),0);
    return {data:{income,expenses,net:income-expenses,asset_value:propertyValue+fleetValue+weaponValue,property_value:propertyValue,fleet_value:fleetValue,weapon_value:weaponValue},status:200};
  }

  if(verb==="post"&&path.startsWith("/game/")){
    const actionPath=path.slice("/game/".length);
    const data=mutateGame(save,actionPath,payload);
    if(actionPath.startsWith("org/")){
      const cleanPayload={...(payload||{})};delete cleanPayload.request_id;
      save.organization_audit ||= [];
      save.organization_audit.unshift({id:uid("oaudit"),action:actionPath.slice(4).replaceAll("/", "."),payload:cleanPayload,result:clone(data||{}),ts:nowIso()});
      save.organization_audit=save.organization_audit.slice(0,200);
    }
    persist(save);
    return {data,status:200};
  }

  fail(404,`Rota local não implementada: ${verb.toUpperCase()} ${path}`);
}
