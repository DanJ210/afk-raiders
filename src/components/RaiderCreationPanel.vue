<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useGameStore } from '../stores/gameStore'

const store = useGameStore()

// Prefill from a random suggestion so "just start" is one click.
const suggestion = store.suggestIdentity()
const modalRoot = ref<HTMLElement | null>(null)
const nameField = ref<HTMLInputElement | null>(null)
const siblingAttributeState = new WeakMap<HTMLElement, { inert: string | null; ariaHidden: string | null }>()
let inertSiblings: HTMLElement[] = []
const nameInput = ref(suggestion.name)
const selectedTraits = ref<string[]>([...suggestion.traits])

const trimmedName = computed(() => nameInput.value.trim())
const traitsValid = computed(() => selectedTraits.value.length === store.PERSONALITY_TRAIT_COUNT)
const canBegin = computed(() => trimmedName.value.length > 0 && traitsValid.value)

function rerollName() {
  nameInput.value = store.suggestIdentity().name
}

function rerollTraits() {
  selectedTraits.value = [...store.suggestIdentity().traits]
}

function toggleTrait(id: string) {
  if (selectedTraits.value.includes(id)) {
    selectedTraits.value = selectedTraits.value.filter(trait => trait !== id)
    return
  }
  if (selectedTraits.value.length >= store.PERSONALITY_TRAIT_COUNT) {
    // Replace the oldest pick so choosing a third trait swaps instead of failing.
    selectedTraits.value = [...selectedTraits.value.slice(1), id]
    return
  }
  selectedTraits.value = [...selectedTraits.value, id]
}

function begin() {
  if (!canBegin.value) return
  store.confirmRaiderCreation(nameInput.value, selectedTraits.value)
}

function setSiblingInert(active: boolean) {
  if (!active) {
    for (const sibling of inertSiblings) {
      const previous = siblingAttributeState.get(sibling)
      if (!previous) continue
      if (previous.inert === null) {
        sibling.removeAttribute('inert')
      } else {
        sibling.setAttribute('inert', previous.inert)
      }
      if (previous.ariaHidden === null) {
        sibling.removeAttribute('aria-hidden')
      } else {
        sibling.setAttribute('aria-hidden', previous.ariaHidden)
      }
      siblingAttributeState.delete(sibling)
    }
    inertSiblings = []
    return
  }

  const overlay = modalRoot.value
  const parent = overlay?.parentElement
  if (!overlay || !parent) return

  inertSiblings = []
  for (const element of Array.from(parent.children)) {
    if (element === overlay) continue
    const sibling = element as HTMLElement
    inertSiblings.push(sibling)
    if (active) {
      if (!siblingAttributeState.has(sibling)) {
        siblingAttributeState.set(sibling, {
          inert: sibling.getAttribute('inert'),
          ariaHidden: sibling.getAttribute('aria-hidden'),
        })
      }
      sibling.setAttribute('inert', '')
      sibling.setAttribute('aria-hidden', 'true')
    }
  }
}

function focusNameField() {
  nameField.value?.focus()
}

function onDialogKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !modalRoot.value) return

  const focusable = Array.from(
    modalRoot.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(element => !element.hasAttribute('inert') && element.tabIndex >= 0)

  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement as HTMLElement | null

  if (event.shiftKey) {
    if (active === first || !modalRoot.value.contains(active)) {
      event.preventDefault()
      last.focus()
    }
    return
  }

  if (active === last || !modalRoot.value.contains(active)) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => store.needsRaiderCreation,
  async (needsCreation) => {
    await nextTick()
    setSiblingInert(needsCreation)
    if (needsCreation) {
      focusNameField()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  setSiblingInert(false)
})
</script>

<template>
  <div
    v-if="store.needsRaiderCreation"
    ref="modalRoot"
    class="modal-overlay z-away-summary"
    role="dialog"
    aria-modal="true"
    aria-label="Create your raider"
    @keydown="onDialogKeydown"
  >
    <div class="w-[min(100%,480px)] max-h-[92dvh] overflow-y-auto bg-surface border border-accent rounded-[10px] p-6 flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <span class="text-[1.4rem]">🪪</span>
        <span class="font-mono text-raider-value tracking-widest text-accent font-bold">DESPERANZA INTAKE — NEW RAIDER</span>
      </div>
      <p class="font-mono text-raider-meta text-muted m-0">
        The Hatch Authority requires a name and two documented personality defects before anyone is allowed to become someone else's problem.
      </p>

      <div class="flex flex-col gap-1.5">
        <label for="raider-name" class="font-mono text-raider-tiny tracking-wider text-muted uppercase">Raider Name</label>
        <div class="flex gap-2">
          <input
            id="raider-name"
            ref="nameField"
            v-model="nameInput"
            type="text"
            :maxlength="store.RAIDER_NAME_MAX_LENGTH"
            class="flex-1 min-w-0 bg-bg border border-border rounded px-2.5 py-2 font-mono text-raider-value text-text focus:border-accent focus:outline-none"
            placeholder="e.g. Mira &quot;Wet Socks&quot; Malone"
            @keydown.enter="begin"
          />
          <button
            type="button"
            class="font-mono text-raider-tiny bg-transparent border border-border text-muted rounded px-2.5 cursor-pointer hover:text-accent hover:border-accent"
            title="Reroll a suggested name"
            @click="rerollName"
          >🎲</button>
        </div>
      </div>

      <fieldset class="flex flex-col gap-1.5 min-w-0 border-0 p-0 m-0" aria-describedby="raider-traits-help">
        <div class="flex items-baseline justify-between gap-2">
          <legend class="font-mono text-raider-tiny tracking-wider text-muted uppercase">
            Persona — pick {{ store.PERSONALITY_TRAIT_COUNT }}
          </legend>
          <button
            type="button"
            class="font-mono text-raider-tiny bg-transparent border border-border text-muted rounded px-2.5 py-0.5 cursor-pointer hover:text-accent hover:border-accent"
            title="Roll random personality defects"
            @click="rerollTraits"
          >🎲 Surprise me</button>
        </div>
        <p id="raider-traits-help" class="font-mono text-raider-tiny text-muted m-0">
          Select exactly {{ store.PERSONALITY_TRAIT_COUNT }} traits.
        </p>
        <div class="grid grid-cols-1 gap-1.5">
          <button
            v-for="trait in store.personalityTraits"
            :key="trait.id"
            type="button"
            class="text-left bg-bg border rounded px-2.5 py-2 cursor-pointer font-mono"
            :class="selectedTraits.includes(trait.id) ? 'border-accent text-text' : 'border-border text-muted hover:border-accent/60'"
            :aria-pressed="selectedTraits.includes(trait.id)"
            @click="toggleTrait(trait.id)"
          >
            <span class="block text-raider-value font-bold" :class="selectedTraits.includes(trait.id) ? 'text-accent' : ''">
              {{ selectedTraits.includes(trait.id) ? '☑' : '☐' }} {{ trait.name }}
            </span>
            <span class="block text-raider-tiny mt-0.5">{{ trait.description }}</span>
          </button>
        </div>
      </fieldset>

      <button
        type="button"
        class="block w-full py-2.5 bg-accent text-bg border-none rounded font-mono text-raider-value font-bold cursor-pointer tracking-wider hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!canBegin"
        @click="begin"
      >
        Stamp Paperwork &amp; Begin Career
      </button>
    </div>
  </div>
</template>
