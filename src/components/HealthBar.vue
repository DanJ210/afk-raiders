<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  max: number
  label?: string
}>()

const hpPercent = computed(() => {
  if (props.max <= 0) return 0
  const percent = (props.current / props.max) * 100
  return Math.max(0, Math.min(100, Math.round(percent)))
})

const hpClass = computed(() => {
  if (hpPercent.value > 60) return 'health-bar__fill--good'
  if (hpPercent.value > 30) return 'health-bar__fill--warning'
  return 'health-bar__fill--danger'
})
</script>

<template>
  <div class="health-bar">
    <span class="health-bar__label">{{ label ?? 'HP' }}</span>
    <div
      class="health-bar__track"
      role="meter"
      aria-label="Raider health"
      aria-valuemin="0"
      :aria-valuemax="max"
      :aria-valuenow="current"
    >
      <div class="health-bar__fill" :class="hpClass" :style="{ width: hpPercent + '%' }" />
    </div>
    <span class="health-bar__value">{{ current }}/{{ max }}</span>
  </div>
</template>

<style scoped>
.health-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.health-bar__label,
.health-bar__value {
  flex-shrink: 0;
  color: var(--color-muted);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  font-family: var(--font-mono);
}

.health-bar__value {
  color: var(--color-text);
}

.health-bar__track {
  flex: 1;
  height: 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  overflow: hidden;
}

.health-bar__fill {
  height: 100%;
  transition: width 0.2s ease;
}

.health-bar__fill--good { background: var(--color-success); }
.health-bar__fill--warning { background: var(--color-warning); }
.health-bar__fill--danger { background: var(--color-danger); }
</style>