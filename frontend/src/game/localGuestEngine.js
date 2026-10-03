import { LOCAL_CATALOG, LOCAL_GUEST_SAVE_VERSION } from "./localGuestCatalog";

const MODE_KEY = "lusorae_guest_mode_v2";
const SAVE_KEY = "lusorae_guest_save_v2";
const SESSION_KEY = "lusorae_guest_session_v2";

const clone = (v) => JSON.parse(JSON.stringify(v));
const nowIso = () => new Date().toISOString();
const uid = (prefix = "id") =>
  `${prefix}_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const money = (n) => Math.max(0, Math.round(Number(n) || 0));

const normalizeRisk = (value) => {
  const n = Number(value) || 1;
  // v1 do modo convidado gravava uma pseudo-percentagem (29/40/51/62)
  // onde toda a UI do Lusorae espera uma escala ordinal de 1 a 5.
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

const rankThresholds = [0, 400, 1200, 2800, 5500, 9500, 15000, 22000, 31000, 42000];
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
    status: "idle", transfer: null, refueling_until: null, impounded_until: null,
    paint_key: null, insured: false, cold_plates: false, notoriety: 0,
  };
};

const makeTeam = () => ({
  id: uid("team"), name: "Crew Alfa", spec: "assalto", status: "idle", vehicle_id: null,
  missions_done: 0, streak: 0, category_missions: {}, roster_missions: 0,
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

const missionRewardForOpportunity = (save, risk, category, distKm, rare, seedIndex = 0) => {
  const meta = LOCAL_CATALOG.economy_meta?.mission_rewards || {};
  const base = Number(meta.base_by_risk?.[risk] || 2500);
  const levelMult = 1 + Math.max(0, (save.player.level || 1) - 1) * (meta.org_level_per_level || 0.12);
  const categoryMult = Number(meta.category_mult?.[category] || 1);
  const distanceMult = 1 + Math.min(0.25, Math.max(0, Number(distKm) || 0) * 0.02);
  const rareMult = rare ? Number(meta.rare_mult || 1.6) : 1;
  const variation = 0.92 + ((seedIndex * 7) % 17) / 100;
  const raw = base * levelMult * categoryMult * distanceMult * rareMult * variation;
  const rounded = Math.round(raw / 100) * 100;
  return clamp(rounded, Number(meta.min || 1500), Number(meta.max || 90000));
};

const makeOpportunities = (save, count = 9) => {
  if (!save.player.hq) return [];
  const districts = save.player.districts || [];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const [typeKey, cfg] = oppTypes[i % oppTypes.length];
    const district = districts[i % Math.max(1, districts.length)] || save.player.hq;
    const tier = 1 + (i % 4);
    const distKm = 1 + i * 0.8;
    const rare = i === count - 1;
    const reward = missionRewardForOpportunity(save, tier, cfg.category, distKm, rare, i);
    return {
      id: uid("opp"), type_key: typeKey, name: cfg.name, category: cfg.category,
      description: "Oportunidade local detetada pela rede de inteligência da organização.",
      district: district.name || "Zona operacional", district_key: district.key || "hq",
      lat: district.lat + ((i % 3) - 1) * 0.003, lng: district.lng + (((i + 1) % 3) - 1) * 0.003,
      risk: tier, reward,
      respect: 25 + tier * 20,
      pays: i % 5 === 0 ? "clean" : "dirty", min_level: Math.min(6, tier),
      min_members: tier >= 3 ? 2 : 1, status: "active", rare,
      required_models: [], police_force: i % 3 ? "PSP" : "GNR",
      created_at: new Date(now - i * 45000).toISOString(),
      expires_at: new Date(now + (20 + i * 3) * 60000).toISOString(),
      duration_s: 18 + tier * 6, dist_km: distKm,
    };
  });
};

const initialStreet = () => ({
  rep: 0, gear: {}, plan: { approach_key:"balanced", escape_key:"speed", gear_keys:[] },
  districts: [], contacts: { fixer:0, mechanic:0, lawyer:0, informant:0 },
  contact_cooldowns: {}, active_job: null, last_event_bucket: 0, intel_until: null,
});

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
      next_payroll_at:new Date(now + 120 * 60000).toISOString(), pool_refresh_at:null,
      stats:{missions_success:0,missions_failed:0,total_earned:0},
    },
    teams:[team], employees, candidates:[
      makeCandidate("hacker",0), makeCandidate("mecanico",1), makeCandidate("negociador",2), makeCandidate("seguranca",3),
    ],
    vehicles:[vehicle], weapons:[], properties:[], opportunities:[], missions:[], history:[],
    events:[
      {id:uid("evt"),kind:"system",message:"Modo convidado local iniciado. O jogo funciona sem servidor.",ts:nowIso()},
      {id:uid("evt"),kind:"team",message:"Crew Alfa está pronta com dois operacionais e um Sedan Usado.",ts:nowIso()},
    ],
    transactions:[], quests:[], street:initialStreet(), mastermind:initialMastermind(),
  };
};

const loadSave = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialSave();
    const save = JSON.parse(raw);
    if (!save || typeof save !== "object") return createInitialSave();
    if (!save.version) save.version = 1;
    save.street ||= initialStreet();
    save.mastermind ||= initialMastermind();
    save.transactions ||= [];
    save.events ||= [];
    save.history ||= [];
    save.quests ||= [];
    normalizeSavedRisk(save);
    normalizeSavedEvents(save);
    normalizeSavedEconomy(save);
    save.version = LOCAL_GUEST_SAVE_VERSION;
    persist(save);
    return save;
  } catch (_e) {
    return createInitialSave();
  }
};

const persist = (save) => {
  save.last_tick = Date.now();
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
    if (type?.price) property.price = type.price;
  }
  if (
    previousEconomyVersion < 4
    && !(save.properties || []).length
    && Number(save.player?.clean_money || 0) < 100000
  ) {
    save.player.clean_money = 100000;
    addEvent(save, "system", "Capital de transição atualizado para a economia Portugal 2026: 100 000 € limpos.");
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
    teams:{used:save.teams.length,max:Math.max(1,Math.min(6,1 + Math.floor(save.player.level / 2)))},
    dirty_money:{used:money(save.player.dirty_money),max:50000 + save.player.level * 20000},
  };
};

const updateLevel = (save) => {
  save.player.level = levelForRespect(save.player.respect);
};

const rollFrom = (text) => {
  let h = 2166136261;
  for (let i=0;i<text.length;i+=1) { h ^= text.charCodeAt(i); h = Math.imul(h,16777619); }
  return (h >>> 0) / 4294967296;
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
  return clamp(chance,0.08,0.95);
};

const finalizeMission = (save, mission) => {
  const team = save.teams.find((t)=>t.id===mission.team_id);
  const vehicle = save.vehicles.find((v)=>v.id===mission.vehicle_id);
  const members = save.employees.filter((e)=>mission.member_ids.includes(e.id));
  const success = rollFrom(mission.id) <= mission.chance;
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
    vehicle.notoriety=clamp((vehicle.notoriety||0)+(success?2:6),0,100);
  }
  mission.phase="done"; mission.outcome=success?"success":"failure"; mission.return_at=nowIso();
  save.opportunities = save.opportunities.filter((o) => o.id !== mission.opportunity_id);
  if(success){
    const reward=money(mission.reward);
    if(mission.pays==="clean") save.player.clean_money += reward;
    else save.player.dirty_money += reward;
    const risk = normalizeRisk(mission.risk);
    save.player.respect += Math.max(20, risk * 24);
    save.player.heat=clamp(save.player.heat + risk * 2.2,0,100);
    save.player.stats.missions_success=(save.player.stats.missions_success||0)+1;
    save.player.stats.total_earned=(save.player.stats.total_earned||0)+reward;
    mission.pending_reward=reward; mission.pending_pays=mission.pays;
    tx(save,"mission_reward",reward,mission.pays==="clean"?"clean":"dirty",mission.opportunity?.name || "Operação");
    addEvent(save,"success",`${team?.name||"Equipa"} concluiu ${mission.opportunity?.name||"a operação"} com sucesso.`);
  } else {
    const risk = normalizeRisk(mission.risk);
    save.player.heat=clamp(save.player.heat + risk * 4.5,0,100);
    save.player.stats.missions_failed=(save.player.stats.missions_failed||0)+1;
    mission.pending_reward=0; mission.pending_pays=mission.pays;
    addEvent(save,"warning",`${team?.name||"Equipa"} falhou ${mission.opportunity?.name||"a operação"}.`);
  }
  updateLevel(save);
  save.history.unshift(clone(mission)); save.history=save.history.slice(0,30);
};

const tick = (save) => {
  const now=Date.now();
  const previous=Number(save.last_tick||now);
  const elapsed=Math.max(0,Math.min(24*3600,(now-previous)/1000));

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
    else if(t < Date.parse(mission.finish_at)) mission.phase="operating";
    else if(t < Date.parse(mission.return_at)) mission.phase="returning";
    else {
      finalizeMission(save,mission);
      save.missions=save.missions.filter((m)=>m.id!==mission.id);
    }
  }

  const job=save.street?.active_job;
  if(job && job.status==="running" && Date.parse(job.finish_at)<=now) job.status="ready";

  const heist=save.mastermind?.active_heist;
  if(heist?.current_prep?.status==="running" && Date.parse(heist.current_prep.finish_at)<=now){
    heist.current_prep.status="ready";
  }
  if(heist?.finale?.status==="running" && Date.parse(heist.finale.finish_at)<=now) heist.finale.status="ready";

  if(save.player.hq && save.opportunities.filter((o)=>o.status==="active" && Date.parse(o.expires_at)>now).length < 6){
    save.opportunities=save.opportunities.filter((o)=>o.status==="taken" || Date.parse(o.expires_at)>now);
    save.opportunities.push(...makeOpportunities(save,4));
  }

  const passiveHours=elapsed/3600;
  if(passiveHours>0.01){
    let clean=0,dirty=0;
    save.properties.forEach((p)=>{
      const cfg=LOCAL_CATALOG.property_types[p.type_key]||{};
      clean += (cfg.passive_clean||0)*p.level*passiveHours;
      dirty += (cfg.passive_dirty||0)*p.level*passiveHours;
    });
    const maintenancePct=LOCAL_CATALOG.property_meta?.maintenance_pct_per_day||0.00008;
    const propertyOperating=save.properties.reduce((sum,p)=>{
      const cfg=LOCAL_CATALOG.property_types[p.type_key]||{};
      return sum+(Number(cfg.price||0)*Number(p.level||1)*maintenancePct/24*passiveHours);
    },0);
    if(propertyOperating>0){
      save.player.clean_money=Math.max(0,save.player.clean_money-propertyOperating);
    }
    if(clean){save.player.clean_money += clean;}
    if(dirty){save.player.dirty_money += dirty;}
    save.player.heat=clamp(save.player.heat-elapsed/900,0,100);
  }

  const payrollAt=Date.parse(save.player.next_payroll_at||0);
  if(payrollAt && now>=payrollAt){
    const economy=LOCAL_CATALOG.economy_meta||{};
    const gross=save.employees.reduce((s,e)=>s+(e.salary||0),0);
    const employerSs=Math.round(gross*(economy.employer_social_security_rate||0.2375));
    const fleetWeekly=Math.round(save.vehicles.reduce(
      (sum,v)=>sum+((economy.vehicle_annual_fixed_costs?.[v.model_key]||0)/52),0
    ));
    const total=gross+employerSs+fleetWeekly;
    if(save.player.clean_money>=total){
      save.player.clean_money-=total;
      tx(save,"weekly_costs",-total,"clean","Salários + TSU + custos fixos da frota");
      addEvent(save,"system",`Custos semanais pagos: ${total.toLocaleString("pt-PT")} € (salários ${gross.toLocaleString("pt-PT")} € + TSU ${employerSs.toLocaleString("pt-PT")} € + frota ${fleetWeekly.toLocaleString("pt-PT")} €).`);
    } else {
      save.employees.forEach((e)=>{e.morale=clamp((e.morale||70)-12,0,100);e.loyalty=clamp((e.loyalty||70)-5,0,100);});
      addEvent(save,"warning",`Sem fundos para os custos semanais de ${total.toLocaleString("pt-PT")} €.`);
    }
    save.player.next_payroll_at=new Date(now+(economy.economic_week_minutes||120)*60000).toISOString();
  }
  save.last_tick=now;
  return save;
};

const streetRank = (rep) => {
  const levels=[
    [0,"Desconhecido"],[100,"Operador"],[300,"Nome na Rua"],[650,"Influente"],[1100,"Predador"],[1800,"Lenda Urbana"]
  ];
  let idx=0; levels.forEach((v,i)=>{if(rep>=v[0])idx=i;});
  const current=levels[idx], next=levels[idx+1];
  return {level:idx+1,name:current[1],rep:Math.round(rep),next_rep:next?.[0]||null,
    progress_pct:next?clamp((rep-current[0])/(next[0]-current[0])*100,0,100):100};
};

const streetSnapshot = (save) => {
  const s=save.street;
  if(!save.player.hq) return {hq_pending:true,server_time:nowIso()};
  if(!s.districts.length){
    s.districts=(save.player.districts||[]).slice(0,8).map((d,i)=>({
      ...d,influence:25+i*4,controlled:false,tier:0,rival_pressure:18+i*6,
      income_per_h:0,defend_remaining_s:0,
    }));
  }
  const stars=clamp(Math.floor(save.player.heat/20),0,5);
  const rank=streetRank(s.rep||0);
  const contacts=[
    ["fixer","A Ponte","Fixer","Reduz calor e abre caminhos.",1],
    ["mechanic","Oficina 24","Mecânico","Recupera veículos e reduz notoriedade.",1],
    ["lawyer","Linha Cinzenta","Advogado","Reduz pressão legal.",2],
    ["informant","Olho Norte","Informador","Ativa inteligência policial.",2],
  ].map(([key,name,role,description,unlock])=>({
    key,name,role,description,unlock_rank:unlock,unlocked:rank.level>=unlock,
    favor:s.contacts[key]||0,remaining_s:Math.max(0,Math.ceil((Date.parse(s.contact_cooldowns[key]||0)-Date.now())/1000)),
  }));
  const gearCatalog=[
    {key:"vest",name:"Colete Modular",cost:2200,description:"Aumenta resistência em atividades de risco."},
    {key:"jammer",name:"Bloqueador de Sinal",cost:3200,description:"Reduz deteção técnica."},
    {key:"papers",name:"Documentos Frios",cost:2800,description:"Reduz atenção policial."},
    {key:"tires",name:"Pneus Reforçados",cost:2600,description:"Melhora fugas e corridas."},
  ].map(x=>({...x,owned:s.gear[x.key]||0,unlocked:true}));
  return {
    server_time:nowIso(),
    wanted:{stars,heat:save.player.heat,search_active:stars>=3,remaining_s:stars>=3?Math.round(stars*120):0},
    rank,
    event:{name:"Janela de Oportunidade",description:"Movimento urbano elevado cria mais alvos, mas chama atenção.",
      success:0.04,reward_mult:1.08,heat_mult:1.05,ends_at:new Date(Date.now()+25*60000).toISOString()},
    scanner:{force:save.player.region==="Lisboa"?"PSP":"PSP/GNR",alert:stars>=3?"Elevado":stars?"Vigilância":"Normal",
      hot_district:s.districts.slice().sort((a,b)=>b.rival_pressure-a.rival_pressure)[0]?.name||null,
      intel_active:!!s.intel_until&&Date.parse(s.intel_until)>Date.now(),
      intel_remaining_s:Math.max(0,Math.ceil((Date.parse(s.intel_until||0)-Date.now())/1000))},
    districts:s.districts, contacts,
    wagers:[
      {key:"cautious",name:"Cautelosa",cost:500,reward_mult:0.9,unlocked:true},
      {key:"standard",name:"Normal",cost:1500,reward_mult:1.2,unlocked:true},
      {key:"high",name:"Alta",cost:3500,reward_mult:1.7,unlocked:rank.level>=2},
    ],
    activities:[
      {key:"race",name:"Corrida Clandestina",description:"Velocidade e controlo sob pressão.",duration_s:20,base_success:.68,reward_min:4000,reward_max:7500,unlock_rank:1,unlocked:true},
      {key:"chop_shop",name:"Entrega à Desmontagem",description:"Entrega um veículo sem levantar suspeitas.",duration_s:22,base_success:.72,reward_min:7500,reward_max:13500,unlock_rank:2,unlocked:rank.level>=2},
      {key:"smuggling",name:"Rota Clandestina",description:"Move carga entre zonas controladas.",duration_s:26,base_success:.64,reward_min:12000,reward_max:22000,unlock_rank:3,unlocked:rank.level>=3},
    ],
    approaches:[
      {key:"ghost",name:"Fantasma",description:"Discrição máxima."},
      {key:"balanced",name:"Calculado",description:"Equilíbrio entre risco e retorno."},
      {key:"impact",name:"Impacto",description:"Mais recompensa e mais calor."},
    ],
    escape_plans:[
      {key:"low",name:"Baixo Perfil",description:"Menos notoriedade."},
      {key:"speed",name:"Velocidade",description:"Fuga rápida."},
      {key:"decoy",name:"Isca",description:"Desvia a resposta policial."},
    ],
    gear_catalog:gearCatalog,plan:s.plan,active_job:s.active_job ? {
      ...clone(s.active_job),
      remaining_s:Math.max(0,(Date.parse(s.active_job.finish_at)-Date.now())/1000),
      progress_pct:clamp(
        ((Date.now()-Date.parse(s.active_job.started_at)) /
          Math.max(1,Date.parse(s.active_job.finish_at)-Date.parse(s.active_job.started_at))) * 100,
        0,100
      ),
    } : null,
    vehicle_meta:save.vehicles.map(v=>({vehicle_id:v.id,notoriety:v.notoriety||0,cold_plates:!!v.cold_plates,insured:!!v.insured,impounded:false})),
    balances:{clean_money:save.player.clean_money,dirty_money:save.player.dirty_money,heat:save.player.heat},
  };
};

const MM_TARGETS=[
  {key:"auction",name:"Leilão da Meia-Noite",description:"Obras raras mudam de mãos numa rede privada.",base_reward:90000,base_success:0.68,heat:18,unlock_rank:1,
   preps:[{key:"routes",name:"Rotas de saída",cost:1800,duration_s:12,required:true},{key:"inside",name:"Ajuda interna",cost:2600,duration_s:14,required:true},{key:"signals",name:"Silenciar alarmes",cost:2200,duration_s:13,required:false}]},
  {key:"estuary",name:"Reserva do Estuário",description:"Carga financeira protegida em trânsito.",base_reward:175000,base_success:0.58,heat:26,unlock_rank:2,
   preps:[{key:"tracker",name:"Rastrear comboio",cost:3200,duration_s:15,required:true},{key:"vehicle",name:"Veículo de apoio",cost:4500,duration_s:17,required:true},{key:"inside",name:"Credenciais",cost:3000,duration_s:14,required:false}]},
  {key:"sovereign",name:"Nó Soberano",description:"Infraestrutura cifrada com segurança máxima.",base_reward:310000,base_success:0.48,heat:34,unlock_rank:4,
   preps:[{key:"keys",name:"Chaves de acesso",cost:6500,duration_s:18,required:true},{key:"network",name:"Mapa de rede",cost:5200,duration_s:18,required:true},{key:"escape",name:"Janela de fuga",cost:4800,duration_s:16,required:true}]},
];
const MM_APPROACHES=[
  {key:"silent",name:"Silencioso",unlock_rank:1},{key:"infiltration",name:"Infiltração",unlock_rank:2},{key:"shock",name:"Choque",unlock_rank:3},
];
const MM_FENCES=[
  {key:"quick",name:"Liquidação Rápida",unlock_rank:1},{key:"discreet",name:"Rede Discreta",unlock_rank:2},{key:"exclusive",name:"Comprador Exclusivo",unlock_rank:3},
];
const MM_GOODS=[
  {key:"chips",name:"Microchips Selados",description:"Componentes compactos com procura constante.",unlock_rank:1,space:1,base_price:900},
  {key:"art",name:"Caixas de Arte",description:"Peças valiosas, volumosas e difíceis de liquidar.",unlock_rank:2,space:3,base_price:2600},
  {key:"medical",name:"Malas Clínicas",description:"Material médico escasso com mercado estável.",unlock_rank:2,space:2,base_price:1700},
  {key:"cipher",name:"Chaves Cifradas",description:"Credenciais digitais raras e altamente voláteis.",unlock_rank:3,space:1,base_price:4200},
];

const mastermindRank=(xp)=>{
  const ranks=[[0,"Planeador"],[150,"Coordenador"],[450,"Arquiteto"],[900,"Mastermind"],[1600,"Lenda"]];
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
  const used=MM_GOODS.reduce((s,g)=>s+(m.market.holdings[g.key]||0)*g.space,0);
  const capacity=30+(save.player.hq.level||1)*10+save.properties.length*6;
  return {
    server_time:nowIso(),rank,
    targets:MM_TARGETS.map(t=>({...clone(t),unlocked:rank.level>=t.unlock_rank,intel_cost:1500*t.unlock_rank,
      cooldown_remaining_s:0,intel:m.intel[t.key]||null,intel_active:!!m.intel[t.key]})),
    approaches:MM_APPROACHES.map(x=>({...x,unlocked:rank.level>=x.unlock_rank})),
    fences:MM_FENCES.map(x=>({...x,unlocked:rank.level>=x.unlock_rank})),
    active_heist:active,
    market:{goods:MM_GOODS.map((g,i)=>{
      const wave=((Math.floor(Date.now()/900000)+i*3)%9)-4;
      const changePct=wave*3;
      return {...g,price:Math.round(g.base_price*(1+changePct/100)),
        change_pct:changePct,trend:changePct>0?"up":changePct<0?"down":"flat",
        owned:m.market.holdings[g.key]||0,unlocked:rank.level>=g.unlock_rank};
    }),
      capacity,used,raid_risk_pct:Math.round(3+save.player.heat*.2+(m.bounty||0)*.1),raid_log:m.market.raid_log||[]},
    bounty:{value:m.bounty||0,tier:Math.min(4,Math.floor((m.bounty||0)/25)),name:(m.bounty||0)>=75?"Caçada total":(m.bounty||0)>=50?"Esquadrão rival":(m.bounty||0)>=25?"Rastreio ativo":(m.bounty||0)>0?"Rumores":"Sem contrato",
      progress_pct:m.bounty||0,hunter_remaining_s:0,payoff_cost:Math.max(2000,(m.bounty||0)*180)},
    caches:{districts:(save.player.districts||[]).slice(0,8).map(d=>({...d,signature:`SIG-${d.key.toUpperCase()}`,collected:m.caches_collected.includes(d.key),remaining_s:0})),
      collected:m.caches_collected.length,total:Math.min(8,(save.player.districts||[]).length),completion_claimed:!!m.cache_completion_claimed},
    history:m.history||[],
    balances:{clean_money:save.player.clean_money,dirty_money:save.player.dirty_money,heat:save.player.heat},
  };
};

const publicState=(save)=>{
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
    bonuses:{heal:0,legal:0,bribe_discount:0,repair_discount:save.properties.some(p=>p.type_key==="oficina") ? 0.15 : 0},
    ...(()=>{
      const economy=LOCAL_CATALOG.economy_meta||{};
      const gross=save.employees.reduce((s,e)=>s+(e.salary||0),0);
      const employerSs=Math.round(gross*(economy.employer_social_security_rate||0.2375));
      const fleetWeekly=Math.round(save.vehicles.reduce(
        (sum,v)=>sum+((economy.vehicle_annual_fixed_costs?.[v.model_key]||0)/52),0
      ));
      return {
        salary_total:gross,
        weekly_fixed_total:gross+employerSs+fleetWeekly,
        weekly_cost_breakdown:{gross_salaries:gross,employer_social_security:employerSs,fleet_fixed:fleetWeekly},
      };
    })(),
    fuel_prices:clone(LOCAL_CATALOG.fuel_prices),
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
  save.street.districts=[];
  save.opportunities=makeOpportunities(save,9);
  addEvent(save,"system","Quartel-General estabelecido. A rede local começou a gerar oportunidades.");
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
    return {chance,reward:opp.reward,reward_bonus_pct:0,age_decay_pct:0,split_penalty_pct:0,
      fuel_needed:vehicle?Math.max(1,Math.round((opp.dist_km*2*vehicle.cons/100)*10)/10):0,
      eta_s:10+Math.round(opp.dist_km*2),duration_s:opp.duration_s||24,
      breakdown:[
        {key:"base",label:"Base",pct:.5},{key:"team",label:"Competência",pct:(chance-.5)/2},
        {key:"risk",label:"Risco",pct:-(opp.risk||0)/500},{key:"heat",label:"Calor",pct:-save.player.heat/1000},
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
    const start=Date.now(),eta=10000+opp.dist_km*1200,oper=(opp.duration_s||24)*1000,ret=eta*.8;
    const mission={id:uid("mission"),opportunity_id:opp.id,team_id:team.id,team_name:team.name,vehicle_id:vehicle.id,
      member_ids:members.map(e=>e.id),category:opp.category,risk:opp.risk,reward:opp.reward,pays:opp.pays,
      fuel_needed:fuelNeeded,distance_km:opp.dist_km,chance:missionChance(save,opp,team),phase:"en_route",
      started_at:new Date(start).toISOString(),arrive_at:new Date(start+eta).toISOString(),
      finish_at:new Date(start+eta+oper).toISOString(),return_at:new Date(start+eta+oper+ret).toISOString(),
      target:{lat:opp.lat,lng:opp.lng},opportunity:{id:opp.id,name:opp.name,type_key:opp.type_key}};
    team.status="on_mission";members.forEach(e=>e.status="on_mission");opp.status="taken";save.missions.push(mission);
    addEvent(save,"dispatch",`${team.name} saiu para ${opp.name}.`);return {ok:true,mission_id:mission.id};
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
    if(caps.teams.used>=caps.teams.max)fail(400,"Limite de equipas atingido");chargeClean(save,LOCAL_CATALOG.team_create_cost,"Formação de equipa");
    const t=makeTeam();t.name=`Crew ${String.fromCharCode(65+save.teams.length)}`;t.spec=p.spec||"assalto";t.vehicle_id=null;save.teams.push(t);return {ok:true,team_id:t.id};
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
    if(path==="properties/buy"){const cfg=LOCAL_CATALOG.property_types[p.type_key];if(!cfg)fail(400,"Tipo inválido");if(save.player.level<cfg.min_level)fail(400,"Nível insuficiente");chargeClean(save,cfg.price,"Compra de propriedade");const nearest=(save.player.districts||[]).slice().sort((a,b)=>{
      const da=(a.lat-Number(p.lat))**2+(a.lng-Number(p.lng))**2;
      const db=(b.lat-Number(p.lat))**2+(b.lng-Number(p.lng))**2;
      return da-db;
    })[0];
    const np={id:uid("prop"),type_key:p.type_key,name:cfg.name,district:nearest?.name||"Zona operacional",lat:Number(p.lat),lng:Number(p.lng),level:1,price:cfg.price,condition:100,upgrading_until:null};save.properties.push(np);return {ok:true,property_id:np.id};}
    if(path==="properties/sell"){const value=Math.round(pr.price*.7*pr.level);save.player.clean_money+=value;save.properties=save.properties.filter(x=>x.id!==pr.id);return {ok:true};}
    if(path==="properties/upgrade"){if(pr.level>=LOCAL_CATALOG.property_max_level)fail(400,"Nível máximo");const cost=Math.round(pr.price*.6*pr.level);chargeClean(save,cost,"Melhoria de propriedade");pr.upgrading_until=new Date(Date.now()+15000).toISOString();return {ok:true};}
    if(path==="properties/rename"){pr.name=String(p.name||pr.name).slice(0,40);return {ok:true};}
    if(path==="properties/optimize")return {ok:true,message:"Portefólio revisto — nenhuma alteração urgente necessária."};
  }
  if(path==="hq/upgrade"){const level=save.player.hq?.level||1;const next=LOCAL_CATALOG.hq_level_benefits[level];if(!next)fail(400,"Quartel-General no nível máximo");chargeClean(save,next.upgrade_cost,"Melhoria do QG");save.player.hq.upgrading_until=new Date(Date.now()+20000).toISOString();return {ok:true};}
  if(path==="hq/priority"){save.player.priorities.active=p.priority||"equilibrio";return {ok:true};}
  if(path==="hq/equip_skin"){save.player.hq_skin_key=p.skin_key||null;return {ok:true};}
  if(path==="police/bribe"){const cost=Math.max(1200,Math.round(save.player.heat*120));chargeClean(save,cost,"Suborno");save.player.heat=Math.max(0,save.player.heat-28);return {ok:true,cost};}
  if(path==="launder"){const amount=Math.min(money(p.amount),save.player.dirty_money);if(amount<=0)fail(400,"Montante inválido");save.player.dirty_money-=amount;const received=Math.round(amount*(LOCAL_CATALOG.economy_meta?.launder_base_rate||.78));save.player.clean_money+=received;tx(save,"launder",received,"clean","Lavagem");return {ok:true,received};}
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

  if(path==="street/plan"){save.street.plan={...save.street.plan,...p};return {ok:true};}
  if(path==="street/gear/buy"){const prices={vest:2200,jammer:3200,papers:2800,tires:2600};const cost=(prices[p.gear_key]||2500)*(p.quantity||1);chargeClean(save,cost,"Equipamento de rua");save.street.gear[p.gear_key]=(save.street.gear[p.gear_key]||0)+(p.quantity||1);return {ok:true};}
  if(path==="street/territory"){const d=save.street.districts.find(x=>x.key===p.district_key);if(!d)fail(404,"Zona não encontrada");if(p.action==="claim"){if(d.influence<100)fail(400,"Influência insuficiente");chargeClean(save,5000,"Tomada territorial");d.controlled=true;d.tier=1;d.income_per_h=450;}else if(p.action==="reinforce"){d.tier=Math.min(3,d.tier+1);d.income_per_h=450*d.tier;}else if(p.action==="defend"){d.rival_pressure=Math.max(0,d.rival_pressure-35);}return {ok:true};}
  if(path==="street/contacts/call"){const key=p.contact_key;save.street.contacts[key]=(save.street.contacts[key]||0)+1;save.street.contact_cooldowns[key]=new Date(Date.now()+5*60000).toISOString();if(key==="fixer"||key==="lawyer")save.player.heat=Math.max(0,save.player.heat-(key==="lawyer"?14:9));if(key==="mechanic"){const v=save.vehicles.find(x=>x.id===p.vehicle_id);if(v){v.condition=Math.min(100,v.condition+25);v.notoriety=Math.max(0,(v.notoriety||0)-20);}}if(key==="informant")save.street.intel_until=new Date(Date.now()+15*60000).toISOString();return {ok:true};}
  if(path==="street/activities/start"){
    if(save.street.active_job)fail(409,"Já existe uma atividade em curso");
    const defs={
      race:{name:"Corrida Clandestina",reward:5200,duration:20,chance:.68},
      chop_shop:{name:"Entrega à Desmontagem",reward:10500,duration:22,chance:.72},
      smuggling:{name:"Rota Clandestina",reward:17000,duration:26,chance:.64},
    };
    const d=defs[p.job_key];if(!d)fail(400,"Atividade inválida");
    const rank=streetRank(save.street.rep||0);
    if(p.job_key==="chop_shop"&&rank.level<2)fail(400,"Esta atividade requer nível de rua 2");
    if(p.job_key==="smuggling"&&rank.level<3)fail(400,"Esta atividade requer nível de rua 3");
    const vehicle=save.vehicles.find(v=>v.id===p.vehicle_id);if(!vehicle)fail(400,"Seleciona um veículo");
    const district=save.street.districts.find(x=>x.key===p.district_key);if(!district)fail(400,"Seleciona uma zona");
    const stake=p.job_key==="race"?({cautious:500,standard:1500,high:3500}[p.wager_key]||1500):0;
    if(stake)chargeClean(save,stake,"Aposta virtual");
    const mult=p.wager_key==="high"?1.7:p.wager_key==="cautious"?.9:1.2;
    const approach=save.street.plan?.approach_key||"balanced";
    const chance=clamp(d.chance+(approach==="ghost"?.06:approach==="impact"?-.06:0)-save.player.heat*.001,0.2,.95);
    save.street.active_job={
      id:uid("street"),job_key:p.job_key,name:d.name,district_key:p.district_key,district_name:district.name,
      vehicle_id:p.vehicle_id,vehicle_name:vehicle.name,status:"running",started_at:nowIso(),
      finish_at:new Date(Date.now()+d.duration*1000).toISOString(),
      reward:Math.round((d.reward+stake)*mult),chance,approach_key:approach,wager_key:p.wager_key||null,
    };
    return {ok:true};
  }
  if(path==="street/activities/claim"){
    const job=save.street.active_job;if(!job||job.id!==p.job_id)fail(404,"Atividade não encontrada");
    if(job.status!=="ready")fail(400,"Atividade ainda em curso");
    const success=rollFrom(job.id)<=job.chance;
    const d=save.street.districts.find(x=>x.key===job.district_key);
    if(success){
      save.player.dirty_money+=job.reward;save.street.rep+=35;
      if(d)d.influence=Math.min(150,d.influence+28);
      save.player.heat=clamp(save.player.heat+6,0,100);
    }else{
      save.street.rep+=8;save.player.heat=clamp(save.player.heat+12,0,100);
      if(d)d.rival_pressure=clamp((d.rival_pressure||0)+10,0,100);
    }
    save.street.active_job=null;
    return {ok:true,success,reward:success?job.reward:0};
  }
  if(path==="street/garage"){const v=save.vehicles.find(x=>x.id===p.vehicle_id);if(!v)fail(404,"Veículo não encontrado");if(p.action==="plates"){chargeClean(save,1800,"Matrículas frias");v.cold_plates=true;v.notoriety=Math.max(0,(v.notoriety||0)-30);}else if(p.action==="insure"){chargeClean(save,2200,"Seguro clandestino");v.insured=true;}else if(p.action==="recover"){chargeClean(save,3200,"Recuperação do veículo");v.impounded_until=null;}return {ok:true};}

  if(path==="mastermind/heists/intel"){const target=MM_TARGETS.find(x=>x.key===p.target_key);if(!target)fail(404,"Alvo não encontrado");const cost=1500*target.unlock_rank;chargeClean(save,cost,"Dossiê Mastermind");save.mastermind.intel[target.key]={scouted_at:nowIso(),expires_at:new Date(Date.now()+30*60000).toISOString(),recommended_approach:"silent",recommended_name:"Silencioso",reward_min:Math.round(target.base_reward*.72),reward_max:Math.round(target.base_reward*1.34),risk_note:"Rotas sob vigilância"};return {ok:true};}
  if(path==="mastermind/heists/create"){if(save.mastermind.active_heist)fail(409,"Já existe um grande golpe em preparação");const target=MM_TARGETS.find(x=>x.key===p.target_key);const team=save.teams.find(x=>x.id===p.team_id),vehicle=save.vehicles.find(x=>x.id===p.vehicle_id);if(!target||!team||!vehicle)fail(400,"Configuração incompleta");const approach=MM_APPROACHES.find(x=>x.key===p.approach_key)||MM_APPROACHES[0],fence=MM_FENCES.find(x=>x.key===p.fence_key)||MM_FENCES[0];save.mastermind.active_heist={id:uid("heist"),target_key:target.key,target_name:target.name,team_id:team.id,team_name:team.name,vehicle_id:vehicle.id,vehicle_name:vehicle.name,approach_key:approach.key,approach_name:approach.name,fence_key:fence.key,fence_name:fence.name,crew_cut_pct:Number(p.crew_cut_pct||20),phase:"planning",preps:target.preps.map(x=>({...x,status:"available",attempts:0})),current_prep:null,finale:null};return {ok:true};}
  if(path==="mastermind/heists/prep/start"){const h=save.mastermind.active_heist;if(!h||h.id!==p.heist_id)fail(404,"Plano não encontrado");if(h.current_prep)fail(409,"Já existe preparação em curso");const prep=h.preps.find(x=>x.key===p.prep_key);if(!prep)fail(404,"Preparação não encontrada");chargeClean(save,prep.cost,"Preparação Mastermind");prep.status="running";prep.attempts=(prep.attempts||0)+1;h.current_prep={...prep,prep_key:prep.key,status:"running",started_at:nowIso(),finish_at:new Date(Date.now()+prep.duration_s*1000).toISOString()};return {ok:true};}
  if(path==="mastermind/heists/prep/claim"){const h=save.mastermind.active_heist;if(!h?.current_prep||h.current_prep.prep_key!==p.prep_key)fail(404,"Preparação não encontrada");if(h.current_prep.status!=="ready")fail(400,"Preparação ainda em curso");const prep=h.preps.find(x=>x.key===p.prep_key);prep.status="complete";h.current_prep=null;return {ok:true,success:true,message:"Preparação concluída."};}
  if(path==="mastermind/heists/launch"){const h=save.mastermind.active_heist;if(!h||h.id!==p.heist_id)fail(404,"Plano não encontrado");if(!h.preps.filter(x=>x.required).every(x=>x.status==="complete"))fail(400,"Conclui as preparações obrigatórias");const target=MM_TARGETS.find(x=>x.key===h.target_key);const reward=Math.round(target.base_reward*(1-h.crew_cut_pct/100));h.finale={status:"running",started_at:nowIso(),finish_at:new Date(Date.now()+25000).toISOString(),chance:clamp(target.base_success+save.mastermind.xp/10000-save.player.heat*.001,0.15,.92),net_reward:reward,loot_capacity_pct:85,complication_name:"Janela Instável",complication_description:"A segurança alterou a rotina no último momento."};h.phase="finale";return {ok:true};}
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

  if(verb==="get"&&path==="/auth/me") return {data:getLocalGuestUser(),status:200};
  if(verb==="post"&&path==="/auth/logout") return {data:{ok:true},status:200};
  if(verb==="post"&&path==="/auth/delete-account"){resetLocalGuestGame();return {data:{ok:true},status:200};}
  if(verb==="post"&&path==="/legal/disclaimer-ack"){save.user.disclaimer_accepted=true;persist(save);return {data:{ok:true},status:200};}
  if(verb==="get"&&path==="/game/catalog") return {data:clone(LOCAL_CATALOG),status:200};
  if(verb==="get"&&path==="/game/state"){persist(save);return {data:publicState(save),status:200};}
  if(verb==="get"&&path==="/game/street/state"){const data=streetSnapshot(save);persist(save);return {data,status:200};}
  if(verb==="get"&&path==="/game/mastermind/state"){const data=mastermindSnapshot(save);persist(save);return {data,status:200};}
  if(verb==="get"&&path==="/game/transactions") return {data:{transactions:clone(save.transactions)},status:200};

  if(verb==="post"&&path.startsWith("/game/")){
    const actionPath=path.slice("/game/".length);
    const data=mutateGame(save,actionPath,payload);
    persist(save);
    return {data,status:200};
  }

  fail(404,`Rota local não implementada: ${verb.toUpperCase()} ${path}`);
}
