<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/gameStore'

const store = useGameStore()

// Prefill from a random suggestion so "just start" is one click.
const suggestion = store.suggestIdentity()
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
</script>

<template>
  <div
    v-if="store.needsRaiderCreation"
    class="modal-overlay z-away-summary"
    role="dialog"
    aria-modal="true"
    aria-label="Create your raider"
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

      <div class="flex flex-col gap-1.5">
        <div class="flex items-baseline justify-between">
          <span class="font-mono text-raider-tiny tracking-wider text-muted uppercase">
            Persona — pick {{ store.PERSONALITY_TRAIT_COUNT }}
          </span>
          <button
            type="button"
            class="font-mono text-raider-tiny bg-transparent border border-border text-muted rounded px-2.5 py-0.5 cursor-pointer hover:text-accent hover:border-accent"
            title="Roll random personality defects"
            @click="rerollTraits"
          >🎲 Surprise me</button>
        </div>
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
      </div>

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
