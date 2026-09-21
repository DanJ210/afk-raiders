// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, reactive } from 'vue'
import RaiderCreationPanel from '../../src/components/RaiderCreationPanel.vue'
import { personalityTraits, RAIDER_NAME_MAX_LENGTH } from '../../src/engine/identity'

function createStore(overrides: Record<string, unknown> = {}) {
  return reactive({
    needsRaiderCreation: true,
    personalityTraits,
    PERSONALITY_TRAIT_COUNT: 2,
    RAIDER_NAME_MAX_LENGTH,
    suggestIdentity: vi.fn(() => ({
      name: 'Mira "Wet Socks" Malone',
      traits: ['coward', 'hoarder'],
    })),
    confirmRaiderCreation: vi.fn(),
    ...overrides,
  })
}

let activeStore: ReturnType<typeof createStore>

vi.mock('../../src/stores/gameStore', () => ({
  useGameStore: () => activeStore,
}))

function beginButton(wrapper: ReturnType<typeof mount>) {
  const button = wrapper.findAll('button').find(item => item.text().includes('Begin Career'))
  expect(button).toBeDefined()
  return button!
}

function traitButton(wrapper: ReturnType<typeof mount>, traitName: string) {
  const button = wrapper.findAll('button').find(item => item.text().includes(traitName))
  expect(button).toBeDefined()
  return button!
}

describe('RaiderCreationPanel', () => {
  beforeEach(() => {
    activeStore = createStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when creation is not needed', () => {
    activeStore = createStore({ needsRaiderCreation: false })
    const wrapper = mount(RaiderCreationPanel)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('prefills the suggested name and traits and confirms them', async () => {
    const wrapper = mount(RaiderCreationPanel)

    const input = wrapper.get('input#raider-name')
    expect((input.element as HTMLInputElement).value).toBe('Mira "Wet Socks" Malone')

    await beginButton(wrapper).trigger('click')
    expect(activeStore.confirmRaiderCreation).toHaveBeenCalledWith(
      'Mira "Wet Socks" Malone',
      ['coward', 'hoarder'],
    )
  })

  it('disables begin when the name is blank', async () => {
    const wrapper = mount(RaiderCreationPanel)

    await wrapper.get('input#raider-name').setValue('   ')
    expect(beginButton(wrapper).attributes('disabled')).toBeDefined()

    await beginButton(wrapper).trigger('click')
    expect(activeStore.confirmRaiderCreation).not.toHaveBeenCalled()
  })

  it('lets the player swap traits and keeps exactly two selected', async () => {
    const wrapper = mount(RaiderCreationPanel)

    // Selecting a third trait swaps out the oldest pick (coward).
    await traitButton(wrapper, 'Optimist').trigger('click')
    await beginButton(wrapper).trigger('click')

    expect(activeStore.confirmRaiderCreation).toHaveBeenCalledWith(
      'Mira "Wet Socks" Malone',
      ['hoarder', 'optimist'],
    )
  })

  it('deselecting below the required count disables begin', async () => {
    const wrapper = mount(RaiderCreationPanel)

    await traitButton(wrapper, 'Coward').trigger('click')
    expect(beginButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('focuses the name field and makes sibling content inert while open', async () => {
    const Shell = defineComponent({
      components: { RaiderCreationPanel },
      template: '<div><button id="outside">Outside</button><RaiderCreationPanel /></div>',
    })
    const wrapper = mount(Shell, { attachTo: document.body })

    await nextTick()

    const input = wrapper.get('input#raider-name')
    expect(document.activeElement).toBe(input.element)
    expect(wrapper.get('#outside').attributes('inert')).toBeDefined()
  })

  it('restores sibling inert and aria-hidden attributes to their prior values', async () => {
    const Shell = defineComponent({
      components: { RaiderCreationPanel },
      template: '<div><button id="outside" inert aria-hidden="false">Outside</button><RaiderCreationPanel /></div>',
    })
    const wrapper = mount(Shell, { attachTo: document.body })

    await nextTick()
    activeStore.needsRaiderCreation = false
    await nextTick()
    await nextTick()

    const outside = wrapper.get('#outside')
    expect(outside.attributes('inert')).toBeDefined()
    expect(outside.attributes('aria-hidden')).toBe('false')
  })

  it('traps keyboard focus inside the dialog', async () => {
    const wrapper = mount(RaiderCreationPanel, { attachTo: document.body })
    await nextTick()

    const dialog = wrapper.get('[role="dialog"]')
    const input = wrapper.get('input#raider-name')
    const lastButton = beginButton(wrapper)

    ;(lastButton.element as HTMLButtonElement).focus()
    await dialog.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(input.element)

    ;(input.element as HTMLInputElement).focus()
    await dialog.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastButton.element)
  })
})
