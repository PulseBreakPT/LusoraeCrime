const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const LOCAL_CERTIFICATIONS = {
  combate:{key:"combate_operacional",name:"Combate Operacional"},
  conducao:{key:"conducao_avancada",name:"Condução Avançada"},
  hacking:{key:"operacoes_tecnicas",name:"Operações Técnicas"},
  discricao:{key:"vigilancia_discreta",name:"Vigilância Discreta"},
  negociacao:{key:"negociacao_operacional",name:"Negociação Operacional"},
  primeiros_socorros:{key:"primeiros_socorros",name:"Primeiros Socorros"},
  logistica:{key:"logistica_avancada",name:"Logística Avançada"},
  gestao:{key:"gestao_operacional",name:"Gestão Operacional"},
  lideranca:{key:"lideranca_operacional",name:"Liderança Operacional"},
  treino_fisico:{key:"aptidao_operacional",name:"Aptidão Operacional"},
};

export const LOCAL_DISPATCH_PRESETS = {
  baixo_perfil:{name:"Baixo Perfil",preferred_specs:["tecnica","influencia"],min_chance:.72,max_heat:72,min_vehicle_condition:65,prefer_discreet_vehicle:true,reserve_teams:1,supplies:["disguise_kit","electronics_kit"]},
  assalto_pesado:{name:"Assalto Pesado",preferred_specs:["assalto"],min_chance:.62,max_heat:82,min_vehicle_condition:72,prefer_discreet_vehicle:false,reserve_teams:1,supplies:["body_armor","medical_kit","entry_tools"]},
  logistica_segura:{name:"Logística Segura",preferred_specs:["logistica"],min_chance:.70,max_heat:76,min_vehicle_condition:70,prefer_discreet_vehicle:true,reserve_teams:1,supplies:["burner_phones","medical_kit"]},
};

const CATEGORY_REQ = {
  assalto:{required:["assaltante"],recommended:["motorista","seguranca","medico"],certs:["combate_operacional"]},
  logistica:{required:["motorista"],recommended:["contrabandista","estafeta","mecanico"],certs:["conducao_avancada"]},
  tecnica:{required:["hacker"],recommended:["criptografo","engenheiro_social","espiao"],certs:["operacoes_tecnicas"]},
  influencia:{required:["negociador"],recommended:["advogado","informador","relacoes_publicas"],certs:["negociacao_operacional"]},
  especial:{required:[],recommended:["motorista","medico","negociador","hacker"],certs:[]},
};

const PROFILE_REQ = {
  digital:{roles:["hacker","criptografo"],certs:["operacoes_tecnicas"]},
  mobility:{roles:["motorista","piloto"],certs:["conducao_avancada"]},
  stealth:{roles:["espiao","arrombador"],certs:["vigilancia_discreta"]},
  influence:{roles:["negociador","advogado"],certs:["negociacao_operacional"]},
  confrontation:{roles:["assaltante","seguranca"],certs:["combate_operacional"]},
};

const DISTRICT_ARCHETYPES = {
  residencial:{name:"Residencial",tags:["residencial","local"]},
  comercial:{name:"Comercial",tags:["comercial","serviços","movimento"]},
  industrial:{name:"Industrial",tags:["industrial","armazéns","logística"]},
  turistico:{name:"Turístico",tags:["turismo","hotelaria","movimento"]},
  portuario:{name:"Portuário",tags:["porto","carga","costeiro"]},
  rural:{name:"Rural",tags:["rural","baixa densidade"]},
  empresarial:{name:"Empresarial",tags:["empresas","escritórios","tecnologia"]},
};

const hash = (value) => {
  let h = 2166136261;
  for (const ch of String(value || "")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const localDistrictProfile = (district = {}) => {
  const name = typeof district === "string" ? district : String(district.name || district.key || "Zona");
  const key = typeof district === "string" ? district : String(district.key || name);
  const ring = Number(typeof district === "string" ? 1 : district.ring ?? 1);
  const folded = name.toLowerCase();
  const keywordMap = [
    [["porto","marina","doca","cais"],"portuario"],
    [["industrial","parque","armaz"],"industrial"],
    [["hotel","praia","turis","avenida"],"turistico"],
    [["empres","tecn","escrit"],"empresarial"],
    [["comercial","mercado","centro"],"comercial"],
  ];
  let chosen = keywordMap.find(([words]) => words.some((w) => folded.includes(w)))?.[1];
  if (!chosen) {
    const pool = ring >= 2
      ? ["rural","industrial","portuario","residencial"]
      : ring <= 0
      ? ["comercial","empresarial","residencial","turistico"]
      : Object.keys(DISTRICT_ARCHETYPES);
    chosen = pool[hash(key + ":" + name + ":" + ring) % pool.length];
  }
  return {key:chosen,ring,...DISTRICT_ARCHETYPES[chosen]};
};

export const localOperationRequirements = (opp = {}) => {
  const category = opp.category || "especial";
  const risk = clamp(Math.round(Number(opp.risk || 1)),1,5);
  const base = CATEGORY_REQ[category] || CATEGORY_REQ.especial;
  const profile = PROFILE_REQ[opp.profile] || {};
  const requiredRoles = new Set(base.required);
  const recommendedRoles = new Set([...(base.recommended || []),...(profile.roles || [])]);
  const requiredCerts = new Set();
  const recommendedCerts = new Set([...(base.certs || []),...(profile.certs || [])]);
  let supportTeams = 0;
  if (risk >= 4) {
    supportTeams = 1;
    (base.certs || []).forEach((cert) => requiredCerts.add(cert));
    if (category === "especial" && recommendedRoles.size) requiredRoles.add([...recommendedRoles].sort()[0]);
  }
  if (risk >= 5) {
    supportTeams = 2;
    (profile.certs || []).forEach((cert) => requiredCerts.add(cert));
  }
  return {
    required_roles:[...requiredRoles],
    recommended_roles:[...recommendedRoles].filter((role)=>!requiredRoles.has(role)),
    required_certifications:[...requiredCerts],
    recommended_certifications:[...recommendedCerts].filter((cert)=>!requiredCerts.has(cert)),
    min_members:Math.max(Number(opp.min_members || 1),risk>=3?2:1),
    support_teams:supportTeams,
    required_models:[...(opp.required_models || [])],
    recommended_vehicle_condition:55+risk*7,
    recommended_stock:[
      ...(risk>=3?["medical_kit"]:[]),
      ...(category==="assalto"&&risk>=4?["body_armor"]:[]),
      ...(category==="tecnica"?["electronics_kit"]:[]),
      ...(category==="influencia"?["disguise_kit"]:[]),
    ],
  };
};

export const localMissingTeamRequirements = (requirements, members = []) => {
  const roles = new Set(members.map((m)=>m.role_key).filter(Boolean));
  const certs = new Set(members.flatMap((m)=>m.certifications || []));
  const missing = [];
  if (members.length < Number(requirements.min_members || 1)) {
    missing.push({kind:"members",key:"min_members",label:`Mínimo de ${requirements.min_members || 1} operacionais`});
  }
  for (const role of requirements.required_roles || []) {
    if (!roles.has(role)) missing.push({kind:"role",key:role,label:`Falta na equipa: ${role.replaceAll("_"," ")}`});
  }
  for (const cert of requirements.required_certifications || []) {
    if (!certs.has(cert)) missing.push({kind:"certification",key:cert,label:`Falta certificação: ${cert.replaceAll("_"," ")}`});
  }
  return missing;
};

export const enrichLocalOpportunities = (save) => {
  const idleTeams = (save.teams || []).filter((t)=>t.status==="idle");
  const employees = save.employees || [];
  const vehicleModels = new Set((save.vehicles || []).filter((v)=>Number(v.condition||0)>=30&&!v.seized_until).map((v)=>v.model_key));
  const globalRoles = new Set(employees.filter((e)=>["idle","resting"].includes(e.status)).map((e)=>e.role_key));
  const globalCerts = new Set(employees.filter((e)=>["idle","resting"].includes(e.status)).flatMap((e)=>e.certifications || []));
  const districtMap = Object.fromEntries((save.player.districts || []).map((d)=>[String(d.name),d]));

  return (save.opportunities || []).map((raw)=>{
    const opp = {...raw};
    const req = localOperationRequirements(opp);
    const missing = [];
    const warnings = [];
    for (const role of req.required_roles) if(!globalRoles.has(role)) missing.push({kind:"role",key:role,label:`Falta especialista: ${role.replaceAll("_"," ")}`});
    for (const cert of req.required_certifications) if(!globalCerts.has(cert)) missing.push({kind:"certification",key:cert,label:`Falta certificação: ${cert.replaceAll("_"," ")}`});
    if(req.required_models.length&&!req.required_models.some((m)=>vehicleModels.has(m))) missing.push({kind:"vehicle",key:"required_model",label:"Falta veículo compatível"});
    if(!idleTeams.length) missing.push({kind:"team",key:"idle_team",label:"Não há equipa pronta"});
    else {
      const primaryReady = idleTeams.some((team)=>{
        const members=employees.filter((e)=>e.team_id===team.id&&e.status==="idle"&&Number(e.fatigue||0)<90);
        return localMissingTeamRequirements(req,members).length===0;
      });
      if(!primaryReady&&!missing.length) warnings.push({kind:"composition",key:"reorganize_primary",label:"Os recursos existem, mas tens de reorganizar uma equipa principal"});
      if(req.support_teams&&idleTeams.length<1+req.support_teams) warnings.push({kind:"support",key:"support_teams",label:`Recomendado: ${req.support_teams} equipa(s) de apoio`});
    }
    for(const stock of req.recommended_stock) if(Number(save.player.inventory?.[stock]||0)<=0) warnings.push({kind:"stock",key:stock,label:`Sem ${stock.replaceAll("_"," ")}`});
    for(const role of req.recommended_roles) if(!globalRoles.has(role)) warnings.push({kind:"role",key:role,label:`Recomendado: ${role.replaceAll("_"," ")}`});
    const readiness = missing.length?"locked":warnings.length?"stretch":"playable";
    opp.requirements=req;
    opp.readiness={
      state:readiness,requirements:req,missing,warnings:warnings.slice(0,6),
      summary:readiness==="playable"?"Pronta com os recursos atuais":readiness==="stretch"?"Executável, mas abaixo da preparação ideal":"A organização ainda não tem capacidade mínima",
    };
    opp.district_profile=localDistrictProfile(districtMap[String(opp.district)] || String(opp.district || "Zona"));
    return opp;
  });
};

export const localOperationalSnapshot = (save, world) => {
  const opportunities = enrichLocalOpportunities(save);
  const counts={playable:0,stretch:0,locked:0};
  opportunities.filter((o)=>o.status==="active").forEach((o)=>{counts[o.readiness?.state||"playable"]+=1;});
  const activeMissions=(save.missions||[]).filter((m)=>m.phase!=="done");
  const requiresAction=[];
  const now=Date.now();
  for(const mission of activeMissions){
    const decision=mission.decision||{};
    if(decision.status==="pending"&&Date.parse(decision.opens_at)<=now&&Date.parse(decision.expires_at)>=now){
      requiresAction.push({kind:"decision",mission_id:mission.id,title:decision.title||"Decisão tática",team:mission.team_name,expires_at:decision.expires_at});
    }
    const request=mission.reinforcement_request||{};
    if(request.status==="pending"){
      requiresAction.push({kind:"reinforcement",mission_id:mission.id,title:request.title||"Pedido de reforço",team:mission.team_name,expires_at:request.expires_at});
    }
  }
  const coverage=(save.player.districts||[]).map((district)=>{
    const name=district.name||district.key;
    const territory=save.player.territories?.[name]||{};
    return {
      district:name,lat:district.lat,lng:district.lng,profile:localDistrictProfile(district),
      active_operations:opportunities.filter((o)=>o.status==="active"&&o.district===name).length,
      attention:Number(save.player.district_attention?.[name]||0),
      territory_tier:Number(territory.tier||0),pressure:Number(territory.pressure||0),
    };
  }).sort((a,b)=>b.active_operations-a.active_operations||b.attention-a.attention).slice(0,12);
  return {
    requires_action:requiresAction,readiness_counts:counts,
    available_teams:(save.teams||[]).filter((t)=>t.status==="idle").length,
    usable_vehicles:(save.vehicles||[]).filter((v)=>Number(v.condition||0)>=30&&!v.seized_until).length,
    active_missions:activeMissions.length,coverage,world:world||{},
    presets:{...LOCAL_DISPATCH_PRESETS,...(save.player.dispatch_presets||{})},
    staging_areas:[...(save.player.staging_areas||[])],
    operational_rules:{...(save.player.operational_rules||{})},
  };
};

export const localReinforcementEffect = (mission, team, members, vehicle) => {
  const category=mission.opportunity?.category||mission.category||"especial";
  let delta=.015+Math.min(.035,members.length*.007);
  if(team.spec===category||category==="especial") delta+=.018;
  if(Number(vehicle?.condition||0)>=75) delta+=.008;
  return {chance_delta:Math.min(.07,Math.round(delta*1000)/1000),injury_mult:members.length>=2?.92:.96,label:`${team.name} · ${members.length} operacionais`};
};

const chainRule = {
  success:{chance:.24,kind:"follow_up",risk_delta:1,reward_mult:1.22},
  partial:{chance:.18,kind:"follow_up",risk_delta:0,reward_mult:1.10},
  failure:{chance:.20,kind:"recovery",risk_delta:1,reward_mult:.95},
  police:{chance:.28,kind:"cleanup",risk_delta:1,reward_mult:1.05},
};

export const buildLocalFollowUp = (mission) => {
  const rule=chainRule[mission.outcome];
  if(!rule) return null;
  const stage=Number(mission.chain_stage||0)+1;
  if(stage>3) return null;
  const token=hash(`${mission.id}:${mission.outcome}:chain`)/0xFFFFFFFF;
  if(token>rule.chance) return null;
  const source=mission.opportunity||{};
  const target=mission.target||{};
  const chainId=mission.chain_id||mission.id||mission.opportunity_id;
  const names={follow_up:"Pista quente",recovery:"Recuperação urgente",cleanup:"Limpeza de exposição"};
  const angle=(hash(`${chainId}:${stage}`)%360)*Math.PI/180;
  const radius=.004+.0015*stage;
  return {
    id:`chain_${hash(chainId+":"+stage+":"+mission.outcome).toString(36)}`,
    type_key:source.type_key||"operacao_encoberta",
    name:`${names[rule.kind]} · ${source.name||"Operação"}`,
    category:source.category||mission.category||"especial",district:source.district||"Zona",
    lat:Number(target.lat||0)+Math.cos(angle)*radius,lng:Number(target.lng||0)+Math.sin(angle)*radius,
    reward:Math.max(500,Math.round(Number(source.reward||mission.reward||1000)*rule.reward_mult)),
    respect:Math.max(1,Number(source.respect||5)+stage),
    risk:clamp(Number(source.risk||mission.risk||2)+rule.risk_delta,1,5),
    heat:Number(source.heat||2)*(1+.08*stage),pays:source.pays||mission.pays||"dirty",
    rare:stage>=2,hot:true,dist_km:Number(source.distance_km||mission.distance_km||0),
    min_members:Math.max(1,Number(source.min_members||1)),required_models:[...(source.required_models||[])],
    duration_s:180,min_level:Number(source.min_level||1),status:"active",
    expires_at:new Date(Date.now()+22*60000).toISOString(),created_at:new Date().toISOString(),
    profile:source.profile||mission.operation_profile||"confrontation",
    chain_id:chainId,parent_mission_id:mission.id,chain_stage:stage,chain_kind:rule.kind,
  };
};
