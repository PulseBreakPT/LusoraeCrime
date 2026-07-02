from typing import Annotated, Optional
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
    hq: dict
    last_tick: str
    created_at: str


class Team(BaseDocument):
    player_id: str
    name: str
    type_key: str
    spec: str
    skill: float
    status: str
    vehicle: dict
    missions_done: int
    created_at: str


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
    opportunity: dict
    origin: dict
    target: dict
    phase: str
    outcome: Optional[str] = None
    depart_at: str
    arrive_at: str
    finish_at: str
    return_at: str


class Event(BaseDocument):
    player_id: str
    kind: str
    message: str
    ts: str
