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
    stats: dict = {}
    hq: dict
    last_tick: str
    created_at: str


class Team(BaseDocument):
    player_id: str
    name: str
    spec: str
    status: str
    vehicle_id: Optional[str] = None
    missions_done: int = 0
    created_at: str


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
    bought_at: str


class Property(BaseDocument):
    player_id: str
    type_key: str
    name: str
    district: str
    lat: float
    lng: float
    level: int
    total_dirty_generated: float = 0.0
    total_laundered: float = 0.0
    bought_at: str


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
    duration_s: int
    min_level: int
    status: str
    expires_at: str
    created_at: str


class Mission(BaseDocument):
    player_id: str
    team_id: str
    team_name: str
    team_skill: float
    spec_match: bool
    member_ids: List[str] = []
    vehicle_id: Optional[str] = None
    opportunity: dict
    origin: dict
    target: dict
    phase: str
    outcome: Optional[str] = None
    success_chance: Optional[float] = None
    depart_at: str
    arrive_at: str
    finish_at: str
    return_at: str


class Event(BaseDocument):
    player_id: str
    kind: str
    message: str
    ts: str
