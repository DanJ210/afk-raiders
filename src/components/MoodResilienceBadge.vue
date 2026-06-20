<script setup lang="ts">
import { computed } from 'vue'
import { getMoodResilienceReductionPercent } from '../engine/mood'

const props = defineProps<{
  mood: number
}>()

const resiliencePercent = computed(() => getMoodResilienceReductionPercent(props.mood))
const showBadge = computed(() => resiliencePercent.value > 0)
</script>

<template>
  <span
    v-if="showBadge"
    class="inline-flex items-center ml-2 px-1.5 py-px rounded-full border border-accent text-accent font-mono text-[0.65rem] tracking-[0.04em] whitespace-nowrap"
    :style="{ background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)' }"
    :title="`Positive mood reduces robot damage by ${resiliencePercent}%`"
  >
    Resilience +{{ resiliencePercent }}%
  </span>
</template>
