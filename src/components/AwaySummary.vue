<script setup lang="ts">
import { useGameStore } from '../stores/gameStore'

const store = useGameStore()
</script>

<template>
  <div
    v-if="store.awaySummary"
    class="modal-overlay z-[100]"
    role="alert"
    aria-live="assertive"
  >
    <div class="w-[min(100%,420px)] bg-surface border border-accent rounded-[10px] p-6">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-[1.4rem]">📡</span>
        <span class="font-mono text-[0.85rem] tracking-[0.1em] text-accent font-bold">WHILE YOU WERE AWAY…</span>
      </div>
      <ul class="list-none p-0 m-0 mb-5 flex flex-col gap-2">
        <li v-for="line in store.awaySummary.lines" :key="line" class="font-mono text-[0.875rem] text-text pl-4 relative before:absolute before:left-0 before:text-accent before:content-['>']">{{ line }}</li>
      </ul>
      <button class="block w-full py-2.5 bg-accent text-bg border-none rounded font-mono text-[0.85rem] font-bold cursor-pointer tracking-[0.05em] hover:opacity-85" @click="store.dismissAwaySummary()">
        Acknowledged
      </button>
    </div>
  </div>
</template>
