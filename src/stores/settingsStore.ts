/** settingsStore — minimal settings for future expansion */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export const useSettingsStore = defineStore('settings', () => {
  // Placeholder: reduced motion preference (for future log animations)
  const reducedMotion = useLocalStorage('afk-settings-reduced-motion', false)

  // Placeholder: log density ('full' | 'compact')
  const logDensity = ref<'full' | 'compact'>('full')

  // Extraction preference slider: 0 = Safer (quick extract), 100 = Hoarder (max loot)
  const extractionPreference = useLocalStorage('afk-settings-extraction-preference', 50)

  return { reducedMotion, logDensity, extractionPreference }
})
