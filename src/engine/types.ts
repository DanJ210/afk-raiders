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
    extracting?: boolean
    downed?: boolean
    dangerLevel?: DangerLevel | DangerLevel[]
    zoneCondition?: string | string[]
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
    /** Robot id from robots.json. Triggers the placeholder robot combat roll. */
    robotEncounter?: string
    /** Multiplies menace-based robot damage on failed robot encounters. */
    robotDamageMultiplier?: number
    /** Finds a current-raid-only healing item from healing_items.json. */
    healingItem?: boolean
    /** Finds a manual-use shield recharger and adds it to the backpack. */
    shieldRecharger?: boolean
    /** Completes the active extraction condition successfully. */
    completeExtraction?: boolean
    /** Cancels the active extraction condition and leaves the raid in progress. */
    failExtraction?: boolean
    /** Starts the downed condition while the raid remains in RAIDING. */
    startDowned?: boolean
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
  reviveAmount?: number
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

export type SkillTrackId = 'cardio' | 'hoarding' | 'hiding_in_lockers' | 'signal_handling'

export interface SkillDefinition {
  id: SkillTrackId
  name: string
  description: string
  maxLevel: number
  /** Total XP thresholds required to reach levels 1..maxLevel. */
  xpThresholds: number[]
  /** Index 0 describes no learned level; indexes 1..maxLevel describe active level effects. */
  effectTextByLevel: string[]
  /** Index 0 narrates reaching level 1; indexes 1..maxLevel-1 narrate later levels. */
  levelUpTextByLevel: string[]
}

export interface RaiderLevelTitleBand {
  id: string
  minLevel: number
  maxLevel: number
  name: string
  description: string
  levelUpText: string[]
}

export interface RaiderLevelContent {
  titleBands: RaiderLevelTitleBand[]
}

export interface ZoneEntry extends ContentEntry {
  name: string
  description: string
}

export type DangerLevel = 'Low' | 'Medium' | 'High'

export interface FlavorTable {
  [tableKey: string]: Array<{ id: string; weight: number; text: string }>
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export type Phase = 'HUB' | 'DEPLOYING' | 'RAIDING' | 'KNOCKED_OUT'

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
  reviveAmount?: number
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

export interface DownedState {
  ticksRemaining: number
}

export interface ExtractingState {
  ticksRemaining: number
}

export interface ZoneCondition {
  id: string
  name: string
  description: string
}

export interface RaidState {
  zone: string | null
  dangerLevel: DangerLevel | null
  zoneCondition?: ZoneCondition | null
  shield: ShieldState | null
  activeShieldRecharge: ActiveShieldRecharge | null
  backpack: BackpackItem[]
  /** Optional manually-selected single item saved on backpack-loss failures. */
  hiddenPocket: HiddenPocketItem | null
  /** Current-raid-only healing consumables. Lost on death/extraction; never stored at home. */
  healingItems: HealingItemStack[]
  backpackValue: number
  greedLevel: number   // 0–100; higher = stronger loot appetite and major-condition momentum
  phase: Phase
  phaseTicksRemaining: number
  downed: DownedState | null
  extracting: ExtractingState | null
  /** Set by CALL_EXTRACT action to force next greed check toward extraction */
  forceExtract: boolean
}

export interface RaiderStats {
  name: string
  hp: number
  maxHp: number
  mood: number        // -5 to +5
  levelXp: number     // cumulative Raider Level XP; level is derived from this, capped at 75
  ratRating: number   // lifetime cowardice/looter score; both a shame and a badge
  deploysCount: number
  deathCount: number
  extractCount: number
  skills: RaiderSkillsState
}

export interface RaiderSkillProgress {
  id: SkillTrackId
  level: number
  xp: number
  discovered: boolean
}

export type RaiderSkillsState = Record<SkillTrackId, RaiderSkillProgress>

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
  signalAmplifiers: number
  log: LogEvent[]
  homeStash: BackpackItem[]
  /** Coin stash from auto-sold overflow loot — value is never deleted, only converted */
  coins: number
  stats: RaiderLifetimeStats
  // Set by CALL_EXTRACT so the tick driver knows to nudge the next greed check
  pendingCalm: boolean
  pendingPressure: boolean
}

// ---------------------------------------------------------------------------
// Tick result
// ---------------------------------------------------------------------------

export interface TickResult {
  state: GameState
  events: LogEvent[]
}
