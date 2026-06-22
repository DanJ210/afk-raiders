<script setup lang="ts">
import { computed } from 'vue'
import type { Phase } from '../engine/types'

const props = defineProps<{
  phase: Phase
  zoneName: string | null
  dangerLevel: string | null
  phaseTimeText?: string | null
  conditionName?: string | null
  conditionDescription?: string | null
}>()

const showZoneStrip = computed(() => props.phase === 'RAIDING' && props.zoneName !== null)
</script>

<template>
  <div
    v-if="showZoneStrip"
    class="flex flex-col gap-comms-tick-bar font-mono text-raider-tiny px-2 py-0.5 rounded border border-accent bg-surface-raised text-accent tracking-wider"
  >
    <div class="leading-tight">
      📍 Zone: <strong class="font-bold">{{ zoneName }}</strong><span v-if="dangerLevel"> · <span class="text-muted">{{ dangerLevel }}</span></span><span v-if="phaseTimeText"> · <span class="font-bold">{{ phaseTimeText }}</span></span>
    </div>
    <div v-if="conditionName" class="leading-tight text-muted">
      🌦 Condition: <strong class="font-bold">{{ conditionName }}</strong><span v-if="conditionDescription"> · <span class="text-muted">{{ conditionDescription }}</span></span>
    </div>
  </div>
</template>
