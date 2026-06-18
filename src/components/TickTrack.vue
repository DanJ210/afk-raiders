<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { TICK_INTERVAL_MS } from '../engine/catchUp'

const props = defineProps<{
  lastTickAt: number
}>()

const now = useNow({ interval: 1000 })

const progress = computed(() => {
  if (!props.lastTickAt) return 0
  const elapsed = Math.max(0, now.value.getTime() - props.lastTickAt)
  return Math.max(0, Math.min(100, Math.round((elapsed / TICK_INTERVAL_MS) * 100)))
})
</script>

<template>
  <div class="tick-track" aria-hidden="true">
    <div class="tick-track__bar" :style="{ width: `${progress}%` }"></div>
  </div>
</template>

<style scoped>
.tick-track {
  height: 3px;
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
  overflow: hidden;
}

.tick-track__bar {
  height: 100%;
  background: var(--color-accent);
  opacity: 0.7;
  transition: width 0.95s linear;
}

@media (prefers-reduced-motion: reduce) {
  .tick-track__bar {
    transition: none;
  }
}
</style>