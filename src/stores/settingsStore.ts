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
    // Check if running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isAppInstalled.value = true
    }

    // Guard against duplicate listener registration (e.g. HMR)
    if (!(window as any).__afkPwaListenersRegistered) {
      ;(window as any).__afkPwaListenersRegistered = true

      window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault()
        deferredPrompt.value = e as BeforeInstallPromptEvent
        showInstallPrompt.value = true
      })

      window.addEventListener('appinstalled', () => {
        isAppInstalled.value = true
        showInstallPrompt.value = false
      })
    }
  }

  async function installApp() {
    const promptEvent = deferredPrompt.value
    if (!promptEvent) return

    // Hide the banner while the native prompt is being handled
    showInstallPrompt.value = false

    try {
      await promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted') {
        isAppInstalled.value = true
      }
    } finally {
      // The event can only be used once.
      deferredPrompt.value = null
    }
  }

  function dismissInstallPrompt() {
    showInstallPrompt.value = false
  }

  return { reducedMotion, logDensity, showInstallPrompt, isAppInstalled, installApp, dismissInstallPrompt }
})
