from typing import Annotated, Optional, List
from pydantic import BaseModel, BeforeValidator, Field, ConfigDict
from bson import ObjectId


def _coerce_object_id(v):
    return str(v) if isinstance(v, ObjectId) else v


PyObjectId = Annotated[str, BeforeValidator(_coerce_object_id)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self):
        d = self.model_dump(by_alias=True, exclude_none=True)
        d.pop("_id", None)
        return d

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc) if doc else None


class Player(BaseDocument):
    user_id: str
    org_name: str
    clean_money: int
    dirty_money: int
    respect: int
    level: int
    heat: float
    next_level_respect: Optional[int] = None
    next_payroll_at: Optional[str] = None
    pool_refresh_at: Optional[str] = None
    quests_daily_at: Optional[str] = None
    quests_weekly_at: Optional[str] = None
    quest_streak: dict = {}
    quest_perf: dict = {}
    temp_bonus: Optional[dict] = None
    stats: dict = {}
    hq: Optional[dict] = None
    region: str = ""
    districts: List[dict] = []
    last_tick: str
    created_at: str
    type_cooldowns: dict = {}
    achievement_bonus_pct: float = 0.0
    favorite_types: List[str] = []
    settings: dict = {}
    priorities: dict = {}
    # ---- Loja ----
    extra_vehicle_slots: int = 0
    extra_employee_slots: int = 0
    vip_until: Optional[str] = None
    owned_cosmetics: List[str] = []
    hq_skin_key: Optional[str] = None


class Team(BaseDocument):
    player_id: str
    name: str
    spec: str
    status: str
    vehicle_id: Optional[str] = None
    missions_done: int = 0
    created_at: str
    available_at: Optional[str] = None
    roster_stable_since: Optional[str] = None
    last_type_key: Optional[str] = None
    # QI das equipas (SSS v4) — campos persistidos pelo motor e agora expostos
    # no /state para a UI mostrar momentum, entrosamento e familiaridade.
    streak: int = 0
    roster_missions: int = 0
    category_missions: dict = {}
    emblem_key: Optional[str] = None


class Employee(BaseDocument):
    player_id: str
    name: str
    age: int = 30
    role_key: str
    spec: str
    rarity: str = "comum"
    rank: str = "recruta"
    level: int
    xp: int
    salary: int = 0
    loyalty: float = 70.0
    morale: float = 70.0
    fatigue: float
    attrs: dict = {}
    talents: List[str] = []
    status: str
    status_until: Optional[str] = None
    team_id: Optional[str] = None
    training: Optional[dict] = None
    history: List[dict] = []
    hired_at: str
    last_mission_at: Optional[str] = None
    missions_done: int = 0
    weapon_id: Optional[str] = None
    weapon_proficiency: dict = {}


class Candidate(BaseDocument):
    player_id: str
    source: str
    name: str
    age: int
    role_key: str
    spec: str
    rarity: str
    attrs: dict = {}
    talents: List[str] = []
    salary: int
    cost: int
    min_respect: int
    created_at: str


class Vehicle(BaseDocument):
    player_id: str
    model_key: str
    name: str
    fuel_type: str
    tank_l: float
    fuel_l: float
    condition: float
    speed: float
    cons: float
    price: int
    min_level: int
    team_id: Optional[str] = None
    km_total: float = 0.0
    fuel_spent_total: float = 0.0
    repair_spent_total: float = 0.0
    missions_done: int = 0
    missions_success: int = 0
    missions_since_repair: int = 0
    refueling_until: Optional[str] = None
    bought_at: str
    property_id: Optional[str] = None
    transfer: Optional[dict] = None
    paint_key: Optional[str] = None
    # Cidade Viva — notoriedade afeta perseguições; seguro reduz o tempo/custo
    # de recuperação e a apreensão bloqueia qualquer novo despacho.
    street_notoriety: float = 0.0
    insured: bool = False
    impounded_until: Optional[str] = None


class Weapon(BaseDocument):
    player_id: str
    model_key: str
    name: str
    condition: float = 100.0
    employee_id: Optional[str] = None
    missions_since_repair: int = 0
    missions_done: int = 0
    upgrades: List[dict] = []
    bought_at: str


class Transaction(BaseDocument):
    player_id: str
    kind: str
    amount: float
    currency: str
    balance_after: float
    note: str
    ts: str


class Property(BaseDocument):
    player_id: str
    type_key: str
    name: str
    district: str
    lat: float
    lng: float
    level: int
    purchase_price: Optional[int] = None
    market_zone: Optional[str] = None
    market_multiplier: float = 1.0
    total_dirty_generated: float = 0.0
    total_laundered: float = 0.0
    bought_at: str
    condition: float = 100.0
    upgrading_until: Optional[str] = None


class Opportunity(BaseDocument):
    player_id: str
    type_key: str
    name: str
    category: str
    district: str
    lat: float
    lng: float
    reward: int
    respect: int
    risk: int
    heat: float
    pays: str
    rare: bool = False
    hot: bool = False
    dist_km: float = 0.0
    min_members: int = 1
    required_models: List[str] = []
    duration_s: int
    min_level: int
    status: str
    expires_at: str
    created_at: str
    generated_by_property_id: Optional[str] = None
    police_force: Optional[str] = None


class Mission(BaseDocument):
    player_id: str
    team_id: str
    team_name: str
    team_skill: float
    spec_match: bool
    member_ids: List[str] = []
    vehicle_id: Optional[str] = None
    vehicle_luxury: bool = False
    weapon_loud: bool = False
    repeat_type: bool = False
    opportunity_id: Optional[str] = None
    talents: List[str] = []
    opportunity: dict
    origin: dict
    origin_property_id: Optional[str] = None
    target: dict
    # Percursos rodoviários persistidos no despacho. Guardá-los na missão evita
    # recalcular no browser e garante que o veículo nasce logo sobre a estrada.
    road_outward: Optional[dict] = None
    road_inward: Optional[dict] = None
    phase: str
    outcome: Optional[str] = None
    success_chance: Optional[float] = None
    depart_at: str
    arrive_at: str
    finish_at: str
    return_at: str
    # Pending payout (credited only when the crew reaches HQ) and police chase state.
    pending_reward: int = 0
    pending_pays: Optional[str] = None
    bonus_loot: bool = False
    chase_active: bool = False
    chase_chance: float = 0.0
    escape_chance: float = 0.0
    chase_outcome: Optional[str] = None
    fine: int = 0
    # Operação em direto (SSS): guião narrativo com timestamps absolutos —
    # o frontend revela cada linha quando o relógio do servidor a alcança.
    # live_chance_delta = efeito acumulado das complicações na chance final
    # (aplicado em engine._roll_outcome); final_chance = chance efetiva rolada.
    live_log: List[dict] = []
    live_chance_delta: float = 0.0
    final_chance: Optional[float] = None
    # Retention engine: one optional, transparent tactical choice during the
    # operation. Ignoring it is neutral.
    decision: Optional[dict] = None
    decision_reward_mult: float = 1.0
    world_pulse: Optional[dict] = None


class Event(BaseDocument):
    player_id: str
    kind: str
    message: str
    ts: str


class Quest(BaseDocument):
    player_id: str
    quest_key: str
    status: str
    progress: float = 0.0
    target: float = 1.0
    baseline: dict = {}
    choice: Optional[str] = None
    outcome: Optional[str] = None
    activated_at: Optional[str] = None
    expires_at: Optional[str] = None
    completed_at: Optional[str] = None
    claimed_at: Optional[str] = None
