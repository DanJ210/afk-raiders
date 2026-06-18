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
  <span v-if="showBadge" class="mood-resilience-badge" :title="`Positive mood reduces robot damage by ${resiliencePercent}%`">
    Resilience +{{ resiliencePercent }}%
  </span>
</template>

<style scoped>
.mood-resilience-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 14%, transparent);
  color: var(--color-accent);
  font-size: 0.65rem;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
  white-space: nowrap;
}
</style>
