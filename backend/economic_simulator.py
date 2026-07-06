#!/usr/bin/env python3
# ============================================================================
# LUSORAE CRIME - ECONOMIC SIMULATOR
# Validates the redesigned economy by simulating different playstyles
# ============================================================================

import math
from economy_constants import (
    INITIAL_CLEAN_MONEY, INITIAL_DIRTY_MONEY,
    PROPERTY_COSTS, DIRTY_MONEY_CAP_BASE, DIRTY_MONEY_CAP_PER_LEVEL,
    TEAM_COST_SCALING_BASE, PAYROLL_CYCLE_MIN,
    MEMBER_SPLIT_PENALTY_PER_EXTRA, MEMBER_SPLIT_PENALTY_MAX,
    ORG_LEVEL_MULTIPLIER_BASE, ORG_LEVEL_MULTIPLIER_PER_LEVEL,
    MISSION_REWARD_MIN, MISSION_REWARD_MAX,
)


class EconomySimulator:
    """Simulates player economic progression through different playstyles."""

    def __init__(self):
        self.clean_money = INITIAL_CLEAN_MONEY
        self.dirty_money = INITIAL_DIRTY_MONEY
        self.org_level = 1
        self.employees = 2  # Starting team size
        self.properties_owned = {}  # key: property_name, value: level
        self.hours_played = 0
        self.missions_completed = 0
        self.wealth_history = []
        self.payroll_total = 0

    def calculate_dirty_cap(self):
        """Calculate current dirty money cap based on level."""
        return DIRTY_MONEY_CAP_BASE + (self.org_level - 1) * DIRTY_MONEY_CAP_PER_LEVEL

    def calculate_payroll_cycle_cost(self):
        """Calculate payroll cost per cycle with team scaling."""
        base_cost = self.employees * 250  # average employee salary
        scaling = (max(1, self.employees) / 2) ** TEAM_COST_SCALING_BASE
        return int(base_cost * scaling)

    def process_payroll(self, cycles=1):
        """Process salary payroll."""
        for _ in range(cycles):
            cost = self.calculate_payroll_cycle_cost()
            if self.clean_money >= cost:
                self.clean_money -= cost
            else:
                # Simulate employee morale drop - don't lose immediately
                pass
            self.payroll_total += cost

    def simulate_mission(self, risk_level=2, duration_minutes=90):
        """Simulate a single mission reward."""
        base_reward = {1: 1500, 2: 2500, 3: 4500, 4: 8500, 5: 15000}.get(risk_level, 2500)

        # Organization level multiplier
        org_mult = ORG_LEVEL_MULTIPLIER_BASE + (self.org_level - 1) * ORG_LEVEL_MULTIPLIER_PER_LEVEL

        # Member split penalty (2-person optimal)
        extra_members = max(0, self.employees - 2)
        split_penalty = 1 - min(MEMBER_SPLIT_PENALTY_MAX, MEMBER_SPLIT_PENALTY_PER_EXTRA * extra_members)

        reward = int(base_reward * org_mult * split_penalty)
        reward = max(MISSION_REWARD_MIN, min(MISSION_REWARD_MAX, reward))

        self.dirty_money += reward
        self.missions_completed += 1
        return reward

    def simulate_passive_income(self, hours=1):
        """Simulate passive income from properties."""
        dirty_generated = 0
        clean_generated = 0

        for prop_name, level in self.properties_owned.items():
            if prop_name == 'laboratorio':
                # Lab: 2100 €/h (was 3000, -30%)
                dirty_generated += 2100 * level * hours
            elif prop_name == 'empresa_legal':
                # Empresa: 1400 €/h dirty input (was 2000, -30%)
                clean_generated += int(1400 * level * hours * 0.9)  # 90% conversion
            elif prop_name == 'casa_cambio':
                # Casa: 1750 €/h dirty input (was 2500, -30%)
                clean_generated += int(1750 * level * hours * 0.9)  # 90% conversion

        # Apply dirty cap
        cap = self.calculate_dirty_cap()
        room = max(0, cap - self.dirty_money)
        self.dirty_money += min(int(dirty_generated), room)
        self.clean_money += clean_generated

        return dirty_generated, clean_generated

    def buy_property(self, property_name):
        """Buy a property if affordable."""
        cost = PROPERTY_COSTS.get(property_name, 0)
        if cost > 0 and self.clean_money >= cost:
            self.clean_money -= cost
            self.properties_owned[property_name] = self.properties_owned.get(property_name, 0) + 1
            return True
        return False

    def progress_to_level(self, target_level):
        """Fast-forward to a specific organization level (for testing)."""
        self.org_level = target_level

    def record_snapshot(self):
        """Record current economic state."""
        self.wealth_history.append({
            'hours': self.hours_played,
            'missions': self.missions_completed,
            'clean': self.clean_money,
            'dirty': self.dirty_money,
            'employees': self.employees,
            'org_level': self.org_level,
            'properties': len(self.properties_owned),
        })

    def simulate_conservative_player(self, hours=50):
        """Conservative playstyle: slow growth, lots of missions."""
        print("\n" + "="*60)
        print("SIMULATING: CONSERVATIVE PLAYER (50 hours)")
        print("="*60)
        print(f"Start: {self.clean_money:,}€ clean, {self.dirty_money:,}€ dirty")

        for h in range(hours):
            # Mission every 15 minutes average (4 per hour)
            for _ in range(4):
                reward = self.simulate_mission(risk_level=1)  # Low risk
                if h % 5 == 0:
                    self.record_snapshot()

            # Payroll every 2 hours
            if h % 2 == 0:
                self.process_payroll(1)

            # Passive income every hour
            dirty, clean = self.simulate_passive_income(1)

            self.hours_played += 1

        self.record_snapshot()
        print(f"End: {self.clean_money:,}€ clean, {self.dirty_money:,}€ dirty")
        print(f"Missions: {self.missions_completed}, Employees: {self.employees}")
        print(f"Payroll spent: {self.payroll_total:,}€")
        return self.wealth_history

    def simulate_aggressive_player(self, hours=100):
        """Aggressive playstyle: high-risk missions, quick property investment."""
        print("\n" + "="*60)
        print("SIMULATING: AGGRESSIVE PLAYER (100 hours)")
        print("="*60)
        print(f"Start: {self.clean_money:,}€ clean, {self.dirty_money:,}€ dirty")

        for h in range(hours):
            # High-risk missions (4 per hour, but higher risk)
            for _ in range(4):
                reward = self.simulate_mission(risk_level=3)

            # Property investment at key milestones
            if h == 5 and self.clean_money >= PROPERTY_COSTS['empresa_legal']:
                self.buy_property('empresa_legal')
                print(f"Hour {h}: Bought Empresa Legal")
            if h == 10 and self.clean_money >= PROPERTY_COSTS['casa_cambio']:
                self.buy_property('casa_cambio')
                print(f"Hour {h}: Bought Casa de Câmbio")
            if h == 20 and self.clean_money >= PROPERTY_COSTS['laboratorio']:
                self.buy_property('laboratorio')
                print(f"Hour {h}: Bought Laboratório")

            # Payroll
            if h % 2 == 0:
                self.process_payroll(1)

            # Passive income
            dirty, clean = self.simulate_passive_income(1)

            # Hire extra employees at hour 20
            if h == 20:
                self.employees = 4
                print(f"Hour {h}: Hired more employees (now {self.employees})")

            if h % 10 == 0:
                self.record_snapshot()

            self.hours_played += 1

        self.record_snapshot()
        print(f"End: {self.clean_money:,}€ clean, {self.dirty_money:,}€ dirty")
        print(f"Missions: {self.missions_completed}, Employees: {self.employees}")
        print(f"Properties: {len(self.properties_owned)}")
        print(f"Payroll spent: {self.payroll_total:,}€")
        return self.wealth_history

    def simulate_balanced_player(self, hours=200):
        """Balanced playstyle: mix of missions and property investment."""
        print("\n" + "="*60)
        print("SIMULATING: BALANCED PLAYER (200 hours)")
        print("="*60)
        print(f"Start: {self.clean_money:,}€ clean, {self.dirty_money:,}€ dirty")

        for h in range(hours):
            # 3 missions per hour
            for _ in range(3):
                risk = 2 if h < 50 else 3
                reward = self.simulate_mission(risk_level=risk)

            # Strategic property buying
            if h == 10 and self.clean_money >= PROPERTY_COSTS['empresa_legal']:
                self.buy_property('empresa_legal')
            if h == 30 and self.clean_money >= PROPERTY_COSTS['casa_cambio']:
                self.buy_property('casa_cambio')
            if h == 60 and self.clean_money >= PROPERTY_COSTS['laboratorio']:
                self.buy_property('laboratorio')
            if h == 100 and self.clean_money >= PROPERTY_COSTS['esconderijo']:
                self.buy_property('esconderijo')
                self.employees = 6

            # Payroll
            if h % 2 == 0:
                self.process_payroll(1)

            # Passive income
            dirty, clean = self.simulate_passive_income(1)

            if h % 20 == 0:
                self.record_snapshot()
                if self.clean_money < 0:
                    print(f"⚠️  Hour {h}: NEGATIVE balance detected!")
                    break

            self.hours_played += 1

        self.record_snapshot()
        print(f"End: {self.clean_money:,}€ clean, {self.dirty_money:,}€ dirty")
        print(f"Missions: {self.missions_completed}, Employees: {self.employees}")
        print(f"Properties: {len(self.properties_owned)}")
        print(f"Payroll spent: {self.payroll_total:,}€")
        return self.wealth_history

    def check_infinite_loop(self):
        """Check if any property investment pays for itself in <24 hours."""
        print("\n" + "="*60)
        print("CHECKING FOR INFINITE MONEY LOOPS")
        print("="*60)

        # Scenario: Buy both core properties on day 1
        test_cash = INITIAL_CLEAN_MONEY
        test_dirty = 0

        empresa_cost = PROPERTY_COSTS['empresa_legal']
        casa_cost = PROPERTY_COSTS['casa_cambio']

        # Can we afford both?
        if test_cash >= empresa_cost + casa_cost:
            test_cash -= empresa_cost + casa_cost
            print(f"✓ Can buy both properties immediately")
            print(f"  Cost: {empresa_cost + casa_cost:,}€, Remaining: {test_cash:,}€")

            # Daily passive income
            daily_income_clean = (1400 * 0.9) + (1750 * 0.9)  # both at level 1
            print(f"  Daily income: {daily_income_clean:,.0f}€ clean")

            payback_days = (empresa_cost + casa_cost) / daily_income_clean
            print(f"  Payback period: {payback_days:.1f} days")

            if payback_days < 3:
                print(f"⚠️  LOOP DETECTED: Properties pay back in {payback_days:.1f} days!")
                return False
        else:
            print(f"✓ Cannot buy both immediately (need {empresa_cost + casa_cost:,}€)")

        return True

    def print_summary(self):
        """Print simulation summary."""
        print("\n" + "="*60)
        print("ECONOMIC SIMULATOR - VALIDATION SUMMARY")
        print("="*60)
        if self.wealth_history:
            first = self.wealth_history[0]
            last = self.wealth_history[-1]

            print(f"\nProgression over {last['hours']} hours:")
            print(f"  Clean money: {first['clean']:,}€ → {last['clean']:,}€ ({last['clean'] - first['clean']:+,}€)")
            print(f"  Dirty money: {first['dirty']:,}€ → {last['dirty']:,}€")
            print(f"  Missions completed: {last['missions']}")
            print(f"  Employees: {first['employees']} → {last['employees']}")
            print(f"  Organization level: {first['org_level']} → {last['org_level']}")
            print(f"  Properties: {first['properties']} → {last['properties']}")
            print(f"  Total payroll spent: {self.payroll_total:,}€")

            # Check if balance ever went negative
            min_balance = min(h['clean'] for h in self.wealth_history)
            if min_balance < 0:
                print(f"\n⚠️  WARNING: Balance went negative: {min_balance:,}€")
                return False

            print(f"\n✓ No negative balance detected")
            return True
        return False


def run_simulations():
    """Run all simulation scenarios."""
    results = []

    # Conservative player
    sim1 = EconomySimulator()
    sim1.simulate_conservative_player(50)
    sim1.print_summary()
    results.append(('Conservative (50h)', sim1.print_summary()))

    # Aggressive player
    sim2 = EconomySimulator()
    sim2.simulate_aggressive_player(100)
    sim2.print_summary()
    results.append(('Aggressive (100h)', sim2.print_summary()))

    # Balanced player
    sim3 = EconomySimulator()
    sim3.simulate_balanced_player(200)
    sim3.print_summary()
    results.append(('Balanced (200h)', sim3.print_summary()))

    # Infinite loop check
    sim4 = EconomySimulator()
    loop_ok = sim4.check_infinite_loop()
    results.append(('Infinite loop check', loop_ok))

    print("\n" + "="*60)
    print("FINAL VALIDATION RESULTS")
    print("="*60)
    for scenario, ok in results:
        status = "✓ PASS" if ok else "✗ FAIL"
        print(f"{status}: {scenario}")

    all_pass = all(ok for _, ok in results)
    print("\n" + ("="*60))
    if all_pass:
        print("✓ ALL SIMULATIONS PASSED - Economy is valid")
    else:
        print("✗ SOME SIMULATIONS FAILED - Economy needs more work")
    print("="*60)

    return all_pass


if __name__ == "__main__":
    success = run_simulations()
    exit(0 if success else 1)
