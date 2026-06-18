import { nextTick, onMounted, ref, watch } from 'vue'

const DEFAULT_SCROLLED_AWAY_THRESHOLD_PX = 60

export function usePinnedTopLog(
  entryCountRef: { value: number },
  scrolledAwayThresholdPx = DEFAULT_SCROLLED_AWAY_THRESHOLD_PX,
) {
  const logEl = ref<HTMLElement | null>(null)
  const userScrolledDown = ref(false)

  function onScroll() {
    if (!logEl.value) return
    const { scrollTop } = logEl.value
    userScrolledDown.value = scrollTop > scrolledAwayThresholdPx
  }

  async function scrollToTop() {
    if (userScrolledDown.value) return
    await nextTick()
    if (logEl.value) {
      logEl.value.scrollTop = 0
    }
  }

  function jumpToTop() {
    userScrolledDown.value = false
    void scrollToTop()
  }

  watch(() => entryCountRef.value, () => {
    void scrollToTop()
  })

  onMounted(() => {
    void scrollToTop()
  })

  return {
    logEl,
    userScrolledDown,
    onScroll,
    scrollToTop,
    jumpToTop,
  }
}
