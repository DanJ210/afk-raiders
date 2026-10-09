// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import { createInitialState } from '../../src/engine/initialState'
import MobileRescuePrompt from '../../src/components/MobileRescuePrompt.vue'

const now = 1_000_000
function createStore() {
  const state = reactive(createInitialState(now))
  state.raid.phase = 'RAIDING'
  state.raid.downed = { ticksRemaining: 2, totalTicks: 2 }
  state.raider.hp = 0
  return reactive({
    state,
    phase: computed(() => state.raid.phase),
    raid: computed(() => state.raid),
    raider: computed(() => state.raider),
    lastTickAt: now,
  })
}
let store: ReturnType<typeof createStore>
vi.mock('../../src/stores/gameStore', () => ({ useGameStore: () => store }))

describe('MobileRescuePrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    store = createStore()
  })
  afterEach(() => vi.useRealTimers())

  it('shows the recovery deadline and routes to existing controls without spending resources', async () => {
    const wrapper = mount(MobileRescuePrompt)
    expect(wrapper.text()).toContain('Knockout in 1:00')
    expect(wrapper.text()).toContain('Signal revive · 5 Signal')
    await wrapper.get('button:first-child').trigger('click')
    await wrapper.get('button:last-child').trigger('click')
    expect(wrapper.emitted('openSignal')).toHaveLength(1)
    expect(wrapper.emitted('openMeds')).toHaveLength(1)
    expect(store.state.signal.current).toBe(5)
    expect(store.raid.downed).not.toBeNull()
    wrapper.unmount()
  })

  it('shows the extraction race and only counts revive meds, not bandages', () => {
    store.raid.extracting = { ticksRemaining: 1, totalTicks: 4 }
    store.raid.healingItems = [
      { itemId: 'bandage_white', name: 'White Bandage', healAmount: 5, rarity: 1, quantity: 3 },
      { itemId: 'panic_paddles', name: 'Panic Paddles', healAmount: 0, reviveAmount: 25, rarity: 3, quantity: 2 },
    ]
    store.state.signal.current = 0
    const wrapper = mount(MobileRescuePrompt)
    expect(wrapper.text()).toContain('Extraction in 0:30')
    expect(wrapper.text()).toContain('Field meds · 2 revive doses')
    expect(wrapper.text()).toContain('Not enough Signal; use a revive med.')
    wrapper.unmount()
  })

  it('explains unavailable rescue and amplifier refill', async () => {
    store.state.signal.current = 1
    const wrapper = mount(MobileRescuePrompt)
    expect(wrapper.text()).toContain('No rescue available right now.')
    store.state.signalAmplifiers = 1
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Refill with an amplifier')
    expect(wrapper.text()).not.toContain('No rescue available')
    wrapper.unmount()
  })

  it('updates the countdown and disappears immediately on revive or recovery', async () => {
    const wrapper = mount(MobileRescuePrompt)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wrapper.text()).toContain('Knockout in 0:50')
    store.raid.downed = null
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="Raider rescue"]').exists()).toBe(false)
    store.raid.downed = { ticksRemaining: 2, totalTicks: 2 }
    store.raid.phase = 'KNOCKED_OUT'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="Raider rescue"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
