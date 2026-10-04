"""Pure travel/economy metrics shared by routing tests and the game API."""

from fastapi import HTTPException


def road_mission_metrics(outward: dict, inward: dict, vehicle: dict, speed: float) -> dict:
    """Derive authoritative trip distance, fuel and game-time from road geometry."""
    out_m = max(0.0, float((outward or {}).get("distance") or 0))
    in_m = max(0.0, float((inward or {}).get("distance") or 0))
    if out_m <= 0 or in_m <= 0:
        raise HTTPException(status_code=422, detail="Percurso rodoviário sem distância válida")
    round_km = (out_m + in_m) / 1000.0
    fuel_needed = round_km * float(vehicle.get("cons", 0) or 0) / 100.0
    effective = max(1.0, float(speed or 1))
    return {
        "out_m": out_m,
        "in_m": in_m,
        "round_km": round_km,
        "fuel_needed": fuel_needed,
        "travel_s": max(20.0, out_m / effective),
        "return_travel_s": max(20.0, in_m / effective),
    }
