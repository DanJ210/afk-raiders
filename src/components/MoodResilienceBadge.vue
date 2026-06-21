<script setup lang="ts">
import { computed } from 'vue'
import { getMoodResilienceReductionPercent } from '../engine/mood'

const props = defineProps<{
  mood: number
  levelResiliencePercent?: number
}>()

function formatPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

const moodResiliencePercent = computed(() => getMoodResilienceReductionPercent(props.mood))
const levelResiliencePercent = computed(() => Math.max(0, props.levelResiliencePercent ?? 0))
const totalResiliencePercent = computed(() => moodResiliencePercent.value + levelResiliencePercent.value)
const showBadge = computed(() => totalResiliencePercent.value > 0)
const sourceLabel = computed(() => [
  moodResiliencePercent.value > 0 ? `Mood +${formatPercent(moodResiliencePercent.value)}%` : null,
  levelResiliencePercent.value > 0 ? `Level +${formatPercent(levelResiliencePercent.value)}%` : null,
].filter((label): label is string => label !== null).join(' · '))
</script>

<template>
  <span
    v-if="showBadge"
    class="inline-flex items-center flex-wrap gap-x-1 ml-2 px-1.5 py-px rounded-full border border-accent text-accent font-mono text-[0.65rem] tracking-[0.04em]"
    :style="{ background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)' }"
    :title="`Failed robot damage resilience: ${sourceLabel}`"
  >
    <span>Resilience +{{ formatPercent(totalResiliencePercent) }}%</span>
    <span class="opacity-75">({{ sourceLabel }})</span>
  </span>
</template>
