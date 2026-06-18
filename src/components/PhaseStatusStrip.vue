<script setup lang="ts">
import { computed } from 'vue'
import type { Phase } from '../engine/types'

const props = defineProps<{
  phase: Phase
  zoneName: string | null
  dangerLevel: string | null
  phaseTimeText?: string | null
}>()

const showZoneStrip = computed(() => props.phase === 'RAIDING' && props.zoneName !== null)
</script>

<template>
  <div v-if="showZoneStrip" class="phase-status-strip">
    📍 Zone: <strong>{{ zoneName }}</strong><span v-if="dangerLevel"> · <span class="phase-status-strip__danger">{{ dangerLevel }}</span></span><span v-if="phaseTimeText"> · <span class="phase-status-strip__time">{{ phaseTimeText }}</span></span>
  </div>
</template>

<style scoped>
.phase-status-strip {
  font-size: 0.7rem;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
  background: var(--color-surface-raised);
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
}

.phase-status-strip strong {
  font-weight: 700;
}

.phase-status-strip__danger {
  color: var(--color-muted);
}

.phase-status-strip__time {
  color: var(--color-accent);
  font-weight: 700;
}
</style>
