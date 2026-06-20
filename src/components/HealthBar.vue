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

const hpFillColor = computed(() => {
  if (hpPercent.value > 60) return 'bg-success'
  if (hpPercent.value > 30) return 'bg-warning'
  return 'bg-danger'
})
</script>

<template>
  <div class="flex items-center gap-2 w-full min-w-0">
    <span class="shrink-0 text-muted font-mono text-[0.68rem] tracking-[0.06em]">{{ label ?? 'HP' }}</span>
    <div
      class="progress-track"
      role="meter"
      aria-label="Raider health"
      aria-valuemin="0"
      :aria-valuemax="max"
      :aria-valuenow="current"
    >
      <div class="progress-fill" :class="hpFillColor" :style="{ width: hpPercent + '%' }" />
    </div>
    <span class="shrink-0 text-text font-mono text-[0.68rem] tracking-[0.06em]">{{ current }}/{{ max }}</span>
  </div>
</template>
