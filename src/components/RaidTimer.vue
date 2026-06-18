<script setup lang="ts">
const props = withDefaults(defineProps<{
  timerText: string
  label?: string
}>(), {
  label: 'Zone Nuke In',
})
</script>

<template>
  <div class="raid-timer">
    <span class="raid-timer__label">{{ props.label }}</span>
    <span class="raid-timer__value">{{ props.timerText }}</span>
  </div>
</template>

<style scoped>
.raid-timer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.raid-timer__label {
  font-size: 0.75rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
  min-width: 72px;
}

.raid-timer__value {
  min-width: 0;
  font-size: 0.85rem;
  color: var(--color-danger);
  font-family: var(--font-mono);
  font-weight: 700;
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .raid-timer {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .raid-timer__label {
    min-width: 0;
  }
}
</style>
