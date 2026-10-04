import { ensureLocalCity, localCitySnapshot, localBusinessChance, handleLocalCityRequest } from "./livingCity";

const baseSave = () => ({
  player:{
    id:"p1",org_name:"Teste",clean_money:600000,dirty_money:5000,respect:1200,level:3,heat:10,region:"Algarve",
    stats:{missions_success:4},
  },
  events:[],transactions:[],
});

test("living city produces a complete deterministic snapshot shape", () => {
  const save=baseSave();
  ensureLocalCity(save);
  const city=localCitySnapshot(save);
  expect(city.world.weather.name).toBeTruthy();
  expect(city.world.event.name).toBeTruthy();
  expect(city.rivals).toHaveLength(5);
  expect(city.season.leaderboard.some((x)=>x.is_you)).toBe(true);
  expect(city.businesses).toEqual([]);
});

test("businesses are purchased, accrue network effects and can be upgraded", () => {
  const save=baseSave();
  ensureLocalCity(save);
  const bought=handleLocalCityRequest(save,"post","/game/city/businesses/buy",{type_key:"empresa_tecnologia"});
  expect(bought.handled).toBe(true);
  expect(save.city.businesses).toHaveLength(1);
  expect(localBusinessChance(save,"tecnica")).toBeGreaterThan(0);
  const id=save.city.businesses[0].id;
  handleLocalCityRequest(save,"post","/game/city/businesses/upgrade",{business_id:id});
  expect(save.city.businesses[0].level).toBe(2);
});

test("city actions include rivals and casino without allowing negative balance", () => {
  const save=baseSave();
  ensureLocalCity(save);
  const rival=save.city.rivals[0];
  const recon=handleLocalCityRequest(save,"post","/game/city/rivals/action",{rival_id:rival.id,action:"recon"});
  expect(recon.data.success).toBe(true);
  const before=save.player.clean_money;
  const game=handleLocalCityRequest(save,"post","/game/city/casino/play",{game:"blackjack",bet:500});
  expect(game.handled).toBe(true);
  expect(save.player.clean_money).toBeGreaterThanOrEqual(0);
  expect(save.player.clean_money).toBeLessThanOrEqual(before+750);
});
