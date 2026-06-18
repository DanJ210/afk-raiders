<script setup lang="ts">
import { computed } from 'vue'
import type { RaiderLifetimeStats } from '../engine/types'
import { useLifetimeStatsRows } from '../composables/useLifetimeStatsRows'

const props = defineProps<{
  stats: RaiderLifetimeStats
}>()

const statsRef = computed(() => props.stats)
const viewModel = useLifetimeStatsRows(statsRef)
</script>

<template>
  <details class="lifetime-stats" open>
    <summary>Lifetime Stats</summary>

    <div class="lifetime-stats__grid">
      <div class="lifetime-stats__section">
        <h4>Outcomes</h4>
        <p>Extracts: {{ stats.extracts.total }} | Deaths: {{ stats.deaths.total }}</p>
      </div>

      <div v-if="viewModel.extractZoneRows.value.length > 0 || viewModel.deathZoneRows.value.length > 0" class="lifetime-stats__section">
        <h4>By Zone</h4>
        <ul>
          <li v-for="[zoneId, count] in viewModel.extractZoneRows.value" :key="`extract-zone-${zoneId}`">
            ✅ {{ viewModel.zoneLabel(zoneId) }}: {{ count }}
          </li>
          <li v-for="[zoneId, count] in viewModel.deathZoneRows.value" :key="`death-zone-${zoneId}`">
            💀 {{ viewModel.zoneLabel(zoneId) }}: {{ count }}
          </li>
        </ul>
      </div>

      <div v-if="viewModel.extractZoneTimeRows.value.length > 0 || viewModel.deathZoneTimeRows.value.length > 0" class="lifetime-stats__section">
        <h4>By Zone + Danger Level</h4>
        <ul>
          <li v-for="[key, count] in viewModel.extractZoneTimeRows.value" :key="`extract-zone-time-${key}`">
            ✅ {{ viewModel.zoneLabel(viewModel.parseZoneDangerLevelKey(key).zoneId) }} ({{ viewModel.parseZoneDangerLevelKey(key).dangerLevel }}): {{ count }}
          </li>
          <li v-for="[key, count] in viewModel.deathZoneTimeRows.value" :key="`death-zone-time-${key}`">
            💀 {{ viewModel.zoneLabel(viewModel.parseZoneDangerLevelKey(key).zoneId) }} ({{ viewModel.parseZoneDangerLevelKey(key).dangerLevel }}): {{ count }}
          </li>
        </ul>
      </div>

      <div v-if="viewModel.robotRows.value.length > 0" class="lifetime-stats__section">
        <h4>Robots Defeated</h4>
        <ul>
          <li v-for="[robotId, count] in viewModel.robotRows.value" :key="`robot-${robotId}`">
            🤖 {{ viewModel.prettyId(robotId) }}: {{ count }}
          </li>
        </ul>
      </div>

      <div v-if="stats.healingItemsUsed.total > 0" class="lifetime-stats__section">
        <h4>Healing Items Used</h4>
        <p>Total uses: {{ stats.healingItemsUsed.total }}</p>
        <ul>
          <li v-for="[itemId, count] in viewModel.healingRows.value" :key="`healing-${itemId}`">
            🩹 {{ viewModel.prettyId(itemId) }}: {{ count }}
          </li>
        </ul>
      </div>
    </div>
  </details>
</template>

<style scoped>
.lifetime-stats {
  margin-top: 8px;
  border-top: 1px solid var(--color-border);
  padding-top: 8px;
  min-width: 0;
}

.lifetime-stats summary {
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--color-muted);
  margin-bottom: 6px;
}

.lifetime-stats__grid {
  display: grid;
  gap: 8px;
}

.lifetime-stats__section h4 {
  margin: 0 0 4px;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--color-accent);
}

.lifetime-stats__section p {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-muted);
  overflow-wrap: anywhere;
}

.lifetime-stats__section ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lifetime-stats__section li {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text);
  overflow-wrap: anywhere;
}
</style>
