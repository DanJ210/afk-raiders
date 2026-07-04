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
  parameters?: Record<string, string | number>
  commsPriority?: CommsPriority
  requires?: {
    phase?: Phase | Phase[]
    extracting?: boolean
    downed?: boolean
    dangerLevel?: DangerLevel | DangerLevel[]
    zone?: string | string[]
    zoneCondition?: string | string[]
    activeActivityKind?: RaidActivityKind | RaidActivityKind[]
    activeActivityId?: string | string[]
    activeRobotId?: string | string[]
    minGreed?: number
    maxGreed?: number
    minHp?: number
    maxHp?: number
    minRaiderLevel?: number
    maxRaiderLevel?: number
  }
  effects?: {
    backpackValue?: number | string // number or dice string like "+1d6"
    mood?: number
    hp?: number | string // number or dice string like "-15d21"
    /** General incoming damage that always routes through shield mitigation. */
    damage?: number | string // number or dice string like "15d6"
    greedLevel?: number
    ratRating?: number
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
    /** Starts a JSON-backed multi-tick raid activity. */
    startRaidActivity?: StartRaidActivityEffect
  }
}

export interface RobotActivityPool {
  dangerLevel?: DangerLevel | DangerLevel[]
  zone?: string | string[]
  zoneCondition?: string | string[]
  deadliness?: RobotEntry['deadliness'] | RobotEntry['deadliness'][]
  minGreed?: number
  maxGreed?: number
  minRaiderLevel?: number
  maxRaiderLevel?: number
  /** When true, includes boss robots in pooled selection. Defaults to false. */
  includeBosses?: boolean
}

export interface RaidActivityRequires {
  dangerLevel?: DangerLevel | DangerLevel[]
  zone?: string | string[]
  zoneCondition?: string | string[]
  minGreed?: number
  maxGreed?: number
  minRaiderLevel?: number
  maxRaiderLevel?: number
}

export interface StartRaidActivityEffect {
  activityId: string
  kind?: RaidActivityKind
  hazardDamage?: number
  healingItem?: boolean
  lootTableId?: string | string[]
  lootRolls?: number
  shieldRecharger?: boolean
  robotId?: string
  robotPool?: RobotActivityPool
  robotDamageMultiplier?: number
  robotDamageTakenMultiplier?: number
  raiderBaseDamage?: number
  raiderDamageMultiplier?: number
}

export interface RaidActivityTextSet {
  started: string
  progress: string[]
  completed: string
  failed: string
}

export interface RaidActivityDefinition extends ContentEntry {
  name: string
  kind: RaidActivityKind
  ticks: number
  commsPriority?: CommsPriority
  requires?: RaidActivityRequires
  text: RaidActivityTextSet
  blocking?: boolean
  hazardDamage?: number
  healingItem?: boolean
  lootTableId?: string | string[]
  lootRolls?: number
  shieldRecharger?: boolean
  robotId?: string
  robotPool?: RobotActivityPool
  weaponId?: string
  weaponName?: string
  raiderBaseDamage?: number
  raiderDamageMultiplier?: number
  robotDamageTakenMultiplier?: number
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
  /** Boss robots are excluded from generic pools unless includeBosses is true. */
  isBoss?: boolean
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
  purchaseCost: number
  reviveAmount?: number
  flavor?: string
  /** 1 = Common … 5 = Legendary (higher = rarer). */
  rarity: number
}

export interface WeaponEntry extends ContentEntry {
  id: string
  name: string
  damage: number
  damageMultiplier: number
  damageMin: number
  damageMax: number
  value: number
  rarity: number
  durabilityMax: number
  repairCost: number
  flavor?: string
}

export interface OwnedWeapon {
  weaponId: string
  durability: number
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
  /** True when staged from HUB loadout rather than found during the raid. */
  fromLoadout?: boolean
  /** Quantity within this stack that was staged from HUB loadout rather than found during the raid. */
  fromLoadoutQuantity?: number
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
  /** True when staged from HUB loadout rather than found during the raid. */
  fromLoadout?: boolean
}

export interface ShieldRechargerStack {
  itemId: string
  name: string
  value: number
  chargeAmount: number
  /** Number of ticks to apply during active raid use. */
  applyTicks?: number
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

export type RaidActivityKind = 'SEARCH' | 'ROBOT_ENCOUNTER' | 'EXTRACTION' | 'DOWNED' | 'SHIELD_RECHARGE'

export interface ActiveRaidActivity {
  id: string
  name?: string
  kind: RaidActivityKind
  ticksRemaining: number
  totalTicks: number
  locationId?: string
  healingItem?: boolean
  lootTableId?: string | string[]
  lootRolls?: number
  shieldRecharger?: boolean
  robotId?: string
  robotHp?: number
  robotMaxHp?: number
  weaponId?: string
  weaponName?: string
  raiderBaseDamage?: number
  raiderDamageMultiplier?: number
  robotDamageTakenMultiplier?: number
  robotDamageMultiplier?: number
  raiderAction?: 'fighting' | 'hiding' | 'fleeing' | 'searching'
}

export type DownedReasonKind = 'robot' | 'ambient_pressure' | 'extraction' | 'raid_timeout' | 'damage' | 'unknown'

export interface DownedReason {
  kind: DownedReasonKind
  text: string
  robotId?: string
  robotName?: string
  activityId?: string
  damageSummary?: string
}

export interface DownedState {
  ticksRemaining: number
  totalTicks?: number
  reason?: DownedReason
}

export interface ExtractingState {
  ticksRemaining: number
  totalTicks?: number
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
  activeRaidActivity: ActiveRaidActivity | null
  backpack: BackpackItem[]
  /** Optional manually-selected single item saved on backpack-loss failures. */
  hiddenPocket: HiddenPocketItem | null
  /** Current-raid-only healing consumables. Lost on death/extraction; never stored at home. */
  healingItems: HealingItemStack[]
  /** Selected current-loadout healing items to move into a raid on the next deployment. */
  selectedHealingLoadout: HealingItemStack[]
  /** Selected current-loadout shield rechargers to move into a raid on the next deployment. */
  selectedShieldRechargerLoadout: ShieldRechargerStack[]
  /** HUB-selected weapon id used for robot encounters unless an activity overrides weapon fields. */
  equippedWeaponId: string | null
  backpackValue: number
  /** Fractional carry from repeated resilience rounding during robot retaliation. */
  robotResilienceCarry?: number
  greedLevel: number   // 0–100; higher = stronger loot appetite and major-condition momentum
  phase: Phase
  phaseTicksRemaining: number
  downed: DownedState | null
  extracting: ExtractingState | null
  /** One-shot guard: the raid-timeout DOWNED race already started this raid, so a revive cannot be re-downed by the same expired timer. */
  raidTimeoutDownedStarted?: boolean
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

export type LogCondition = 'DOWNED' | 'EXTRACTING'

export const CommsPriority = {
  Ambient: 'ambient',
  Priority: 'priority',
  Activity: 'activity',
} as const

export type CommsPriority = typeof CommsPriority[keyof typeof CommsPriority]

export interface LogEvent {
  id: string
  tick: number
  timestamp: number  // ms since epoch
  text: string
  phase: Phase
  commsPriority: CommsPriority
  conditions?: LogCondition[]
}

export type ActivityKind = RaidActivityKind
export type ActivityStatus = 'started' | 'progress' | 'completed' | 'failed'

export interface ActivityLogEvent extends LogEvent {
  activityId: string
  activityName?: string
  activity: ActivityKind
  status: ActivityStatus
}

export interface GameState {
  version: number
  tick: number
  raider: RaiderStats
  raid: RaidState
  signal: SignalState
  signalAmplifiers: number
  log: LogEvent[]
  activityLog: ActivityLogEvent[]
  homeStash: BackpackItem[]
  /** Weapons owned by the handler. Durability is consumed by raid outcomes and can be repaired in HUB. */
  ownedWeapons: OwnedWeapon[]
  /** Purchased HUB stock of healing consumables available for future raid loadouts. */
  purchasedHealingItems: HealingItemStack[]
  /** Purchased HUB stock of shield rechargers available for future raid loadouts. */
  purchasedShieldRechargers: ShieldRechargerStack[]
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
  activityEvents: ActivityLogEvent[]
}
