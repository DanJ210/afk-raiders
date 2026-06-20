<script setup lang="ts">
import { computed } from 'vue'
import type { RaiderLifetimeStats } from '../engine/types'
import { useLifetimeStatsRows } from '../composables/useLifetimeStatsRows'

const props = defineProps<{
  stats: RaiderLifetimeStats
}>()

const viewModel = useLifetimeStatsRows(computed(() => props.stats))
</script>

<template>
  <details class="mt-2 border-t border-border pt-2 min-w-0" open>
    <summary class="cursor-pointer font-mono text-[0.78rem] text-muted mb-1.5">Lifetime Stats</summary>

    <div class="grid gap-2">
      <div class="min-w-0">
        <h4 class="m-0 mb-1 font-mono text-[0.72rem] tracking-[0.04em] text-accent">Outcomes</h4>
        <p class="m-0 font-mono text-[0.72rem] text-muted overflow-wrap-anywhere">Extracts: {{ stats.extracts.total }} | Deaths: {{ stats.deaths.total }}</p>
      </div>

      <div v-if="viewModel.extractZoneRows.value.length > 0 || viewModel.deathZoneRows.value.length > 0" class="min-w-0">
        <h4 class="m-0 mb-1 font-mono text-[0.72rem] tracking-[0.04em] text-accent">By Zone</h4>
        <ul class="list-none m-0 p-0 flex flex-col gap-0.5">
          <li v-for="[zoneId, count] in viewModel.extractZoneRows.value" :key="`extract-zone-${zoneId}`" class="font-mono text-[0.72rem] text-text overflow-wrap-anywhere">
            ✅ {{ viewModel.zoneLabel(zoneId) }}: {{ count }}
          </li>
          <li v-for="[zoneId, count] in viewModel.deathZoneRows.value" :key="`death-zone-${zoneId}`" class="font-mono text-[0.72rem] text-text overflow-wrap-anywhere">
            💀 {{ viewModel.zoneLabel(zoneId) }}: {{ count }}
          </li>
        </ul>
      </div>

      <div v-if="viewModel.extractZoneTimeRows.value.length > 0 || viewModel.deathZoneTimeRows.value.length > 0" class="min-w-0">
        <h4 class="m-0 mb-1 font-mono text-[0.72rem] tracking-[0.04em] text-accent">By Zone + Danger Level</h4>
        <ul class="list-none m-0 p-0 flex flex-col gap-0.5">
          <li v-for="[key, count] in viewModel.extractZoneTimeRows.value" :key="`extract-zone-time-${key}`" class="font-mono text-[0.72rem] text-text overflow-wrap-anywhere">
            ✅ {{ viewModel.zoneLabel(viewModel.parseZoneDangerLevelKey(key).zoneId) }} ({{ viewModel.parseZoneDangerLevelKey(key).dangerLevel }}): {{ count }}
          </li>
          <li v-for="[key, count] in viewModel.deathZoneTimeRows.value" :key="`death-zone-time-${key}`" class="font-mono text-[0.72rem] text-text overflow-wrap-anywhere">
            💀 {{ viewModel.zoneLabel(viewModel.parseZoneDangerLevelKey(key).zoneId) }} ({{ viewModel.parseZoneDangerLevelKey(key).dangerLevel }}): {{ count }}
          </li>
        </ul>
      </div>

      <div v-if="viewModel.robotRows.value.length > 0" class="min-w-0">
        <h4 class="m-0 mb-1 font-mono text-[0.72rem] tracking-[0.04em] text-accent">Robots Defeated</h4>
        <ul class="list-none m-0 p-0 flex flex-col gap-0.5">
          <li v-for="[robotId, count] in viewModel.robotRows.value" :key="`robot-${robotId}`" class="font-mono text-[0.72rem] text-text overflow-wrap-anywhere">
            🤖 {{ viewModel.prettyId(robotId) }}: {{ count }}
          </li>
        </ul>
      </div>

      <div v-if="stats.healingItemsUsed.total > 0" class="min-w-0">
        <h4 class="m-0 mb-1 font-mono text-[0.72rem] tracking-[0.04em] text-accent">Healing Items Used</h4>
        <p class="m-0 font-mono text-[0.72rem] text-muted overflow-wrap-anywhere">Total uses: {{ stats.healingItemsUsed.total }}</p>
        <ul class="list-none m-0 p-0 flex flex-col gap-0.5 mt-1">
          <li v-for="[itemId, count] in viewModel.healingRows.value" :key="`healing-${itemId}`" class="font-mono text-[0.72rem] text-text overflow-wrap-anywhere">
            🩹 {{ viewModel.prettyId(itemId) }}: {{ count }}
          </li>
        </ul>
      </div>
    </div>
  </details>
</template>
