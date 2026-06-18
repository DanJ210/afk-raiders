<script setup lang="ts">
import { computed } from 'vue'
import type { Phase } from '../engine/types'

const props = defineProps<{
  phase: Phase
  zoneName: string | null
  dangerLevel: string | null
}>()

const showZoneStrip = computed(() => props.phase === 'RAIDING' && props.zoneName !== null)
</script>

<template>
  <div v-if="showZoneStrip" class="phase-status-strip">
    📍 Zone: <strong>{{ zoneName }}</strong><span v-if="dangerLevel"> · <span class="phase-status-strip__danger">{{ dangerLevel }}</span></span>
  </div>
</template>

<style scoped>
.phase-status-strip {
  flex: none;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 5px 10px;
}

.phase-status-strip strong {
  color: var(--color-accent);
  font-weight: 700;
}

.phase-status-strip__danger {
  color: var(--color-muted);
}
</style>
