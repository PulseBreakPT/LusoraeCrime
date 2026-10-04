const clone = (v) => JSON.parse(JSON.stringify(v));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const nowIso = () => new Date().toISOString();
const uid = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;

const WEATHER = {
  ceu_limpo:{name:"Céu limpo",weight:30,chance:{},travel_mult:1,heat_mult:1,reward_mult:1,description:"Visibilidade normal e circulação previsível."},
  nublado:{name:"Nublado",weight:24,chance:{tecnica:.01,logistica:.01},travel_mult:1,heat_mult:.99,reward_mult:1,description:"Condições neutras com ligeira redução de exposição."},
  chuva:{name:"Chuva",weight:22,chance:{assalto:.025,tecnica:.02,influencia:-.01},travel_mult:1.08,heat_mult:.94,reward_mult:1.02,description:"Menos visibilidade, estradas mais lentas e menor exposição."},
  chuva_forte:{name:"Chuva forte",weight:10,chance:{assalto:.04,tecnica:.03,logistica:-.025},travel_mult:1.16,heat_mult:.9,reward_mult:1.04,description:"Cobertura excelente, mas deslocações claramente mais difíceis."},
  nevoeiro:{name:"Nevoeiro",weight:8,chance:{assalto:.035,tecnica:.025,logistica:-.035},travel_mult:1.12,heat_mult:.91,reward_mult:1.03,description:"Baixa visibilidade favorece discrição e penaliza condução."},
  tempestade:{name:"Tempestade",weight:6,chance:{assalto:.055,tecnica:.045,logistica:-.055},travel_mult:1.24,heat_mult:.86,reward_mult:1.07,description:"Caos urbano: mais cobertura, muito mais risco logístico."},
};
const DAYPART = {
  madrugada:{name:"Madrugada",chance:{assalto:.025,tecnica:.02,logistica:.01},police_mult:.9,traffic_mult:.78,reward_mult:1.02},
  manha:{name:"Manhã",chance:{influencia:.015,logistica:-.01},police_mult:1.02,traffic_mult:1.12,reward_mult:1},
  tarde:{name:"Tarde",chance:{influencia:.01},police_mult:1.05,traffic_mult:1.16,reward_mult:1},
  noite:{name:"Noite",chance:{assalto:.02,tecnica:.015},police_mult:.96,traffic_mult:.92,reward_mult:1.025},
};
const EVENTS = {
  operacao_policial:{name:"Operação policial reforçada",severity:"high",chance:{assalto:-.055,logistica:-.03,tecnica:-.02},heat_mult:1.22,reward_mult:1.08,description:"Fiscalização reforçada e patrulhamento adicional em zonas sensíveis."},
  evento_desportivo:{name:"Grande evento urbano",severity:"medium",chance:{assalto:.02,influencia:.025,logistica:-.015},heat_mult:.96,reward_mult:1.04,description:"Multidões e trânsito alteram rotinas, vigilância e circulação."},
  greve_transportes:{name:"Perturbação nos transportes",severity:"medium",chance:{logistica:-.035,assalto:.015},heat_mult:.98,reward_mult:1.05,description:"Rotas congestionadas e padrões de movimento fora do normal."},
  apagao_local:{name:"Falhas de energia",severity:"high",chance:{tecnica:.055,assalto:.035,influencia:-.025},heat_mult:.9,reward_mult:1.08,description:"Sistemas degradados e iluminação reduzida em várias zonas."},
  feira_negra:{name:"Feira clandestina",severity:"medium",chance:{logistica:.03,influencia:.03},heat_mult:1.03,reward_mult:1.1,description:"Procura temporária por mercadoria e serviços clandestinos."},
  calmaria:{name:"Cidade estável",severity:"low",chance:{},heat_mult:.97,reward_mult:1,description:"Sem perturbações excecionais. Rotinas previsíveis."},
};
export const LOCAL_BUSINESS_TYPES = {
  bar:{name:"Bar",price:42000,clean_h:210,dirty_h:40,heat_h:.03,security:25,max_level:5,effects:{influencia:.006},description:"Receita estável e fonte de contactos locais."},
  discoteca:{name:"Discoteca",price:115000,clean_h:480,dirty_h:180,heat_h:.1,security:32,max_level:5,effects:{influencia:.012,assalto:.004},description:"Rendimento noturno elevado, informação e maior exposição."},
  oficina_privada:{name:"Oficina privada",price:78000,clean_h:340,dirty_h:55,heat_h:.025,security:40,max_level:5,effects:{logistica:.012},description:"Rede logística, manutenção e circulação de veículos."},
  transportadora:{name:"Transportadora",price:145000,clean_h:610,dirty_h:150,heat_h:.07,security:42,max_level:5,effects:{logistica:.018},description:"Cobertura para operações logísticas e cadeia de abastecimento."},
  empresa_seguranca:{name:"Empresa de segurança",price:190000,clean_h:760,dirty_h:90,heat_h:.05,security:62,max_level:5,effects:{assalto:.008,influencia:.008},description:"Inteligência de terreno e segurança empresarial."},
  imobiliaria:{name:"Imobiliária",price:230000,clean_h:980,dirty_h:130,heat_h:.055,security:45,max_level:5,effects:{influencia:.015},description:"Fluxo limpo elevado e acesso privilegiado ao mercado urbano."},
  casa_apostas:{name:"Casa de apostas",price:275000,clean_h:900,dirty_h:420,heat_h:.18,security:48,max_level:5,effects:{influencia:.012},description:"Margens fortes e lavagem elevada, com maior risco regulatório."},
  empresa_tecnologia:{name:"Empresa tecnológica",price:320000,clean_h:1320,dirty_h:120,heat_h:.04,security:52,max_level:5,effects:{tecnica:.022},description:"Infraestrutura técnica, dados e capacidade digital."},
  hotel:{name:"Hotel",price:420000,clean_h:1680,dirty_h:260,heat_h:.08,security:55,max_level:5,effects:{influencia:.016,logistica:.008},description:"Rede de contactos, alojamento e cobertura logística."},
  marina:{name:"Marina",price:520000,clean_h:1820,dirty_h:520,heat_h:.16,security:58,max_level:5,effects:{logistica:.026},description:"Late game logístico com forte capacidade de circulação."},
};
const RIVAL_NAMES = [
  ["Ordem do Norte","disciplina","assalto"],["Linha Cinzenta","logística","logistica"],
  ["Vértice","tecnologia","tecnica"],["Círculo Dourado","influência","influencia"],
  ["Costa Negra","contrabando","logistica"],
];
const ACTIONS = {
  recon:{cost:1200,cooldown_h:1},sabotage:{cost:6500,cooldown_h:4},
  pressure:{cost:9000,cooldown_h:6},truce:{cost:3500,cooldown_h:8},alliance:{cost:12000,cooldown_h:12},
};

const LOCAL_SEASON_REWARDS = {
  1:{clean:120000,respect:1600},
  2:{clean:80000,respect:1000},
  3:{clean:50000,respect:700},
};

const hash = (text) => {
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
};
const weightedKey = (table, seed) => {
  const rows=Object.entries(table),total=rows.reduce((s,[,v])=>s+Number(v.weight||1),0);
  let pick=seed%Math.max(1,total);
  for(const [key,cfg] of rows){pick-=Number(cfg.weight||1);if(pick<0)return key;}
  return rows.at(-1)[0];
};
const localHour = () => Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Lisbon",hour:"2-digit",hourCycle:"h23"}).format(new Date()));
const periodKey = () => {const h=localHour();return h<6?"madrugada":h<12?"manha":h<19?"tarde":"noite";};
const combineChance = (...maps) => {
  const out={};
  maps.forEach((m)=>Object.entries(m||{}).forEach(([k,v])=>{out[k]=Number(((out[k]||0)+Number(v||0)).toFixed(4));}));
  return out;
};

export const localCityWorld = (save) => {
  const now=Date.now(),weatherSlot=Math.floor(now/(2*3600000)),eventSlot=Math.floor(now/(6*3600000));
  const region=save.player?.region||"Portugal";
  const wk=weightedKey(WEATHER,hash(`${region}|${weatherSlot}|weather`));
  const eventKeys=Object.keys(EVENTS),ek=eventKeys[hash(`${region}|${eventSlot}|event`)%eventKeys.length];
  const pk=periodKey(),w=WEATHER[wk],e=EVENTS[ek],p=DAYPART[pk];
  return {
    generated_at:nowIso(),
    local_time:new Date().toLocaleString("sv-SE",{timeZone:"Europe/Lisbon"}).replace(" ","T"),
    weather:{key:wk,...w},daypart:{key:pk,...p},event:{key:ek,...e},
    modifiers:{
      chance:combineChance(w.chance,p.chance,e.chance),
      travel_mult:Number((w.travel_mult*p.traffic_mult).toFixed(4)),
      heat_mult:Number((w.heat_mult*e.heat_mult).toFixed(4)),
      reward_mult:Number((w.reward_mult*p.reward_mult*e.reward_mult).toFixed(4)),
      police_mult:p.police_mult,
    },
    next_weather_at:new Date((weatherSlot+1)*2*3600000).toISOString(),
    next_event_at:new Date((eventSlot+1)*6*3600000).toISOString(),
  };
};
const localCityCalendar = (save, count=5) => {
  const now=Date.now(),currentSlot=Math.floor(now/(6*3600000)),region=save.player?.region||"Portugal",keys=Object.keys(EVENTS);
  return Array.from({length:Math.max(1,Math.min(8,count))},(_,offset)=>{
    const slot=currentSlot+offset,key=keys[hash(`${region}|${slot}|event`)%keys.length],cfg=EVENTS[key],start=slot*6*3600000;
    return {key,name:cfg.name,severity:cfg.severity,description:cfg.description,starts_at:new Date(start).toISOString(),ends_at:new Date(start+6*3600000).toISOString(),active:offset===0};
  });
};

const seasonInfo = () => {
  const anchor=Date.parse("2026-01-01T00:00:00Z"),span=30*86400000,now=Date.now();
  const index=Math.max(0,Math.floor((now-anchor)/span)),start=anchor+index*span,end=start+span;
  return {id:`S${String(index+1).padStart(3,"0")}`,number:index+1,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),remaining_s:Math.max(0,Math.floor((end-now)/1000))};
};
const pushEvent=(save,kind,message)=>{
  save.events ||= [];
  save.events.unshift({id:uid("evt"),kind,message,ts:nowIso()});
  save.events=save.events.slice(0,40);
};
const pushTx=(save,kind,amount,currency,note)=>{
  save.transactions ||= [];
  const key=currency==="dirty"?"dirty_money":"clean_money";
  save.transactions.unshift({id:uid("tx"),kind,amount,currency,balance_after:save.player[key],note,ts:nowIso()});
  save.transactions=save.transactions.slice(0,250);
};
const spend=(save,amount,note,kind="city_spend")=>{
  if(Number(save.player.clean_money||0)<amount) fail(400,"Dinheiro limpo insuficiente");
  save.player.clean_money-=amount;pushTx(save,kind,-amount,"clean",note);
};
const fail=(status,detail)=>{const e=new Error(detail);e.response={status,data:{detail}};throw e;};

export const ensureLocalCity = (save) => {
  save.city ||= {};
  save.city.businesses ||= [];
  save.city.rivals ||= RIVAL_NAMES.map(([name,style,focus],i)=>({
    id:uid("rival"),key:`rival_${i+1}`,name,style,focus,
    power:clamp(28+Number(save.player?.level||1)*4+((hash(name)%17)-7),18,95),
    hostility:25+(hash(name+"host")%42),intel:0,relation:"neutral",
    territory_pressure:10+(hash(name+"pressure")%25),last_action_at:null,
  }));
  save.city.season ||= {id:null,points:0,respect_checkpoint:Number(save.player?.respect||0),success_checkpoint:Number(save.player?.stats?.missions_success||0)};
  save.city.claimed_seasons ||= [];
  if(save.city.last_rival_slot===undefined) save.city.last_rival_slot=null;
  save.city.social ||= {};
  if(save.city.social.pvp_opt_in==null) save.city.social.pvp_opt_in=false;
  if(save.city.social.alliance===undefined) save.city.social.alliance=null;
  save.city.social.chat ||= [
    {id:uid("chat"),org_name:"Rádio de Rua",message:"Movimento normal. Atenção às alterações no pulso da cidade.",ts:nowIso()},
  ];
  save.city.social.pvp_challenges ||= [];
  save.city.boss ||= {health:100,stress:0,hospital_until:null,sentence_until:null};
  return save;
};

export const advanceLocalCity = (save) => {
  ensureLocalCity(save);
  const season=seasonInfo(),s=save.city.season;
  let respect=Number(save.player.respect||0),success=Number(save.player.stats?.missions_success||0);

  if(s.id!==season.id){
    if(s.id && !save.city.claimed_seasons.includes(s.id)){
      const oldBoard=npcLeaderboard(save,{id:s.id});
      const rank=oldBoard.find((x)=>x.is_you)?.rank||oldBoard.length;
      const reward=LOCAL_SEASON_REWARDS[rank]||{clean:0,respect:0};
      if(reward.clean){
        save.player.clean_money=Number(save.player.clean_money||0)+reward.clean;
        pushTx(save,"city_season_reward",reward.clean,"clean",`Prémio ${s.id} · #${rank}`);
      }
      if(reward.respect) save.player.respect=Number(save.player.respect||0)+reward.respect;
      save.city.last_season_reward={season_id:s.id,rank,points:Number(s.points||0),clean:reward.clean,respect:reward.respect,claimed_at:nowIso()};
      save.city.claimed_seasons.push(s.id);
      pushEvent(save,"system",reward.clean||reward.respect
        ? `Temporada ${s.id} encerrada em #${rank}: +${reward.clean.toLocaleString("pt-PT")} € e +${reward.respect.toLocaleString("pt-PT")} respeito.`
        : `Temporada ${s.id} encerrada em #${rank}.`);
      respect=Number(save.player.respect||0);
    }
    Object.assign(s,{id:season.id,points:0,respect_checkpoint:respect,success_checkpoint:success});
  }else{
    const gain=Math.max(0,respect-Number(s.respect_checkpoint||respect))+Math.max(0,success-Number(s.success_checkpoint||success))*12;
    if(gain>0){s.points+=gain;s.respect_checkpoint=respect;s.success_checkpoint=success;}
  }

  const rivalSlot=Math.floor(Date.now()/(3*3600000));
  if(save.city.last_rival_slot==null){
    // Primeiro contacto: cria a referência temporal sem atacar o jogador.
    save.city.last_rival_slot=rivalSlot;
  }else if(rivalSlot>Number(save.city.last_rival_slot)){
    save.city.last_rival_slot=rivalSlot;
    const rival=save.city.rivals[hash(`${save.player.id}|${rivalSlot}|rival-auto`)%Math.max(1,save.city.rivals.length)];
    if(rival){
      const seed=hash(`${save.player.id}|${rivalSlot}|${rival.name}|action`);
      const roll=(seed%10000)/10000;
      if(rival.relation==="allied"){
        const reduction=1+(seed%3);
        save.player.heat=Math.max(0,Number(save.player.heat||0)-reduction);
        pushEvent(save,"system",`${rival.name} partilhou informação útil (-${reduction} calor).`);
      }else if(rival.relation!=="truce"){
        if(save.city.businesses.length&&Number(rival.hostility||0)>=45&&roll<.38){
          const b=save.city.businesses[seed%save.city.businesses.length],security=clamp(Number(b.security||25),0,100);
          const raw=5+(seed%8),hit=Math.max(2,Math.round(raw*(1-.006*security)));
          b.condition=Math.max(20,Number(b.condition||100)-hit);
          rival.hostility=clamp(Number(rival.hostility||0)+2,0,100);
          rival.last_action_at=nowIso();
          pushEvent(save,"warning",`${rival.name} sabotou ${b.name} (-${hit}% condição).`);
        }else if(Number(rival.hostility||0)>=55&&roll<.72){
          const heatGain=2+(seed%4),stressGain=2+((seed>>>4)%5);
          save.player.heat=clamp(Number(save.player.heat||0)+heatGain,0,100);
          save.city.boss.stress=clamp(Number(save.city.boss.stress||0)+stressGain,0,100);
          rival.intel=Math.min(10,Number(rival.intel||0)+1);rival.last_action_at=nowIso();
          let suffix="";
          if(save.player.heat>=88&&((seed>>>8)%100)<12&&!save.city.boss.sentence_until){
            const minutes=15+((seed>>>10)%31);
            save.city.boss.sentence_until=new Date(Date.now()+minutes*60000).toISOString();
            suffix=" O chefe acabou detido temporariamente.";
          }
          pushEvent(save,"warning",`${rival.name} fez circular informação contra a organização (+${heatGain} calor).${suffix}`);
        }else{
          const pressure=4+(seed%7);
          rival.territory_pressure=clamp(Number(rival.territory_pressure||20)+pressure,0,100);
          rival.intel=Math.min(10,Number(rival.intel||0)+1);rival.last_action_at=nowIso();
          pushEvent(save,"warning",`${rival.name} aumentou a pressão territorial (+${pressure}).`);
        }
      }
    }
  }

  if(save.city.boss.hospital_until&&Date.parse(save.city.boss.hospital_until)<=Date.now()) save.city.boss.hospital_until=null;
  if(save.city.boss.sentence_until&&Date.parse(save.city.boss.sentence_until)<=Date.now()) save.city.boss.sentence_until=null;
  save.city.boss.health=clamp(Number(save.city.boss.health||100),0,100);
  save.city.boss.stress=clamp(Number(save.city.boss.stress||0),0,100);
  return save;
};

const businessProjection=(b)=>{
  const cfg=LOCAL_BUSINESS_TYPES[b.type_key]||{},last=Date.parse(b.last_collect_at||b.bought_at||nowIso());
  const hours=clamp((Date.now()-last)/3600000,0,168),level=Math.max(1,Number(b.level||1)),eff=clamp(Number(b.condition??100)/100,.35,1.35);
  return {hours:Number(hours.toFixed(3)),clean:Math.floor((cfg.clean_h||0)*level*hours*eff),dirty:Math.floor((cfg.dirty_h||0)*level*hours*eff),heat:Number(((cfg.heat_h||0)*level*hours).toFixed(2))};
};
export const localBossLeadership = (save) => {
  ensureLocalCity(save);
  const now=Date.now(),boss=save.city.boss;
  const hospitalActive=!!boss.hospital_until&&Date.parse(boss.hospital_until)>now;
  const sentenceActive=!!boss.sentence_until&&Date.parse(boss.sentence_until)>now;
  let delta=0;const reasons=[];
  if(sentenceActive){delta-=.05;reasons.push("chefia detida");}
  else if(hospitalActive){delta-=.03;reasons.push("chefia hospitalizada");}
  if(Number(boss.stress||0)>35){
    delta-=Math.min(.025,(Number(boss.stress)-35)/65*.025);
    reasons.push(`stress ${Math.round(Number(boss.stress))}%`);
  }
  if(Number(boss.health||100)<70){
    delta-=Math.min(.015,(70-Number(boss.health))/70*.015);
    reasons.push(`saúde ${Math.round(Number(boss.health))}%`);
  }
  return {chance_delta:Number(Math.max(-.075,delta).toFixed(4)),label:reasons.join(" · ")||"chefia operacional",health:boss.health,stress:boss.stress,hospital_until:hospitalActive?boss.hospital_until:null,sentence_until:sentenceActive?boss.sentence_until:null};
};

export const localBusinessChance = (save,category) => {
  ensureLocalCity(save);
  let total=0;
  save.city.businesses.forEach((b)=>{
    const cfg=LOCAL_BUSINESS_TYPES[b.type_key]||{},base=Number(cfg.effects?.[category]||0),level=Math.max(1,Number(b.level||1));
    total+=base*(1+.45*(level-1))*clamp(Number(b.condition??100)/100,.35,1);
  });
  return Math.min(.06,Number(total.toFixed(4)));
};

const npcLeaderboard=(save,season)=>{
  const mine={rank:0,player_id:save.player.id,org_name:save.player.org_name,points:Number(save.city.season.points||0),is_you:true};
  const rivals=save.city.rivals.map((r,i)=>({rank:0,player_id:r.id,org_name:r.name,points:Math.max(0,Math.round(r.power*19+r.hostility*4+(hash(season.id+r.name)%500))),is_you:false}));
  const board=[mine,...rivals].sort((a,b)=>b.points-a.points);board.forEach((x,i)=>x.rank=i+1);return board;
};
export const localCitySnapshot = (save) => {
  advanceLocalCity(save);
  const world=localCityWorld(save),season=seasonInfo();
  const businesses=save.city.businesses.map((b)=>({...clone(b),projection:businessProjection(b),config:LOCAL_BUSINESS_TYPES[b.type_key]}));
  const totals=businesses.reduce((a,b)=>({unclaimed_clean:a.unclaimed_clean+b.projection.clean,unclaimed_dirty:a.unclaimed_dirty+b.projection.dirty,pending_heat:Number((a.pending_heat+b.projection.heat).toFixed(2))}),{unclaimed_clean:0,unclaimed_dirty:0,pending_heat:0});
  const news=[
    {id:`world:${world.event.key}`,kind:"world",headline:world.event.name,body:world.event.description,severity:world.event.severity,ts:world.generated_at},
    {id:`weather:${world.weather.key}`,kind:"weather",headline:`Condições: ${world.weather.name}`,body:world.weather.description,severity:"low",ts:world.generated_at},
    ...(save.events||[]).slice(0,5).map((e)=>({id:`event:${e.id}`,kind:"organization",headline:"Movimento no submundo",body:e.message,severity:e.kind==="warning"?"medium":"low",ts:e.ts})),
  ].sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  const playerPower=Math.max(10,Number(save.player.level||1)*7+Math.floor(Number(save.player.respect||0)/700));
  return {
    world,
    calendar:localCityCalendar(save,5),
    season:{...season,your_points:Number(save.city.season.points||0),leaderboard:npcLeaderboard(save,season),last_reward:clone(save.city.last_season_reward||null)},
    news:news.slice(0,12),
    rivals:save.city.rivals.map((r)=>({...clone(r),threat:clamp(Math.round(r.power+r.hostility*.35-playerPower*.35),0,100)})),
    businesses,business_catalog:clone(LOCAL_BUSINESS_TYPES),business_totals:totals,
    social:{
      alliance:clone(save.city.social.alliance),
      chat:clone(save.city.social.chat||[]).slice(0,20),
      pvp_opt_in:!!save.city.social.pvp_opt_in,
      pvp_players:save.city.rivals.map((r)=>({player_id:r.id,org_name:r.name,level:Math.max(1,Math.round(r.power/12)),respect:r.power*180,heat:r.hostility/2})),
      pvp_challenges:clone(save.city.social.pvp_challenges||[]),
    },
    boss:clone(save.city.boss),
  };
};

const blackjack=()=>{
  const card=()=>[2,3,4,5,6,7,8,9,10,10,10,10,11][Math.floor(Math.random()*13)];
  const value=(cards)=>{let t=cards.reduce((a,b)=>a+b,0),aces=cards.filter(x=>x===11).length;while(t>21&&aces){t-=10;aces--;}return t;};
  const player=[card(),card()],dealer=[card(),card()];
  while(value(player)<16)player.push(card());while(value(dealer)<17)dealer.push(card());
  const pv=value(player),dv=value(dealer),natural=player.length===2&&pv===21;
  const outcome=pv>21?"lose":dv>21||pv>dv?"win":pv===dv?"push":"lose";
  return {outcome,natural,player,dealer,player_value:pv,dealer_value:dv};
};

export const handleLocalCityRequest = (save,verb,path,payload={}) => {
  ensureLocalCity(save);
  if(!String(path).startsWith("/game/city")) return {handled:false};
  if(verb==="get"&&path==="/game/city/state") return {handled:true,data:localCitySnapshot(save)};

  if(verb==="post"&&path==="/game/city/businesses/buy"){
    const cfg=LOCAL_BUSINESS_TYPES[payload.type_key];if(!cfg)fail(404,"Tipo de negócio inexistente");
    const owned=save.city.businesses.length,same=save.city.businesses.filter(x=>x.type_key===payload.type_key).length;
    const price=Math.round(cfg.price*(1+owned*.08+same*.12));spend(save,price,`Compra de negócio: ${cfg.name}`,"city_business_buy");
    const b={id:uid("biz"),type_key:payload.type_key,name:cfg.name,level:1,condition:100,security:cfg.security,reputation:50,bought_at:nowIso(),last_collect_at:nowIso(),total_clean:0,total_dirty:0};
    save.city.businesses.push(b);pushEvent(save,"system",`${cfg.name} entrou na rede empresarial da organização.`);
    return {handled:true,data:{ok:true,business_id:b.id,price}};
  }
  if(verb==="post"&&path==="/game/city/businesses/upgrade"){
    const b=save.city.businesses.find(x=>x.id===payload.business_id);if(!b)fail(404,"Negócio não encontrado");
    const cfg=LOCAL_BUSINESS_TYPES[b.type_key],level=Number(b.level||1);if(level>=cfg.max_level)fail(400,"Negócio já está no nível máximo");
    const cost=Math.round(cfg.price*(.42+level*.18));spend(save,cost,`Melhoria de ${b.name}`,"city_business_upgrade");
    b.level=level+1;b.security=Math.min(100,Number(b.security||cfg.security)+5);b.condition=Math.min(100,Number(b.condition||100)+8);
    pushEvent(save,"system",`${b.name} evoluiu para nível ${b.level}.`);return {handled:true,data:{ok:true,cost,level:b.level}};
  }
  if(verb==="post"&&path==="/game/city/businesses/collect"){
    if(!save.city.businesses.length)fail(400,"Ainda não tens negócios urbanos");
    let clean=0,dirty=0,heat=0;save.city.businesses.forEach((b)=>{const p=businessProjection(b);clean+=p.clean;dirty+=p.dirty;heat+=p.heat;b.last_collect_at=nowIso();b.total_clean=(b.total_clean||0)+p.clean;b.total_dirty=(b.total_dirty||0)+p.dirty;});
    save.player.clean_money+=clean;save.player.dirty_money+=dirty;save.player.heat=clamp(Number(save.player.heat||0)+heat,0,100);
    if(clean)pushTx(save,"city_business_income",clean,"clean","Receitas da rede empresarial");if(dirty)pushTx(save,"city_business_income",dirty,"dirty","Receitas clandestinas da rede empresarial");
    pushEvent(save,"system",`Rede empresarial fechou caixa: +${clean.toLocaleString("pt-PT")} € limpos, +${dirty.toLocaleString("pt-PT")} € sujos.`);
    return {handled:true,data:{ok:true,clean,dirty,heat:Number(heat.toFixed(2))}};
  }
  if(verb==="post"&&path==="/game/city/rivals/action"){
    const rival=save.city.rivals.find(x=>x.id===payload.rival_id),cfg=ACTIONS[payload.action];if(!rival)fail(404,"Organização rival não encontrada");if(!cfg)fail(400,"Ação rival inválida");
    if(rival.last_action_at&&Date.now()-Date.parse(rival.last_action_at)<cfg.cooldown_h*3600000)fail(429,"Rede rival ainda em cooldown");
    spend(save,cfg.cost,`Ação contra ${rival.name}`,"city_rival_action");
    const level=Number(save.player.level||1),skill=level*7+Number(rival.intel||0)*4+Math.floor(Number(save.player.respect||0)/900),success=Math.random()<clamp(.48+(skill-rival.power)/180,.18,.88);
    rival.last_action_at=nowIso();let ok=success,msg="";
    if(payload.action==="recon"){const gain=1+Math.floor(Math.random()*3);rival.intel=Math.min(10,Number(rival.intel||0)+gain);ok=true;msg=`Reconhecimento a ${rival.name}: inteligência +${gain}.`;}
    else if(payload.action==="sabotage"){if(ok){const hit=4+Math.floor(Math.random()*7);rival.power=Math.max(8,rival.power-hit);rival.hostility=Math.min(100,rival.hostility+12);msg=`Sabotagem bem-sucedida contra ${rival.name} (-${hit} poder).`;}else{save.player.heat=clamp(Number(save.player.heat||0)+6,0,100);save.city.boss.stress=clamp(save.city.boss.stress+8,0,100);msg=`A sabotagem contra ${rival.name} falhou.`;}}
    else if(payload.action==="pressure"){const delta=ok?8+Math.floor(Math.random()*11):-(3+Math.floor(Math.random()*6));rival.territory_pressure=clamp(rival.territory_pressure-delta,0,100);rival.hostility=clamp(rival.hostility+(ok?9:4),0,100);msg=`Pressão territorial sobre ${rival.name}: ${ok?"avanço":"resistência rival"}.`;}
    else if(payload.action==="truce"){ok=ok||rival.hostility<55;if(ok){rival.relation="truce";rival.hostility=Math.max(0,rival.hostility-30);}msg=ok?`Trégua estabelecida com ${rival.name}.`:`${rival.name} recusou a trégua.`;}
    else if(payload.action==="alliance"){ok=(Math.random()*100+rival.intel*4+level*2)>=(45+rival.hostility);if(ok){rival.relation="allied";rival.hostility=Math.max(0,rival.hostility-45);}msg=ok?`Acordo estratégico estabelecido com ${rival.name}.`:`As negociações com ${rival.name} falharam.`;}
    pushEvent(save,ok?"system":"warning",msg);return {handled:true,data:{ok:true,success:ok,message:msg}};
  }
  if(verb==="post"&&path==="/game/city/casino/play"){
    const game=String(payload.game||"");if(!["roulette","blackjack"].includes(game))fail(400,"Jogo de casino inválido");
    const bet=Number(payload.bet||0);if(bet<100||bet>5000)fail(400,"A aposta tem de ficar entre 100 € e 5 000 €");spend(save,bet,`Aposta: ${game}`,"city_casino_bet");
    let payout=0,detail={};
    if(payload.game==="roulette"){const choice=String(payload.choice||"red").toLowerCase();if(!["red","black","green"].includes(choice))fail(400,"Escolha inválida para a roleta");const number=Math.floor(Math.random()*37),reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]),color=number===0?"green":reds.has(number)?"red":"black";if(color===choice)payout=bet*(choice==="green"?36:2);detail={number,color,choice};}
    else if(payload.game==="blackjack"){detail=blackjack();if(detail.outcome==="push")payout=bet;else if(detail.outcome==="win")payout=Math.floor(bet*(detail.natural?2.5:2));}
    if(payout){save.player.clean_money+=payout;pushTx(save,"city_casino_payout",payout,"clean",`Prémio: ${payload.game}`);}const net=payout-bet;pushEvent(save,"system",`Casino: ${payload.game} terminou com resultado líquido de ${net>=0?"+":""}${net.toLocaleString("pt-PT")} €.`);
    return {handled:true,data:{ok:true,payout,net,...detail}};
  }
  if(verb==="post"&&path==="/game/city/social/pvp"){save.city.social.pvp_opt_in=!!payload.enabled;return {handled:true,data:{ok:true,enabled:save.city.social.pvp_opt_in}};}
  if(verb==="post"&&path==="/game/city/social/pvp/challenge"){
    if(!save.city.social.pvp_opt_in)fail(400,"Ativa primeiro o PvP");
    const defender=save.city.rivals.find((r)=>r.id===payload.defender_player_id);if(!defender)fail(404,"Rival PvP indisponível");
    const a=Number(save.player.level||1)*12+Number(save.player.respect||0)/350+Number(save.player.stats?.missions_success||0)*.7+Math.random()*22;
    const d=Math.max(1,defender.power/8)*12+defender.power*.5+Math.random()*22;
    const won=a>=d;save.city.season.points=Number(save.city.season.points||0)+(won?80:20);
    if(!won) save.city.boss.stress=clamp(Number(save.city.boss.stress||0)+8,0,100);
    let consequence=null;
    if(!won&&Number(save.player.heat||0)>=75&&Math.random()<.06){
      save.city.boss.sentence_until=new Date(Date.now()+(15+Math.floor(Math.random()*31))*60000).toISOString();consequence="sentence";
    }else if(!won&&Math.random()<.08){
      save.city.boss.hospital_until=new Date(Date.now()+(10+Math.floor(Math.random()*21))*60000).toISOString();save.city.boss.health=55+Math.floor(Math.random()*26);consequence="hospital";
    }
    pushEvent(save,won?"system":"warning",`Conflito PvP ${won?"vencido":"perdido"} contra ${defender.name}.`);
    return {handled:true,data:{ok:true,winner_id:won?save.player.id:defender.id,winner_name:won?save.player.org_name:defender.name,consequence}};
  }
  if(verb==="post"&&path==="/game/city/social/pvp/accept")fail(404,"Sem desafios PvP recebidos no modo convidado");
  if(verb==="post"&&path==="/game/city/social/pvp/decline")fail(404,"Sem desafios PvP recebidos no modo convidado");
  if(verb==="post"&&path==="/game/city/social/chat"){const message=String(payload.message||"").trim();if(!message||message.length>280)fail(400,"Mensagem inválida");save.city.social.chat.unshift({id:uid("chat"),org_name:save.player.org_name,message,ts:nowIso()});save.city.social.chat=save.city.social.chat.slice(0,20);return {handled:true,data:{ok:true}};}
  if(verb==="post"&&path==="/game/city/social/alliance/create"){if(save.city.social.alliance)fail(409,"Já pertences a uma aliança");const name=String(payload.name||"").trim();if(name.length<3)fail(400,"Nome demasiado curto");save.city.social.alliance={id:uid("alliance"),name,code:"LOCAL"+String(Math.floor(Math.random()*900)+100),leader_id:save.player.id,member_ids:[save.player.id],season_points:0,created_at:nowIso()};return {handled:true,data:{ok:true,code:save.city.social.alliance.code}};}
  if(verb==="post"&&path==="/game/city/social/alliance/join")fail(409,"Entrar numa aliança de outros jogadores requer uma conta online");
  if(verb==="post"&&path==="/game/city/social/alliance/leave"){save.city.social.alliance=null;return {handled:true,data:{ok:true}};}
  if(verb==="post"&&path==="/game/city/boss/recover"){const b=save.city.boss;if(!b.hospital_until&&!b.sentence_until&&b.health>=100)fail(400,"Não há nenhuma consequência ativa para tratar");const cost=(b.hospital_until?3500:0)+(b.sentence_until?7500:0);if(cost)spend(save,cost,"Recuperação do chefe","city_boss_recovery");Object.assign(b,{health:100,stress:Math.max(0,b.stress-30),hospital_until:null,sentence_until:null});pushEvent(save,"system","O chefe regressou à atividade.");return {handled:true,data:{ok:true,cost}};}
  return {handled:false};
};
