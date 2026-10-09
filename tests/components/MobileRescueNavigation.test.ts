// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, reactive, ref } from 'vue'
import App from '../../src/App.vue'
import { createInitialState } from '../../src/engine/initialState'

const mobileMode = ref(true)
function createStore() {
  const state = reactive(createInitialState(Date.now()))
  state.raid.phase = 'RAIDING'
  state.raid.downed = { ticksRemaining: 2, totalTicks: 2 }
  state.raider.hp = 0
  return reactive({
    state,
    phase: computed(() => state.raid.phase),
    raid: computed(() => state.raid),
    raider: computed(() => state.raider),
    log: computed(() => state.log),
    lastTickAt: Date.now(),
    needsRaiderCreation: false,
    resetSave: vi.fn(),
  })
}
let store: ReturnType<typeof createStore>
vi.mock('../../src/stores/gameStore', () => ({ useGameStore: () => store }))
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@vueuse/core')>(),
  useMediaQuery: () => mobileMode,
}))

const stubs = {
  CommsLog: true,
  RaiderCard: true,
  BackpackPanel: true,
  HomeStash: true,
  HandlerActions: true,
  AwaySummary: true,
  RaiderCreationPanel: true,
  PWAInstallPrompt: true,
  PhaseStatusStrip: true,
  SkillsPanel: true,
  RaiderLifetimeStats: true,
  PreparationPanel: true,
}

describe('mobile rescue navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mobileMode.value = true
    store = createStore()
  })
  afterEach(() => vi.useRealTimers())

  it('keeps rescue visible on every mobile tab and opens the existing rescue controls', async () => {
    const wrapper = mount(App, { global: { stubs } })
    for (const button of wrapper.findAll('nav button')) {
      await button.trigger('click')
      expect(wrapper.get('[aria-label="Raider rescue"]').isVisible()).toBe(true)
    }
    const rescueButtons = wrapper.get('[aria-label="Raider rescue"]').findAll('button')
    await rescueButtons[0]!.trigger('click')
    expect(wrapper.find('handler-actions-stub').exists()).toBe(true)
    expect(wrapper.get('nav [aria-current="page"]').text()).toContain('Raider')
    await rescueButtons[1]!.trigger('click')
    expect(wrapper.find('backpack-panel-stub').exists()).toBe(true)
    expect(wrapper.get('nav [aria-current="page"]').text()).toContain('Raid')
    expect(store.state.raid.downed).not.toBeNull()
    wrapper.unmount()
  })

  it('does not add the mobile prompt to the desktop layout', () => {
    mobileMode.value = false
    const wrapper = mount(App, { global: { stubs } })
    expect(wrapper.find('[aria-label="Raider rescue"]').exists()).toBe(false)
    expect(wrapper.find('handler-actions-stub').exists()).toBe(true)
    expect(wrapper.find('backpack-panel-stub').exists()).toBe(true)
    wrapper.unmount()
  })
})
