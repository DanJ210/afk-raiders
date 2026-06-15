/** settingsStore — minimal settings for future expansion */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const useSettingsStore = defineStore('settings', () => {
  // Placeholder: reduced motion preference (for future log animations)
  const reducedMotion = useLocalStorage('afk-settings-reduced-motion', false)

  // Placeholder: log density ('full' | 'compact')
  const logDensity = ref<'full' | 'compact'>('full')

  // PWA installation support
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
  const showInstallPrompt = ref(false)
  const isAppInstalled = ref(false)

  // Listen for beforeinstallprompt event (web)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault()
      deferredPrompt.value = e as BeforeInstallPromptEvent
      showInstallPrompt.value = true
    })

    // Detect if app is already installed
    window.addEventListener('appinstalled', () => {
      isAppInstalled.value = true
      showInstallPrompt.value = false
    })

    // Check if running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isAppInstalled.value = true
    }
  }

  async function installApp() {
    if (!deferredPrompt.value) return
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') {
      isAppInstalled.value = true
    }
    deferredPrompt.value = null
  }

  function dismissInstallPrompt() {
    showInstallPrompt.value = false
  }

  return { reducedMotion, logDensity, showInstallPrompt, isAppInstalled, installApp, dismissInstallPrompt }
})
