// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ExtractionPayoff from '../../src/components/ExtractionPayoff.vue'
import PreparationGoal from '../../src/components/PreparationGoal.vue'
import { createInitialState } from '../../src/engine/initialState'

function createStore() {
  const state = reactive(createInitialState(1000))
  return reactive({ state, phase: 'HUB', ownedWeapons: state.ownedWeapons })
}
let store: ReturnType<typeof createStore>
vi.mock('../../src/stores/gameStore', () => ({ useGameStore: () => store }))

describe('extraction payoff', () => {
  beforeEach(() => { store = createStore() })

  it('does not fabricate a receipt for a new or legacy profile', () => {
    const wrapper = mount(ExtractionPayoff)
    expect(wrapper.find('details').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows fixed historical rewards and emits navigation, not economic transactions', async () => {
    store.state.lastExtraction = {
      timestamp: 1000, extractionNumber: 2, zone: 'damp_battlegrounds', dangerLevel: 'Medium',
      lootItemCount: 3, lootValue: 22, stashValueChange: -8,
      overflowItemCount: 3, overflowCoins: 30, stipendCoins: 4,
    }
    const wrapper = mount(ExtractionPayoff)
    expect(wrapper.text()).toContain('22 loot value secured')
    expect(wrapper.text()).toContain('Net stash value change-8')
    expect(wrapper.text()).toContain('Coins credited+34')
    expect(wrapper.text()).toContain('Overflow sales may include older stash items')
    await wrapper.findAll('button')[0]!.trigger('click')
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('openStash')).toHaveLength(1)
    expect(wrapper.emitted('openPrep')).toHaveLength(1)
    store.state.coins = 999
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Coins credited+34')
    store.phase = 'RAIDING'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('details').exists()).toBe(false)
    wrapper.unmount()
  })

  it('uses real prices and separates coins from stash value for a useful weapon goal', async () => {
    store.state.homeStash = [{ itemId: 'junk', name: 'Junk', value: 100, rarity: 1, quantity: 1 }]
    const wrapper = mount(PreparationGoal)
    expect(wrapper.get('select').element.value).toBe('weapon:aspperigo')
    expect(wrapper.text()).toContain('4-7 damage')
    expect(wrapper.text()).toContain('0 spendable coins / 65 cost')
    expect(wrapper.text()).toContain('65 more coins needed')
    expect(wrapper.text()).toContain('Selling stash items can cover the shortfall')
    store.state.coins = 65
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Affordable now')
    store.phase = 'RAIDING'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Purchase when the Raider returns to HUB')
    expect(store.state.homeStash[0]?.quantity).toBe(1)
    wrapper.unmount()
  })

  it('lets the Handler choose consumables and distinguishes their effects', async () => {
    const wrapper = mount(PreparationGoal)
    await wrapper.get('select').setValue('med:panic_paddles')
    expect(wrapper.text()).toContain('Revives a DOWNED Raider to 25 HP')
    expect(wrapper.text()).toContain('90 more coins needed')
    await wrapper.get('select').setValue('shield:fizz_cell')
    expect(wrapper.text()).toContain('Restores 20 shield charge, not durability')
    expect(wrapper.text()).toContain('12 more coins needed')
    wrapper.unmount()
  })

  it('recognizes owned weapons without suggesting a duplicate purchase', () => {
    store.ownedWeapons.push({ weaponId: 'aspperigo', durability: 10 })
    const wrapper = mount(PreparationGoal)
    expect(wrapper.get('select').element.value).toBe('weapon:vernerider')
    wrapper.unmount()
  })
})
