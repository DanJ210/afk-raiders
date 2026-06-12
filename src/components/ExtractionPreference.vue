<script setup lang="ts">
import { useSettingsStore } from '../stores/settingsStore'

const settings = useSettingsStore()

const saferLabel = '🏃 Safer'
const hoarderLabel = '💰 Hoarder'

function getPreferenceLabel(value: number): string {
  if (value < 25) return 'Paranoid'
  if (value < 50) return 'Cautious'
  if (value === 50) return 'Balanced'
  if (value < 75) return 'Greedy'
  return 'Reckless'
}
</script>

<template>
  <section class="extraction-pref" aria-label="Extraction Preference">
    <header class="extraction-pref__header">⚙️ EXTRACTION STYLE</header>

    <div class="extraction-pref__labels">
      <span class="extraction-pref__label-left">{{ saferLabel }}</span>
      <span class="extraction-pref__label-right">{{ hoarderLabel }}</span>
    </div>

    <input
      v-model.number="settings.extractionPreference"
      type="range"
      min="0"
      max="100"
      class="extraction-pref__slider"
      :title="`Extraction preference: ${getPreferenceLabel(settings.extractionPreference)}`"
    />

    <p class="extraction-pref__desc">
      {{ getPreferenceLabel(settings.extractionPreference) }}
    </p>

    <p class="extraction-pref__help">
      Safer raider attempts extraction earlier. Hoarder stays longer for more loot.
    </p>
  </section>
</template>

<style scoped>
.extraction-pref {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 14px;
}

.extraction-pref__header {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--color-accent);
  margin-bottom: 12px;
}

.extraction-pref__labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.7rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.extraction-pref__slider {
  width: 100%;
  height: 6px;
  margin-bottom: 10px;
  cursor: pointer;
  appearance: none;
  background: var(--color-surface-raised);
  border-radius: 3px;
  outline: none;
}

/* Webkit browsers (Chrome, Safari, Edge) */
.extraction-pref__slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--color-accent);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: background 0.2s;
}

.extraction-pref__slider::-webkit-slider-thumb:hover {
  background: var(--color-accent);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

/* Firefox */
.extraction-pref__slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--color-accent);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: background 0.2s;
}

.extraction-pref__slider::-moz-range-thumb:hover {
  background: var(--color-accent);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.extraction-pref__desc {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
  margin: 8px 0 6px;
}

.extraction-pref__help {
  font-size: 0.75rem;
  color: var(--color-muted);
  font-style: italic;
  margin: 0;
}
</style>
