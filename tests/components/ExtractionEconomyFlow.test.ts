// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import App from '../../src/App.vue'
import { useGameStore } from '../../src/stores/gameStore'
import { createInitialState } from '../../src/engine/initialState'
import { processTick } from '../../src/engine/tick'
import { createRNG } from '../../src/engine/rng'

const mobileMode = ref(true)
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@vueuse/core')>(),
  useMediaQuery: () => mobileMode,
}))

describe('extraction to preparation flow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    localStorage.clear()
    setActivePinia(createPinia())
    mobileMode.value = true
  })
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('navigates the receipt, preserves the chosen goal through manual sale, and buys through existing confirmation', async () => {
    const store = useGameStore()
    store.needsRaiderCreation = false
    const state = createInitialState(Date.now())
    state.raid.phase = 'RAIDING'
    state.raid.phaseTicksRemaining = 20
    state.raid.extracting = { ticksRemaining: 1, totalTicks: 4 }
    state.raid.backpack = [{ itemId: 'water_bottle', name: 'Water Bottle', value: 5, rarity: 1, quantity: 15 }]
    store.state = processTick(state, createRNG(42), Date.now()).state
    store.lastTickAt = Date.now()
    const expectedReceipt = { ...store.state.lastExtraction }
    const wrapper = mount(App, { global: { stubs: {
      CommsLog: true, RaiderCard: true, BackpackPanel: true, HandlerActions: true,
      AwaySummary: true, RaiderCreationPanel: true, PWAInstallPrompt: true,
      PhaseStatusStrip: true, SkillsPanel: true, RaiderLifetimeStats: true,
    } } })
    const findButton = (text: string) => {
      const button = wrapper.findAll('button').find(entry => entry.text() === text)
      if (!button) throw new Error(`Missing button: ${text}`)
      return button
    }
    await findButton('Plan next purchase').trigger('click')
    expect(wrapper.get('nav [aria-current="page"]').text()).toContain('Prep')
    await wrapper.get('select').setValue('med:panic_paddles')
    expect(wrapper.get('[aria-label="Preparation purchase goal"]').text()).toContain('90 more coins needed')
    await findButton('Open stash / sell loot').trigger('click')
    expect(wrapper.get('nav [aria-current="page"]').text()).toContain('Stash')
    await wrapper.get('[aria-label="Home Stash"] .stash-item-row').trigger('click')
    await findButton('Sell for 75').trigger('click')
    expect(store.state.coins).toBe(75)
    expect(store.state.homeStash).toEqual([])
    await findButton('Plan next purchase').trigger('click')
    expect(wrapper.get('select').element.value).toBe('med:panic_paddles')
    expect(wrapper.get('[aria-label="Preparation purchase goal"]').text()).toContain('15 more coins needed')
    await wrapper.get('select').setValue('weapon:aspperigo')
    const card = wrapper.findAll('article').find(entry => entry.text().includes('Aspperigo'))
    if (!card) throw new Error('Missing Aspperigo purchase card')
    const buy = card.findAll('button').find(button => button.text().startsWith('Buy'))
    if (!buy) throw new Error('Missing weapon Buy button')
    await buy.trigger('click')
    await wrapper.get('[data-testid="prep-confirm-accept"]').trigger('click')
    await flushPromises()
    expect(store.state.coins).toBe(10)
    expect(store.ownedWeapons.some(weapon => weapon.weaponId === 'aspperigo')).toBe(true)
    expect(wrapper.get('[aria-label="Preparation purchase goal"]').text()).toContain('Already owned')
    expect(store.state.lastExtraction).toEqual(expectedReceipt)
    wrapper.unmount()
  })
})
