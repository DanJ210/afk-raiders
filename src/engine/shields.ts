import type { RaidState, RaiderStats, ShieldState } from './types.js'

export const STARTER_SHIELD_ID = 'makeshift_confidence_shield'
// AFK Raiders sees many more shield-draining hits per raid than ARC-style PvP,
// so a full drain only costs 10 durability to keep starter shields from breaking too quickly.
const FULL_SHIELD_DURABILITY_WEAR = 10

export function createStarterShieldState(): ShieldState {
  return {
    shieldId: STARTER_SHIELD_ID,
    name: 'Makeshift Confidence Shield',
    maxCharge: 40,
    charge: 40,
    mitigation: 0.4,
    durability: 100,
  }
}

export function restoreShieldAtHub(shield: ShieldState | null): ShieldState {
  if (shield === null) {
    return createStarterShieldState()
  }

  return {
    ...shield,
    charge: shield.maxCharge,
    durability: 100,
  }
}

export function hasActiveShield(shield: ShieldState | null): shield is ShieldState {
  return shield !== null && shield.charge > 0 && shield.durability > 0
}

export interface ShieldDamageResult {
  raider: RaiderStats
  raid: RaidState
  hpDamage: number
  shieldChargeLost: number
  shieldDurabilityLost: number
  mitigated: boolean
}

export interface ShieldRechargeStartResult {
  raid: RaidState
  startedCharge: number
  completedImmediately: boolean
}

export interface ShieldRechargeTickResult {
  raid: RaidState
  chargeApplied: number
  completed: boolean
}

export function applyShieldedDamage(
  raider: RaiderStats,
  raid: RaidState,
  rawDamage: number,
): ShieldDamageResult {
  const damage = Math.max(0, Math.ceil(rawDamage))
  if (damage <= 0) {
    return {
      raider,
      raid,
      hpDamage: 0,
      shieldChargeLost: 0,
      shieldDurabilityLost: 0,
      mitigated: false,
    }
  }

  if (!hasActiveShield(raid.shield)) {
    const hp = Math.max(0, raider.hp - damage)
    return {
      raider: { ...raider, hp },
      raid,
      hpDamage: raider.hp - hp,
      shieldChargeLost: 0,
      shieldDurabilityLost: 0,
      mitigated: false,
    }
  }

  const shield = raid.shield
  const hpDamage = Math.max(0, Math.ceil(damage * (1 - shield.mitigation)))
  const chargeLost = Math.min(shield.charge, damage)
  const durabilityLost = Math.min(
    shield.durability,
    Number(((chargeLost / shield.maxCharge) * FULL_SHIELD_DURABILITY_WEAR).toFixed(2)),
  )
  const hp = Math.max(0, raider.hp - hpDamage)

  return {
    raider: { ...raider, hp },
    raid: {
      ...raid,
      shield: {
        ...shield,
        charge: Math.max(0, shield.charge - chargeLost),
        durability: Math.max(0, Number((shield.durability - durabilityLost).toFixed(2))),
      },
    },
    hpDamage: raider.hp - hp,
    shieldChargeLost: chargeLost,
    shieldDurabilityLost: durabilityLost,
    mitigated: true,
  }
}

export function restoreShieldCharge(
  raid: RaidState,
  rawChargeAmount: number,
): { raid: RaidState; chargeRestored: number } {
  const amount = Math.max(0, Math.floor(rawChargeAmount))
  if (!raid.shield || amount <= 0) {
    return { raid, chargeRestored: 0 }
  }

  const missingCharge = Math.max(0, raid.shield.maxCharge - raid.shield.charge)
  const chargeRestored = Math.min(missingCharge, amount)
  if (chargeRestored <= 0) {
    return { raid, chargeRestored: 0 }
  }

  return {
    raid: {
      ...raid,
      shield: {
        ...raid.shield,
        charge: raid.shield.charge + chargeRestored,
      },
    },
    chargeRestored,
  }
}

export function startShieldRecharge(
  raid: RaidState,
  params: {
    itemId: string
    name: string
    chargeAmount: number
    applyTicks?: number
  },
): ShieldRechargeStartResult {
  const totalCharge = Math.max(0, Math.floor(params.chargeAmount))
  const totalTicks = Math.max(0, Math.floor(params.applyTicks ?? 5))
  if (totalCharge <= 0) {
    return { raid, startedCharge: 0, completedImmediately: true }
  }

  if (totalTicks <= 0) {
    const recharge = restoreShieldCharge(raid, totalCharge)
    return { raid: recharge.raid, startedCharge: recharge.chargeRestored, completedImmediately: true }
  }

  return {
    raid: {
      ...raid,
      activeShieldRecharge: {
        itemId: params.itemId,
        name: params.name,
        totalCharge,
        chargeRemaining: totalCharge,
        totalTicks,
        ticksRemaining: totalTicks,
      },
    },
    startedCharge: totalCharge,
    completedImmediately: false,
  }
}

export function advanceShieldRecharge(raid: RaidState): ShieldRechargeTickResult {
  const active = raid.activeShieldRecharge
  if (!active || raid.shield === null) {
    return { raid, chargeApplied: 0, completed: false }
  }

  if (raid.shield.durability <= 0) {
    return { raid: { ...raid, activeShieldRecharge: null }, chargeApplied: 0, completed: true }
  }

  const ticksRemaining = Math.max(0, active.ticksRemaining)
  if (ticksRemaining <= 0 || active.chargeRemaining <= 0) {
    return { raid: { ...raid, activeShieldRecharge: null }, chargeApplied: 0, completed: true }
  }

  const chargePerTick = Math.max(1, Math.ceil(active.totalCharge / active.totalTicks))
  const chargeApplied = Math.min(active.chargeRemaining, chargePerTick)
  const restored = restoreShieldCharge(raid, chargeApplied)
  const nextChargeRemaining = active.chargeRemaining - restored.chargeRestored
  const nextTicksRemaining = active.ticksRemaining - 1
  const completed = nextChargeRemaining <= 0 || nextTicksRemaining <= 0 || restored.raid.shield?.charge === restored.raid.shield?.maxCharge

  const nextRaid: RaidState = {
    ...restored.raid,
    activeShieldRecharge: completed
      ? null
      : {
          ...active,
          chargeRemaining: nextChargeRemaining,
          ticksRemaining: nextTicksRemaining,
        },
  }

  return {
    raid: nextRaid,
    chargeApplied: restored.chargeRestored,
    completed,
  }
}