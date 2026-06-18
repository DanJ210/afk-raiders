/** Core type definitions for AFK Raiders engine */

// ---------------------------------------------------------------------------
// Content table types
// ---------------------------------------------------------------------------

export interface ContentEntry {
  id: string
  weight: number
}

export interface EventTemplate extends ContentEntry {
  text: string
  requires?: {
    phase?: Phase | Phase[]
    dangerLevel?: DangerLevel | DangerLevel[]
    minGreed?: number
    maxGreed?: number
    minHp?: number
    maxHp?: number
  }
  effects?: {
    backpackValue?: number | string // number or dice string like "+1d6"
    mood?: number
    hp?: number | string // number or dice string like "-15d21"
    /** General incoming damage that always routes through shield mitigation. */
    damage?: number | string // number or dice string like "15d6"
    greedLevel?: number
    ratRating?: number
    forcePhase?: Phase
    /** Robot id from robots.json. Triggers the placeholder robot combat roll. */
    robotEncounter?: string
    /** Multiplies menace-based robot damage on failed robot encounters. */
    robotDamageMultiplier?: number
    /** Finds a current-raid-only healing item from healing_items.json. */
    healingItem?: boolean
    /** Finds a manual-use shield recharger and adds it to the backpack. */
    shieldRecharger?: boolean
  }
}

export interface LootItem extends ContentEntry {
  name: string
  value: number
  flavor?: string
  /** 1 = Common … 5 = Legendary (higher = rarer). */
  rarity: number
}

export interface RobotEntry extends ContentEntry {
  name: string
  deadliness: 'weak' | 'moderate' | 'dangerous' | 'nasty' | 'deadly'
  menace: number
  flavorLines: string[]
  successText: string[]
  lootTable: RobotLootItem[]
}

export interface RobotLootItem extends ContentEntry {
  name: string
  value: number
  flavor?: string
  /** Optional until robot loot gets full rarity tuning. Defaults from robot menace. */
  rarity?: number
}

export interface HealingItem extends ContentEntry {
  name: string
  healAmount: number
  moodGain: number
  flavor?: string
  /** 1 = Common … 5 = Legendary (higher = rarer). */
  rarity: number
}

export interface ShieldRechargerItem extends ContentEntry {
  name: string
  value: number
  chargeAmount: number
  /** Number of ticks the recharge animation should take. 0 = instant. */
  applyTicks?: number
  flavor?: string
  /** 1 = Common … 5 = Legendary (higher = rarer). */
  rarity: number
}

export interface ZoneEntry extends ContentEntry {
  name: string
  description: string
}

export type TimeOfDay = 'Day' | 'Night' | 'Stella Red'
export type DangerLevel = 'Low' | 'Medium' | 'High'

export interface FlavorTable {
  [tableKey: string]: Array<{ id: string; weight: number; text: string }>
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export type Phase = 'HUB' | 'DEPLOYING' | 'RAIDING' | 'EXTRACTING' | 'DOWNED'

export type BackpackItemKind = 'loot' | 'shield_recharger'

export interface ShieldState {
  shieldId: string
  name: string
  maxCharge: number
  charge: number
  /** Fractional mitigation from 0 to 1 (for example, 0.4 = 40% damage reduction) while active. */
  mitigation: number
  /** 0-100; broken shields do not mitigate until a future repair system exists. */
  durability: number
}

export interface BackpackItem {
  itemId: string
  name: string
  value: number
  /** 1 = Common … 5 = Legendary */
  rarity: number
  flavor?: string
  quantity: number
  kind?: BackpackItemKind
  shieldChargeAmount?: number
  /** Number of ticks the recharge animation should take when this is a shield recharger. */
  applyTicks?: number
}

export interface HealingItemStack {
  itemId: string
  name: string
  healAmount: number
  /** Optional for backward compatibility with saved current-raid meds. */
  moodGain?: number
  rarity: number
  flavor?: string
  quantity: number
}

export interface HiddenPocketItem {
  itemId: string
  name: string
  value: number
  rarity: number
  flavor?: string
  kind?: BackpackItemKind
  quantity: number
}

export interface ActiveShieldRecharge {
  itemId: string
  name: string
  totalCharge: number
  chargeRemaining: number
  totalTicks: number
  ticksRemaining: number
}

export interface RaidState {
  zone: string | null
  dangerLevel: DangerLevel | null
  shield: ShieldState | null
  activeShieldRecharge: ActiveShieldRecharge | null
  backpack: BackpackItem[]
  /** Optional manually-selected single item saved on backpack-loss failures. */
  hiddenPocket: HiddenPocketItem | null
  /** Current-raid-only healing consumables. Lost on death/extraction; never stored at home. */
  healingItems: HealingItemStack[]
  backpackValue: number
  greedLevel: number   // 0–100; higher = more likely to push deeper and die
  phase: Phase
  phaseTicksRemaining: number
  /** Set by CALL_EXTRACT action to force next greed check toward extraction */
  forceExtract: boolean
}

export interface RaiderStats {
  name: string
  hp: number
  maxHp: number
  mood: number        // -5 to +5
  ratRating: number   // lifetime cowardice/looter score; both a shame and a badge
  deploysCount: number
  deathCount: number
  extractCount: number
}

export interface OutcomeContextStats {
  total: number
  byZone: Record<string, number>
  byZoneAndDanger: Record<string, number>
}

export interface RaiderLifetimeStats {
  extracts: OutcomeContextStats
  deaths: OutcomeContextStats
  robotDefeats: Record<string, number>
  healingItemsUsed: {
    total: number
    byItem: Record<string, number>
  }
}

export interface SignalState {
  current: number
  cap: number
  lastRegenAt: number  // timestamp ms
}

export interface LogEvent {
  id: string
  tick: number
  timestamp: number  // ms since epoch
  text: string
  phase: Phase
}

export interface GameState {
  version: number
  tick: number
  raider: RaiderStats
  raid: RaidState
  signal: SignalState
  log: LogEvent[]
  homeStash: BackpackItem[]
  /** Coin stash from auto-sold overflow loot — value is never deleted, only converted */
  coins: number
  stats: RaiderLifetimeStats
  // Set by CALL_EXTRACT so the tick driver knows to nudge the next greed check
  pendingEncourage: boolean
  pendingScold: boolean
}

// ---------------------------------------------------------------------------
// Tick result
// ---------------------------------------------------------------------------

export interface TickResult {
  state: GameState
  events: LogEvent[]
}
