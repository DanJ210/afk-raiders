<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { useGameStore } from '../stores/gameStore'
import { TICK_INTERVAL_MS } from '../engine/catchUp'
import { getRevivalSignalCost } from '../engine/raiderLevel'
import { advanceSignal, SIGNAL_CAP } from '../engine/signal'

const store = useGameStore()
const emit = defineEmits<{
  openSignal: []
  openMeds: []
}>()
const now = useNow({ interval: 1000 })
const isDowned = computed(() => store.phase === 'RAIDING' && store.raid.downed !== null)
const revivalCost = computed(() => getRevivalSignalCost(store.raider.levelXp))
const signalSnapshot = computed(() => advanceSignal(store.state.signal, now.value.getTime()))
const signalAvailable = computed(() => signalSnapshot.value.signal.current)
const amplifiers = computed(() => store.state.signalAmplifiers + signalSnapshot.value.amplifiersGained)
const canReachRevivalCost = computed(() =>
  signalAvailable.value >= revivalCost.value || (amplifiers.value > 0 && SIGNAL_CAP >= revivalCost.value),
)
const reviveMedCount = computed(() => store.raid.healingItems
  .filter(item => (item.reviveAmount ?? 0) > 0)
  .reduce((total, item) => total + item.quantity, 0),
)

function countdown(ticks: number): string {
  const elapsed = Math.max(0, now.value.getTime() - store.lastTickAt)
  const seconds = Math.max(0, Math.ceil((ticks * TICK_INTERVAL_MS - elapsed) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
const recoveryTimer = computed(() => countdown(store.raid.downed?.ticksRemaining ?? 0))
const extractionTimer = computed(() => countdown(store.raid.extracting?.ticksRemaining ?? 0))
</script>

<template>
  <section
    v-if="isDowned"
    class="shrink-0 rounded-md border border-danger bg-surface p-2.5 font-mono text-raider-meta"
    aria-label="Raider rescue"
  >
    <p class="m-0 font-bold text-danger" role="alert">Raider DOWNED. Rescue needed.</p>
    <p class="m-0 mt-1 text-text">Knockout in {{ recoveryTimer }}. Revive restores 25 HP.</p>
    <p v-if="store.raid.extracting" class="m-0 mt-1 text-accent">
      Extraction in {{ extractionTimer }}. If it completes before or with knockout, the haul is saved.
    </p>
    <div class="mt-2 grid grid-cols-2 gap-2">
      <button type="button" class="btn-ghost" @click="emit('openSignal')">
        Signal revive · {{ revivalCost }} Signal
      </button>
      <button type="button" class="btn-ghost" @click="emit('openMeds')">
        Field meds · {{ reviveMedCount }} revive {{ reviveMedCount === 1 ? 'dose' : 'doses' }}
      </button>
    </div>
    <p class="m-0 mt-1 text-muted">
      {{ signalAvailable }}/{{ SIGNAL_CAP }} Signal<span v-if="amplifiers > 0"> · {{ amplifiers }} amplifiers</span>.
      <template v-if="signalAvailable < revivalCost && canReachRevivalCost">Refill with an amplifier to afford Signal revive.</template>
      <template v-else-if="!canReachRevivalCost && reviveMedCount === 0">No rescue available right now.</template>
      <template v-else-if="!canReachRevivalCost">Not enough Signal; use a revive med.</template>
    </p>
  </section>
</template>
