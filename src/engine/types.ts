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
    timeOfDay?: TimeOfDay | TimeOfDay[]
    minGreed?: number
    maxGreed?: number
    minHp?: number
    maxHp?: number
  }
  effects?: {
    backpackValue?: number | string // number or dice string like "+1d6"
    mood?: number
    hp?: number | string // number or dice string like "-15d21"
    greedLevel?: number
    ratRating?: number
    forcePhase?: Phase
    /** Robot id from robots.json. Triggers the placeholder robot combat roll. */
    robotEncounter?: string
    /** Multiplies menace-based robot damage on failed robot encounters. */
    robotDamageMultiplier?: number
    /** Finds a current-raid-only healing item from healing_items.json. */
    healingItem?: boolean
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

export interface BackpackItem {
  itemId: string
  name: string
  value: number
  /** 1 = Common … 5 = Legendary */
  rarity: number
  flavor?: string
  quantity: number
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

export interface RaidState {
  zone: string | null
  timeOfDay: TimeOfDay | null
  backpack: BackpackItem[]
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
  // Set by CALL_EXTRACT so the tick driver knows to nudge the next greed check
  pendingEncourage: boolean
  pendingScold: boolean
  // Ready-up state to allow instant deployment on the next tick after a HUB arrival, instead of waiting through the DEPLOYING phase; also used to trigger the "Ready!" UI state
  pendingReadyUp: boolean
}

// ---------------------------------------------------------------------------
// Tick result
// ---------------------------------------------------------------------------

export interface TickResult {
  state: GameState
  events: LogEvent[]
}
