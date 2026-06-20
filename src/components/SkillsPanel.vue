<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { useSkillsViewModel } from '../composables/useSkillsViewModel'

const store = useGameStore()
const skills = computed(() => store.raider.skills)
const viewModel = useSkillsViewModel(skills)
</script>

<template>
  <section class="skills-panel panel-card shrink-0 max-[600px]:p-2.5" aria-label="Raider Skills">
    <header class="section-header">SKILLS</header>

    <div class="flex items-center justify-between gap-2 mb-2 font-mono text-[0.72rem] text-muted">
      <span>{{ viewModel.learnedCount.value }} learned</span>
      <span>Total Lvl {{ viewModel.totalLevel.value }}</span>
    </div>

    <div class="grid gap-2">
      <article
        v-for="skill in viewModel.rows.value"
        :key="skill.id"
        class="min-w-0 rounded bg-surface-raised border border-border-subtle p-2"
      >
        <div class="flex items-baseline justify-between gap-2 min-w-0">
          <h3 class="m-0 font-mono text-[0.78rem] text-text font-bold wrap-anywhere">{{ skill.name }}</h3>
          <span class="shrink-0 font-mono text-raider-tiny text-accent">Lvl {{ skill.level }}/{{ skill.maxLevel }}</span>
        </div>

        <p class="m-0 mt-1 font-mono text-raider-tiny leading-snug text-muted wrap-anywhere">{{ skill.description }}</p>

        <div class="mt-2 flex items-center gap-2 min-w-0">
          <div class="progress-track min-w-0" aria-hidden="true">
            <div class="progress-fill bg-accent" :style="{ width: `${skill.progressPercent}%` }"></div>
          </div>
          <span class="shrink-0 font-mono text-[0.66rem] text-muted">
            {{ skill.isMaxed ? 'MAX' : `${skill.xp}/${skill.nextLevelXp}` }}
          </span>
        </div>

        <p class="m-0 mt-1.5 font-mono text-[0.68rem] leading-snug text-text wrap-anywhere">{{ skill.effectText }}</p>
        <p v-if="skill.nextEffectText" class="m-0 mt-1 font-mono text-[0.66rem] leading-snug text-muted wrap-anywhere">
          Next: {{ skill.nextEffectText }}
        </p>
      </article>
    </div>
  </section>
</template>