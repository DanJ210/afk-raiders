import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { usePinnedTopLog } from '../../src/composables/usePinnedTopLog'

describe('usePinnedTopLog', () => {
  it('tracks whether the user scrolled away from top threshold', () => {
    const vm = usePinnedTopLog(ref(0), 60)
    vm.logEl.value = { scrollTop: 61 } as unknown as HTMLElement

    vm.onScroll()
    expect(vm.userScrolledDown.value).toBe(true)

    vm.logEl.value = { scrollTop: 10 } as unknown as HTMLElement
    vm.onScroll()
    expect(vm.userScrolledDown.value).toBe(false)
  })

  it('scrolls to top only when not user-scrolled-away, and jumpToTop resets pin', async () => {
    const entryCountRef = ref(0)
    const vm = usePinnedTopLog(entryCountRef, 60)
    const el = { scrollTop: 120 } as unknown as HTMLElement
    vm.logEl.value = el

    vm.userScrolledDown.value = true
    await vm.scrollToTop()
    expect(el.scrollTop).toBe(120)

    vm.userScrolledDown.value = false
    await vm.scrollToTop()
    expect(el.scrollTop).toBe(0)

    vm.userScrolledDown.value = true
    el.scrollTop = 45
    vm.jumpToTop()
    await nextTick()
    expect(vm.userScrolledDown.value).toBe(false)
    expect(el.scrollTop).toBe(0)
  })

  it('reacts to new entries by attempting top pin', async () => {
    const entryCountRef = ref(0)
    const vm = usePinnedTopLog(entryCountRef, 60)
    const el = { scrollTop: 30 } as unknown as HTMLElement
    vm.logEl.value = el

    vm.userScrolledDown.value = false
    entryCountRef.value += 1
    await nextTick()
    await nextTick()
    expect(el.scrollTop).toBe(0)
  })
})
