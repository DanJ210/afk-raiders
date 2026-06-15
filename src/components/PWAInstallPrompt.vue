<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'

const settings = useSettingsStore()

const shouldShow = computed(() => settings.showInstallPrompt && !settings.isAppInstalled)
</script>

<template>
  <Teleport to="body">
    <Transition name="pwa-slide">
      <div v-if="shouldShow" class="pwa-install-prompt" role="banner">
        <div class="pwa-install-content">
          <div class="pwa-install-text">
            <h3>Install AFK Raiders</h3>
            <p>Install as an app for quick access and offline play.</p>
          </div>
          <div class="pwa-install-actions">
            <button class="pwa-btn pwa-btn-primary" @click="settings.installApp()">
              Install
            </button>
            <button class="pwa-btn pwa-btn-secondary" @click="settings.dismissInstallPrompt()">
              Not now
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pwa-install-prompt {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
  border-top: 2px solid #e94560;
  padding: 16px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  font-family: var(--font-mono);
}

.pwa-install-content {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.pwa-install-text h3 {
  margin: 0 0 4px 0;
  font-size: 0.95rem;
  color: #e94560;
  font-weight: 600;
}

.pwa-install-text p {
  margin: 0;
  font-size: 0.85rem;
  color: #ccc;
}

.pwa-install-actions {
  display: flex;
  gap: 8px;
}

.pwa-btn {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.pwa-btn-primary {
  background: #e94560;
  color: #fff;
}

.pwa-btn-primary:hover {
  background: #d63150;
}

.pwa-btn-secondary {
  background: transparent;
  color: #ccc;
  border: 1px solid #ccc;
}

.pwa-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #e94560;
  color: #e94560;
}

.pwa-slide-enter-active,
.pwa-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.pwa-slide-enter-from,
.pwa-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (max-width: 600px) {
  .pwa-install-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .pwa-install-actions {
    width: 100%;
  }

  .pwa-install-actions button {
    flex: 1;
  }
}
</style>
